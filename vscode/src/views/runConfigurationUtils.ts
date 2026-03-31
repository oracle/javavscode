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

import { DebugConfiguration } from 'vscode';
import { isObject, isString, parseArguments } from '../utils';
import { getRunConfigurationValues, RunConfigurationNodeValues } from './runConfiguration';

export const applyRunConfigurationOverrides = (
    config: DebugConfiguration,
    overrides: RunConfigurationNodeValues = getRunConfigurationValues()
): DebugConfiguration => {
    const updatedConfig = { ...config };
    const args = getNonEmptyValue(overrides.args);
    if (args) {
        updatedConfig.args = appendStringValue(getStringValue(updatedConfig.args), args);
    }

    const vmArgs = getNonEmptyValue(overrides.vmArgs);
    if (vmArgs) {
        updatedConfig.vmArgs = appendVmArguments(getVmArgsValue(updatedConfig.vmArgs), vmArgs);
    }

    const env = getNonEmptyValue(overrides.env);
    if (env) {
        updatedConfig.env = mergeEnvironmentVariables(updatedConfig.env, env);
    }

    const cwd = getNonEmptyValue(overrides.cwd);
    if (cwd) {
        updatedConfig.cwd = cwd;
    }

    return updatedConfig;
};

const appendStringValue = (currentValue: string | undefined, appendedValue: string): string =>
    currentValue ? `${currentValue} ${appendedValue}` : appendedValue;

const appendVmArguments = (currentValue: string | string[] | undefined, appendedValue: string): string | string[] => {
    if (!currentValue) {
        return appendedValue;
    }

    if (Array.isArray(currentValue)) {
        return [...currentValue, ...parseArguments(appendedValue)];
    }

    return `${currentValue} ${appendedValue}`;
};

const mergeEnvironmentVariables = (currentEnv: unknown, rawEnv: string): Record<string, string> => {
    const targetEnv = isStringMap(currentEnv) ? { ...currentEnv } : {};
    return {
        ...targetEnv,
        ...parseEnvironmentVariables(rawEnv)
    };
};

const parseEnvironmentVariables = (rawEnv: string): Record<string, string> => {
    return rawEnv
        .split(',')
        .map(entry => entry.trim())
        .reduce<Record<string, string>>((parsedEnv, entry) => {
            const separatorIndex = entry.indexOf('=');
            if (separatorIndex <= 0) {
                return parsedEnv;
            }

            const key = entry.substring(0, separatorIndex).trim();
            const value = entry.substring(separatorIndex + 1).trim();
            if (!key) {
                return parsedEnv;
            }

            parsedEnv[key] = value;
            return parsedEnv;
        }, {});
};

const getNonEmptyValue = (value: string | undefined): string | undefined => {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : undefined;
};

const getStringValue = (value: unknown): string | undefined =>
    isString(value) ? value : undefined;

const getVmArgsValue = (value: unknown): string | string[] | undefined => {
    if (isString(value) || Array.isArray(value)) {
        return value;
    }

    return undefined;
};

const isStringMap = (value: unknown): value is Record<string, string> =>
    !!value && isObject(value) && !Array.isArray(value);
