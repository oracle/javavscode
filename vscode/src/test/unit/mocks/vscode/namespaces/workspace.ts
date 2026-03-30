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

import * as vscode from 'vscode';
import { anything, instance, mock, when } from 'ts-mockito';

type VSCode = typeof vscode;

const mockedConfigurationValues = new Map<string, unknown>();
const mockedConfigurationUpdates: Array<{ key: string; value: unknown; configurationTarget?: vscode.ConfigurationTarget | boolean | null }> = [];

const mockedWorkspaceConfiguration = mock<vscode.WorkspaceConfiguration>();

when(mockedWorkspaceConfiguration.get<any>(anything(), anything())).thenCall((key: string, defaultValue?: unknown) =>
    (mockedConfigurationValues.has(key) ? mockedConfigurationValues.get(key) : defaultValue)
);

when(mockedWorkspaceConfiguration.inspect<any>(anything())).thenCall((key: string) => {
    const value = mockedConfigurationValues.get(key);
    return {
        key,
        defaultValue: undefined,
        globalValue: value,
        workspaceValue: value,
        workspaceFolderValue: value,
        defaultLanguageValue: undefined,
        globalLanguageValue: undefined,
        workspaceLanguageValue: undefined,
        workspaceFolderLanguageValue: undefined,
        languageIds: undefined
    };
});

when(mockedWorkspaceConfiguration.update(anything(), anything(), anything())).thenCall(
    (key: string, value: unknown, configurationTarget?: vscode.ConfigurationTarget | boolean | null) => {
        mockedConfigurationUpdates.push({ key, value, configurationTarget });
        if (value === undefined) {
            mockedConfigurationValues.delete(key);
        } else {
            mockedConfigurationValues.set(key, value);
        }
        return Promise.resolve();
    }
);
const workspaceConfigurationInstance = instance(mockedWorkspaceConfiguration);

const mockedWorkspace: Partial<typeof vscode.workspace> = {
    name: undefined,
    workspaceFile: undefined,
    getConfiguration: () => workspaceConfigurationInstance
};

export const mockWorkspaceNamespace = (
    mockedVSCode: Partial<VSCode> & { mockedWorkspace?: Partial<typeof vscode.workspace> }
) => {
    mockedVSCode.mockedWorkspace = mockedWorkspace;
    mockedVSCode.workspace = mockedWorkspace as typeof vscode.workspace;
};

export const resetMockedWorkspaceConfiguration = () => {
    mockedConfigurationValues.clear();
    mockedConfigurationUpdates.splice(0, mockedConfigurationUpdates.length);
};

export const setMockedWorkspaceConfigurationValue = (key: string, value: unknown): void => {
    if (value === undefined) {
        mockedConfigurationValues.delete(key);
    } else {
        mockedConfigurationValues.set(key, value);
    }
};

export const getMockedWorkspaceConfigurationValue = (key: string): unknown => {
    return mockedConfigurationValues.get(key);
};

export const getMockedWorkspaceConfigurationUpdates = () => {
    return [...mockedConfigurationUpdates];
};
