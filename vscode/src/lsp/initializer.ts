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
import { StreamInfo } from "vscode-languageclient/node";
import { getUserConfigLaunchOptionsDefaults } from "./launchOptions";
import { globalVars, LOGGER } from "../extension";
import { configKeys } from "../configurations/configuration";
import { enableDisableModules } from "./utils";
import * as net from 'net';
import { ChildProcess } from "child_process";
import { getConfigurationValue, isNbJavacDisabledHandler } from "../configurations/handlers";
import { attachNbProcessListeners, launchNbcode } from "./nbcode";
import { NbLanguageClient } from "./nbLanguageClient";
import { NbTestAdapter } from "../testAdapter";
import { registerListenersAfterClientInit } from "../listener";
import { registerNotificationListeners } from "./listeners/notifications/register";
import { registerRequestListeners } from "./listeners/requests/register";
import { TreeViewService, Visualizer } from "../explorer";
import { commands, TextEditor, TreeView, window, workspace } from "vscode";
import { extConstants } from "../constants";
import { extCommands } from "../commands/commands";

const establishConnection = () => new Promise<StreamInfo>((resolve, reject) => {
    const nbProcess = globalVars.nbProcessManager?.getProcess();
    const nbProcessManager = globalVars.nbProcessManager;

    if (!nbProcessManager || !nbProcess) {
        reject();
        return;
    }

    LOGGER.log(`LSP server launching: ${nbProcessManager.getProcessId()}`);
    LOGGER.log(`LSP server user directory: ${getUserConfigLaunchOptionsDefaults()[configKeys.userdir].value}`);

    try {
        attachNbProcessListeners(nbProcessManager);
        connectToServer(nbProcess).then(server => resolve({
            reader: server,
            writer: server
        })).catch(err => { throw err });
    } catch (err) {
        reject(err);
        globalVars.nbProcessManager?.disconnect();
        return;
    }
});

const connectToServer = (nbProcess: ChildProcess): Promise<net.Socket> => {
    return new Promise<net.Socket>((resolve, reject) => {
        if (!nbProcess.stdout) {
            reject('No stdout to parse!');
            return;
        }
        globalVars.debugPort = -1;
        let lspServerStarted = false;
        nbProcess.stdout.on("data", (chunk) => {
            if (globalVars.debugPort < 0) {
                const info = chunk.toString().match(/Debug Server Adapter listening at port (\d*) with hash (.*)\n/);
                if (info) {
                    globalVars.debugPort = info[1];
                    globalVars.debugHash = info[2];
                }
            }
            if (!lspServerStarted) {
                const info = chunk.toString().match(/Java Language Server listening at port (\d*) with hash (.*)\n/);
                if (info) {
                    const port: number = info[1];
                    const server = net.connect(port, "127.0.0.1", () => {
                        server.write(info[2]);
                        resolve(server);
                    });
                    lspServerStarted = true;
                }
            }
        });
        nbProcess.once("error", (err) => {
            reject(err);
        });
    });
}

const enableDisableNbjavacModule = () => {
    const userdirPath = getUserConfigLaunchOptionsDefaults()[configKeys.userdir].value
    const nbjavacValue = isNbJavacDisabledHandler();
    const extensionPath = globalVars.extensionInfo.getExtensionStorageUri().fsPath;
    enableDisableModules(extensionPath, userdirPath, ['org.netbeans.libs.nbjavacapi'], !nbjavacValue);
}

const serverBuilder = () => {
    enableDisableNbjavacModule();
    launchNbcode();
    return establishConnection;
}

export const clientInit = () => {
    const connection: () => Promise<StreamInfo> = serverOptionsBuilder();
    const client = NbLanguageClient.build(connection, LOGGER);
    
    LOGGER.log('Language Client: Starting');
    client.start().then(() => {
        globalVars.testAdapter = new NbTestAdapter();
        
        registerListenersAfterClientInit();
        registerNotificationListeners(client);
        registerRequestListeners(client);
        
        LOGGER.log('Language Client: Ready');
        globalVars.clientPromise.initializedSuccessfully(client);
    
        createProjectView(client);
    }).catch(globalVars.clientPromise.setClient[1]);
}


async function createProjectView(client : NbLanguageClient) {
    const ts : TreeViewService = client.findTreeViewService();
    let tv : TreeView<Visualizer> = await ts.createView('foundProjects', 'Projects', { canSelectMany : false });

    async function revealActiveEditor(ed? : TextEditor) {
        const uri = window.activeTextEditor?.document?.uri;
        if (!uri || uri.scheme.toLowerCase() !== 'file') {
            return;
        }
        if (!tv.visible) {
            return;
        }
        let vis : Visualizer | undefined = await ts.findPath(tv, uri.toString());
        if (!vis) {
            return;
        }
        tv.reveal(vis, { select : true, focus : false, expand : false });
    }
    const netbeansConfig = workspace.getConfiguration(extConstants.COMMAND_PREFIX);
    globalVars.extensionInfo.pushSubscription(window.onDidChangeActiveTextEditor(ed => {
        if (netbeansConfig.get("revealActiveInProjects")) {
            revealActiveEditor(ed);
        }
    }));
    globalVars.extensionInfo.pushSubscription(commands.registerCommand(extCommands.selectEditorProjs, () => revealActiveEditor()));

    // attempt to reveal NOW:
    if (getConfigurationValue(configKeys.revealInActivteProj)) {
        revealActiveEditor();
    }
}