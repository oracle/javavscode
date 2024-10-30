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
import { builtInConfigKeys, configKeys } from "../configurations/configuration"
import { isDarkColorThemeHandler, isNetbeansVerboseEnabled, jdkHomeValueHandler, lspServerVmOptionsHandler, projectSearchRootsValueHandler, userdirHandler } from "../configurations/handlers";
import { l10n } from "../localiser";
import { isString } from "../utils";
import { userDefinedLaunchOptionsType } from "./types"

export const getUserConfigLaunchOptionsDefaults = (): userDefinedLaunchOptionsType => {
    return {
        [configKeys.jdkHome]: {
            value: jdkHomeValueHandler(),
            optionToPass: ['--jdkhome']
        },
        [configKeys.userdir]: {
            value: userdirHandler(),
            optionToPass: ['--userdir']
        },
        [configKeys.disableProjSearchLimit]: {
            value: projectSearchRootsValueHandler(),
            optionToPass: '-J-Dproject.limitScanRoot='
        }, 
        [configKeys.verbose]: {
            value: isNetbeansVerboseEnabled(),
            optionToPass: '-J-Dnetbeans.logger.console='
        },
        [builtInConfigKeys.vscodeTheme]: {
            value: isDarkColorThemeHandler() ? 'com.formdev.flatlaf.FlatDarkLaf' : null,
            optionToPass: ['--laf']
        },
        [configKeys.lspVmOptions]: {
            value: lspServerVmOptionsHandler()
        }
    };
};

const extraLaunchOptions = [
    "--modules",
    "--list",
    "-J-XX:PerfMaxStringConstLength=10240",
    "--locale", l10n.nbLocaleCode(),
    "--start-java-language-server=listen-hash:0",
    "--start-java-debug-adapter-server=listen-hash:0",
    "-J-DTopSecurityManager.disable=true"
];

const prepareUserConfigLaunchOptions = (): string[] => {
    const launchOptions: string[] = [];
    const userConfigLaunchOptionsDefaults = getUserConfigLaunchOptionsDefaults();
    Object.values(userConfigLaunchOptionsDefaults).forEach(userConfig => {
        const { value, optionToPass, encloseInvertedComma } = userConfig;
        if (value) {
            if (!optionToPass && Array.isArray(value)) {
                launchOptions.push(...value);
            }
            else if (isString(optionToPass)) {
                launchOptions.push(`${optionToPass}${value}`);
            } else if (Array.isArray(optionToPass)) {
                const arg: string[] = [...optionToPass, value];
                launchOptions.push(...arg);
            }
        }
    });

    return launchOptions;
}

export const prepareNbcodeLaunchOptions = (): string[] => {
    const nbcodeLaunchOptions = [];

    const userConfigLaunchOptions = prepareUserConfigLaunchOptions();
    nbcodeLaunchOptions.push(...userConfigLaunchOptions, ...extraLaunchOptions);

    return nbcodeLaunchOptions;
}