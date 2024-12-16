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
import { LOGGER } from '../logger';
import { configKeys } from "../configurations/configuration";
import { enableDisableModules } from "./utils";
import * as net from 'net';
import { ChildProcess } from "child_process";
import { isNbJavacDisabledHandler } from "../configurations/handlers";
import { attachNbProcessListeners, launchNbcode } from "./nbcode";
import { NbLanguageClient } from "./nbLanguageClient";
import { registerListenersAfterClientInit } from "../views/listener";
import { registerNotificationListeners } from "./listeners/notifications/register";
import { registerRequestListeners } from "./listeners/requests/register";
import { createViews } from "../views/initializer";
import { globalState } from "../globalState";
import { Telemetry } from "../telemetry/telemetry";

const establishConnection = () => new Promise<StreamInfo>((resolve, reject) => {
    const nbProcessManager = globalState.getNbProcessManager();
    const nbProcess = nbProcessManager?.getProcess();

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
        globalState.getNbProcessManager()?.disconnect();
        return;
    }
});

const connectToServer = (nbProcess: ChildProcess): Promise<net.Socket> => {
    return new Promise<net.Socket>((resolve, reject) => {
        if (!nbProcess.stdout) {
            reject('No stdout to parse!');
            return;
        }
        globalState.setDebugPort(-1);
        let lspServerStarted = false;
        nbProcess.stdout.on("data", (chunk) => {
            if (globalState.getDebugPort() < 0) {
                const info = chunk.toString().match(/Debug Server Adapter listening at port (\d*) with hash (.*)\n/);
                if (info) {
                    globalState.setDebugPort(info[1]);
                    globalState.setDebugHash(info[2]);
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
    const extensionPath = globalState.getExtensionContextInfo().getExtensionStorageUri().fsPath;
    enableDisableModules(extensionPath, userdirPath, ['org.netbeans.libs.nbjavacapi'], !nbjavacValue);
}

const serverBuilder = () => {
    enableDisableNbjavacModule();
    launchNbcode();
    return establishConnection;
}

export const clientInit = () => {
    globalState.setDeactivated(false);
    const connection: () => Promise<StreamInfo> = serverBuilder();
    const client = NbLanguageClient.build(connection, LOGGER);

    LOGGER.log('Language Client: Starting');
    client.start().then(() => {
        Telemetry.enqueueStartEvent();
        
        registerListenersAfterClientInit();
        registerNotificationListeners(client);
        registerRequestListeners(client);
        createViews();
        LOGGER.log('Language Client: Ready');
        globalState.getClientPromise().initializedSuccessfully(client);

    }).catch(globalState.getClientPromise().setClient[1]);
}
