/*
  Copyright (c) 2026, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { Disposable, ExtensionContext } from "vscode";
import { configsThatNeedAdditionalResolver } from "../configuration";
import { globalState } from "../../globalState";
import { isError } from "../../utils";
import { InternalDebugResolutionBackend } from "./internalDebugResolutionBackend";
import { IConfigurationValueResolver, ResolveConfigType, ResolverValueMap } from "./types";
import { LOGGER } from "../../logger";
import { LSPAny } from "vscode-languageclient";

export class ConfigurationValueResolver implements IConfigurationValueResolver {
    private static instance: ConfigurationValueResolver | undefined;

    private readonly supportedConfigKeys = new Set<string>(configsThatNeedAdditionalResolver);
    private readonly internalResolver: InternalDebugResolutionBackend;
    private readonly resolverDisposable: Disposable;

    private constructor(extensionContext: ExtensionContext) {
        this.internalResolver = new InternalDebugResolutionBackend();
        this.resolverDisposable = new Disposable(() => this.dispose());
        extensionContext.subscriptions.push(this.resolverDisposable);
    }

    public static getInstance(): ConfigurationValueResolver {
        if (!ConfigurationValueResolver.instance) {
            const extensionContext = globalState.getExtensionContextInfo().getExtensionContext();
            ConfigurationValueResolver.instance = new ConfigurationValueResolver(extensionContext);
        }

        return ConfigurationValueResolver.instance;
    }

    public isSupported(configKey: string): boolean {
        return this.supportedConfigKeys.has(configKey);
    }

    public async resolveIfNeeded(resolveConfig: ResolveConfigType): Promise<LSPAny> {
        const values = await this.resolveIfNeededBatch([resolveConfig]);
        return values[0];
    }

    public async resolveIfNeededBatch(configs: ResolveConfigType[]): Promise<LSPAny[]> {
        const resolvedValues = configs.map(config => config.rawValue);
        const resolvableEntries: Array<ResolveConfigType & { index: number }> = [];

        configs.forEach(({ configKey, rawValue }, index) => {
            if (this.isSupported(configKey)) {
                resolvableEntries.push({ index, configKey, rawValue });
            }
        });

        if (resolvableEntries.length === 0) {
            return resolvedValues;
        }

        try {
            const resolvedBatch = await this.internalResolver.resolveBatch(resolvableEntries);
            resolvedBatch.forEach((value, idx) => {
                resolvedValues[resolvableEntries[idx].index] = value;
            });
        } catch (error: unknown) {
            LOGGER.warn(`Failed to resolve VS Code variables for configuration payload: ${isError(error) ? error.message : error}`);
        }

        return resolvedValues;
    }

    public completePendingInternalResolver(requestId: string, resolvedValues: ResolverValueMap): void {
        this.internalResolver.completePendingInternalResolver(requestId, resolvedValues);
    }

    public dispose(): void {
        this.internalResolver.dispose();
    }
}
