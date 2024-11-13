/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

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

import { ConfigurationTarget, extensions, workspace, WorkspaceConfiguration } from "vscode";
import { builtInConfigKeys, configKeys } from "./configuration";
import { extConstants, NODE_WINDOWS_LABEL } from "../constants";
import * as os from 'os';
import { LOGGER } from "../logger";
import * as path from 'path';
import * as fs from 'fs';
import { globalState } from "../globalState";

export const getConfiguration = (key: string = extConstants.COMMAND_PREFIX): WorkspaceConfiguration => {
    return workspace.getConfiguration(key);
}

export const getConfigurationValue = <T>(key: string, defaultValue: T | undefined = undefined): T => {
        const conf = getConfiguration();
        return defaultValue != undefined ? conf.get(key, defaultValue) : conf.get(key) as T;
}

export const updateConfigurationValue = <T>(key: string, newValue: T, configurationTarget: ConfigurationTarget | boolean | null = null): void => {
    getConfiguration().update(key, newValue, configurationTarget);
}

export const getBuiltinConfigurationValue = <T>(key: string, defaultValue: T | undefined = undefined): T => {
    const splitKey = key.split('.');
    const selector = splitKey?.[0];
    const conf = workspace.getConfiguration(selector);
    const confKey = splitKey?.slice(1)?.join('.');
    return defaultValue != undefined ? conf?.get(confKey, defaultValue) : conf?.get(confKey) as T;
}

export const inspectConfiguration = (config: string) => {
    return workspace.getConfiguration().inspect(config);
}

export const jdkHomeValueHandler = (): string | null => {
    return getConfigurationValue(configKeys.jdkHome) ||
        process.env.JDK_HOME ||
        process.env.JAVA_HOME ||
        null;
}

export const projectSearchRootsValueHandler = (): string => {
    let projectSearchRoots: string = '';
    const isProjectFolderSearchLimited: boolean = !getConfigurationValue(configKeys.disableProjSearchLimit, false);
    if (isProjectFolderSearchLimited) {
        try {
            projectSearchRoots = os.homedir() as string;
        } catch (err: any) {
            LOGGER.error(`Failed to obtain the user home directory due to: ${err}`);
        }
        if (!projectSearchRoots) {
            projectSearchRoots = os.type() === NODE_WINDOWS_LABEL ? '%USERPROFILE%' : '$HOME';   // The launcher script may perform the env variable substitution
            LOGGER.log(`Using userHomeDir = "${projectSearchRoots}" as the launcher script may perform env var substitution to get its value.`);
        }
        const workspaces = workspace.workspaceFolders;
        if (workspaces) {
            workspaces.forEach(workspace => {
                if (workspace.uri) {
                    try {
                        projectSearchRoots = projectSearchRoots + path.delimiter + path.normalize(workspace.uri.fsPath);
                    } catch (err: any) {
                        LOGGER.log(`Failed to get the workspace path: ${err}`);
                    }
                }
            });
        }
    }

    return projectSearchRoots;
}

export const lspServerVmOptionsHandler = (): string[] => {
    let serverVmOptions: string[] = getConfigurationValue(configKeys.lspVmOptions, []);

    return serverVmOptions.map(el => `-J${el}`);
}

export const isDarkColorThemeHandler = (): boolean => {
    const themeName: string = getBuiltinConfigurationValue(builtInConfigKeys.vscodeTheme);
    if (!themeName) {
        return false;
    }
    for (const ext of extensions.all) {
        const themeList: object[] = ext.packageJSON?.contributes && ext.packageJSON?.contributes['themes'];
        if (!themeList) {
            continue;
        }
        let t: any;
        for (t of themeList) {
            if (t.id !== themeName) {
                continue;
            }
            const uiTheme = t.uiTheme;
            if (typeof (uiTheme) == 'string') {
                if (uiTheme.includes('-dark') || uiTheme.includes('-black')) {
                    return true;
                }
            }
        }
    }
    return false;
}

export const userdirHandler = (): string => {
    const extensionContextInfo = globalState.getExtensionContextInfo();
    const userdirScope = process.env['nbcode_userdir'] || getConfigurationValue(configKeys.userdir, "local");
    const workspaceStoragePath = extensionContextInfo.getWorkspaceStorage()?.fsPath;
    const userdirParentDir = userdirScope === "local" && workspaceStoragePath
        ? workspaceStoragePath
        : extensionContextInfo.getGlobalStorage().fsPath;

    if (!userdirParentDir) {
        throw new Error(`Cannot create path for ${userdirScope} directory.`);
    }

    const userdir = path.join(userdirParentDir, "userdir");

    try {
        if (!fs.existsSync(userdir)) {
            fs.mkdirSync(userdir, { recursive: true });
            const stats = fs.statSync(userdir);
            if (!stats.isDirectory()) {
                throw new Error(`${userdir} is not a directory`);
            }
        }

        return userdir;
    } catch (error) {
        throw new Error(`Failed to create or access ${userdir}: ${(error as Error).message}`);
    }
}

export const isNbJavacDisabledHandler = (): boolean => {
    return getConfigurationValue(configKeys.disableNbJavac, false);
}

export const isNetbeansVerboseEnabled = (): boolean => {
    return getConfigurationValue(configKeys.verbose, false);
}