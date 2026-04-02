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

import { randomUUID } from "crypto";
import { CancellationToken, debug, DebugConfiguration, DebugConfigurationProvider, DebugSessionOptions, Disposable, ProviderResult, WorkspaceFolder } from "vscode";
import { extConstants } from "../../constants";
import { LOGGER } from "../../logger";
import { isError } from "../../utils";
import { InternalResolverDebugConfiguration, PendingInternalResolver, ResolveConfigType, ResolverValueMap } from "./types";
import { completeInternalConfigurationResolver, isInternalConfigurationResolverConfig } from "./utils";

class InternalDebugConfigProvider implements DebugConfigurationProvider {
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        return debugConfiguration;
    }

    resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (isInternalConfigurationResolverConfig(debugConfiguration)) {
            completeInternalConfigurationResolver(debugConfiguration);
            return undefined;
        }

        return debugConfiguration;
    }

}

export class InternalDebugResolutionBackend {
    private static readonly INTERNAL_RESOLVER_TIMEOUT_MS = 10000;
    private static readonly INTERNAL_RESOLVER_NAME = `__${extConstants.COMMAND_PREFIX}_internal_resolver__`;
    private static readonly DUMMY_DEBUG_OPTIONS: DebugSessionOptions = Object.freeze({
        noDebug: true,
        suppressDebugToolbar: true,
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressSaveBeforeStart: true,
    });

    private readonly providerRegistration: Disposable;
    private readonly pending = new Map<string, PendingInternalResolver>();

    constructor() {
        this.providerRegistration = debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, new InternalDebugConfigProvider());
    }

    public async resolveBatch(configs: ResolveConfigType[]): Promise<unknown[]> {
        if (configs.length === 0) {
            return [];
        }

        const requestId = this.generateRequestId();
        const fallbackValues = this.createResolverValueMap(configs);
        const resolution = new Promise<ResolverValueMap>(resolve => {
            const timeout = setTimeout(() => {
                this.pending.delete(requestId);
                LOGGER.warn(`Timed out resolving VS Code variables, using raw values for request ${requestId}`);
                resolve(fallbackValues);
            }, InternalDebugResolutionBackend.INTERNAL_RESOLVER_TIMEOUT_MS);

            this.pending.set(requestId, { resolve, timeout, fallbackValues });
        });

        try {
            const started = await debug.startDebugging(
                undefined,
                this.createDebugConfig(requestId, fallbackValues),
                InternalDebugResolutionBackend.DUMMY_DEBUG_OPTIONS
            );

            if (!started && this.pending.has(requestId)) {
                LOGGER.warn(`Debug launch for VS Code variable resolution did not start, using raw values for request ${requestId}`);
                this.completePendingInternalResolver(requestId, fallbackValues);
            }
        } catch (error: unknown) {
            LOGGER.warn(`Failed to resolve VS Code variables: ${isError(error) ? error.message : error}`);
            this.completePendingInternalResolver(requestId, fallbackValues);
        }

        const resolvedMap = await resolution;
        return configs.map(config => {
            const resolved = resolvedMap[config.configKey];
            return resolved === undefined ? config.rawValue : resolved;
        });
    }

    public completePendingInternalResolver(requestId: string, resolvedValues: ResolverValueMap): void {
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        pending.resolve(resolvedValues);
    }

    public dispose(): void {
        this.providerRegistration.dispose();
        for (const [requestId, pending] of this.pending) {
            clearTimeout(pending.timeout);
            pending.resolve(pending.fallbackValues);
            this.pending.delete(requestId);
            LOGGER.warn(`Disposing pending VS Code variable resolution request ${requestId}`);
        }
    }

    private createDebugConfig(requestId: string, resolverValues: ResolverValueMap): InternalResolverDebugConfiguration {
        return {
            type: extConstants.COMMAND_PREFIX,
            name: InternalDebugResolutionBackend.INTERNAL_RESOLVER_NAME,
            request: 'launch',
            __internalConfigurationResolver: true,
            __resolverRequestId: requestId,
            __resolverValues: resolverValues,
        };
    }

    private createResolverValueMap(configs: ResolveConfigType[]): ResolverValueMap {
        const result: ResolverValueMap = {};
        for (const config of configs) {
            result[config.configKey] = config.rawValue;
        }
        return result;
    }

    private generateRequestId = () => randomUUID().toString();
}
