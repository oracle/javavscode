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

import { workspace, DebugConfiguration } from "vscode";
import { extConstants } from "../../constants";
import { InternalResolverDebugConfiguration, ResolveConfigType } from "./types";
import { ConfigurationValueResolver } from "./configurationValueResolver";
import { LOGGER } from "../../logger";
import { LSPAny } from "vscode-languageclient";

export const isInternalConfigurationResolverConfig = (config: DebugConfiguration): config is InternalResolverDebugConfiguration =>
    config.type === extConstants.COMMAND_PREFIX && config?.__internalConfigurationResolver === true;

export const completeInternalConfigurationResolver = (config: DebugConfiguration): void => {
    if (!isInternalConfigurationResolverConfig(config) || !config.__resolverValues || !config.__resolverRequestId) {
        LOGGER.warn("Something went wrong while resolving config");
        return;
    }

    ConfigurationValueResolver
        .getInstance()
        .completePendingInternalResolver(config.__resolverRequestId, config.__resolverValues);
};

const setByKeyPath = (target: Record<string, LSPAny>, key: string, value: LSPAny): void => {
    const path = key.split('.');
    let current = target;
    let idx = 0;
    while (idx < path.length - 1) {
        const segment = path[idx];
        if(!current[segment])
            current[segment] = Object.create(null);
        current = current[segment];
        idx++;
    }

    current[path[idx]] = value;
};

export const extractSettingsInformation = async (keys: string[]): Promise<Record<string, LSPAny>> => {
    const result = Object.create(null);
    const prefixedConfiguration = workspace.getConfiguration(extConstants.COMMAND_PREFIX);
    const prefixedSection = `${extConstants.COMMAND_PREFIX}.`;

    const entries: ResolveConfigType[] = [];
    keys.forEach(configKey => {
        if (!configKey.startsWith(prefixedSection)) {
            return;
        }
        const rawValue = prefixedConfiguration.get(configKey.substring(prefixedSection.length));
        if (rawValue !== undefined) {
            entries.push({ configKey, rawValue });
        }
    });

    const resolvedValues = await ConfigurationValueResolver.getInstance().resolveIfNeededBatch(entries);
    resolvedValues.forEach((resolvedValue, index) => {
        setByKeyPath(result, entries[index].configKey, resolvedValue);
    });

    return result;
};
