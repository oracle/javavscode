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
import { appendPrefixToCommand } from "../utils"

export const configKeys = {
    jdkHome: 'jdkhome',
    projectJdkHome: 'project.jdkhome',
    lspVmOptions: 'serverVmOptions',
    disableNbJavac: 'advanced.disable.nbjavac',
    disableProjSearchLimit: 'advanced.disable.projectSearchLimit',
    formatPrefs: 'format',
    hintPrefs: 'hints',
    importPrefs: 'java.imports',
    runConfigVmOptions: 'runConfig.vmOptions',
    runConfigArguments: 'runConfig.arguments',
    runConfigCwd: 'runConfig.cwd',
    runConfigEnv: 'runConfig.env',
    verbose: 'verbose',
    userdir: 'userdir',
    revealInActivteProj: "revealActiveInProjects",
    telemetryEnabled: 'telemetry.enabled',
};

export const builtInConfigKeys = {
    vscodeTheme: 'workbench.colorTheme'
}

export const userConfigsListened: string[] = [
    appendPrefixToCommand(configKeys.jdkHome),
    appendPrefixToCommand(configKeys.userdir),
    appendPrefixToCommand(configKeys.lspVmOptions),
    appendPrefixToCommand(configKeys.disableNbJavac),
    appendPrefixToCommand(configKeys.disableProjSearchLimit),
    builtInConfigKeys.vscodeTheme,
];


export const userConfigsListenedByServer = [
    appendPrefixToCommand(configKeys.hintPrefs),
    appendPrefixToCommand(configKeys.formatPrefs),
    appendPrefixToCommand(configKeys.importPrefs),
    appendPrefixToCommand(configKeys.projectJdkHome),
    appendPrefixToCommand(configKeys.runConfigVmOptions),
    appendPrefixToCommand(configKeys.runConfigCwd)
];

