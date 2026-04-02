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

import { DebugConfiguration } from "vscode";
import { LSPAny } from "vscode-languageclient";

export interface IConfigurationValueResolver {
    isSupported(configKey: string): boolean;
    resolveIfNeeded(configKey: unknown, rawValue: unknown): Promise<unknown>;
    resolveIfNeededBatch(configs: ResolveConfigType[]): Promise<unknown[]>;
    dispose(): void;
}

export type ResolveConfigType = {
    configKey: string;
    rawValue: LSPAny;
};

export type ResolverValueMap = Record<string, LSPAny>;

export type InternalResolverDebugConfiguration = DebugConfiguration & {
    __internalConfigurationResolver?: boolean;
    __resolverRequestId?: string;
    __resolverValues?: ResolverValueMap;
};

export type PendingInternalResolver = {
    resolve: (value: ResolverValueMap) => void;
    timeout: NodeJS.Timeout;
    fallbackValues: ResolverValueMap;
};
