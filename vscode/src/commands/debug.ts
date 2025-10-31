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

import * as vscode from 'vscode';
import { extCommands } from "./commands";
import { ICommand } from "./types";
import { extConstants } from '../constants';
import { getContextUriFromFile } from './utils';

const runTest = async (uri: any, methodName? : string, launchConfiguration?: string) => {
    await runDebug(true, true, uri, methodName, launchConfiguration);
}
const debugTest = async (uri: any, methodName? : string, launchConfiguration?: string) => {
    await runDebug(false, true, uri, methodName, launchConfiguration);
}
const runSingle = async (uri: any, methodName? : string, launchConfiguration?: string) => {
    await runDebug(true, false, uri, methodName, launchConfiguration);
}
const debugSingle = async (uri: any, methodName? : string, launchConfiguration?: string) => {
    await runDebug(false, false, uri, methodName, launchConfiguration);
}
const projectRun = async (node: any, launchConfiguration? : string) => {
    return runDebug(true, false, getContextUriFromFile(node)?.toString() || '',  undefined, launchConfiguration, true);
}
const projectDebug = async (node: any, launchConfiguration? : string) => {
    return runDebug(false, false, getContextUriFromFile(node)?.toString() || '',  undefined, launchConfiguration, true);
}
const projectTest = async (node: any, launchConfiguration? : string) => {
    return runDebug(true, true, getContextUriFromFile(node)?.toString() || '',  undefined, launchConfiguration, true);
}
const projectTestDebug = async (node: any, launchConfiguration? : string) => {
    return runDebug(false, true, getContextUriFromFile(node)?.toString() || '',  undefined, launchConfiguration, true);
}
const packageTest = async (uri: any, launchConfiguration? : string) => {
    await runDebug(true, true, uri, undefined, launchConfiguration);
}

const runDebug = async (noDebug: boolean, testRun: boolean, uri: any, methodName?: string, launchConfiguration?: string, project : boolean = false, ) => {
    const docUri = getContextUriFromFile(uri);
    if (docUri) {
        let debugConfig : vscode.DebugConfiguration = {
            type: extConstants.COMMAND_PREFIX,
            name: `Java ${project ? "Project" : "Single"} ${testRun ? "Test" : ""} ${noDebug ? "Run" : "Debug"} `,
            request: "launch"
        };
        if (methodName) {
            debugConfig['methodName'] = methodName;
        }
        if (launchConfiguration == '') {
            if (debugConfig['launchConfiguration']) {
                delete debugConfig['launchConfiguration'];
            }
        } else {
            debugConfig['launchConfiguration'] = launchConfiguration;
        }
        debugConfig['testRun'] = testRun;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
        if (project || testRun) {
            debugConfig['projectFile'] = docUri.toString();
            debugConfig['project'] = project;
        } else {
            debugConfig['mainClass'] =  docUri.toString();
        }
        const debugOptions : vscode.DebugSessionOptions = {
            noDebug: noDebug,
        }

        const ret = await vscode.debug.startDebugging(workspaceFolder, debugConfig, debugOptions);
        return ret ? new Promise((resolve) => {
            const listener = vscode.debug.onDidTerminateDebugSession(() => {
                listener.dispose();
                resolve(true);
            });
        }) : ret;
    }
};

export const registerDebugCommands: ICommand[] = [
    {
        command: extCommands.runTest,
        handler: runTest
    }, {
        command: extCommands.debugTest,
        handler: debugTest
    }, {
        command: extCommands.runSingle,
        handler: runSingle
    }, {
        command: extCommands.debugSingle,
        handler: debugSingle
    }, {
        command: extCommands.projectRun,
        handler: projectRun
    }, {
        command: extCommands.projectDebug,
        handler: projectDebug
    }, {
        command: extCommands.projectTest,
        handler: projectTest
    }, {
        command: extCommands.projectTestDebug,
        handler: projectTestDebug
    }, {
        command: extCommands.packageTest,
        handler: packageTest
    }
];
