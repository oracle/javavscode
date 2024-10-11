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
import { getUserConfigLaunchOptionsDefaults, prepareNbcodeLaunchOptions } from "./launchOptions";
import { globalVars, LOGGER } from "../extension";
import { configKeys } from "../configurations/configuration";
import { NbProcessManager } from "./nbProcessManager";
import { enableDisableModules, findNbcode } from "./utils";
import * as net from 'net';
import { extConstants, NODE_WINDOWS_LABEL } from "../constants";
import { l10n } from "../localiser";
import { window } from "vscode";
import { ChildProcess } from "child_process";
import { jdkDownloaderPrompt } from "../jdkDownloader/prompt";
import * as os from 'os';
import { LogLevel } from "../logger";
import { isNbJavacDisabledHandler } from "../configurations/handlers";

const launchNbcode = (): void => {
    const ideLaunchOptions = prepareNbcodeLaunchOptions();
    const userdir = getUserConfigLaunchOptionsDefaults()[configKeys.userdir].value;
    const specifiedJDK = getUserConfigLaunchOptionsDefaults()[configKeys.jdkHome].value;
    const extensionPath = globalVars.extensionInfo.getExtensionStorageUri().fsPath;
    const nbcodePath = findNbcode(extensionPath);

    const requiredJdk = specifiedJDK ? specifiedJDK : 'default system JDK';
    let launchMsg = l10n.value("jdk.extension.lspServer.statusBar.message.launching", {
        SERVER_NAME: extConstants.SERVER_NAME,
        requiredJdk: requiredJdk,
        userdir: userdir
    });
    LOGGER.log(launchMsg);
    window.setStatusBarMessage(launchMsg, 2000);

    globalVars.nbProcessManager = new NbProcessManager(userdir, nbcodePath, ideLaunchOptions);
    globalVars.nbProcessManager.startProcess();
}

const establishConnection = () => new Promise<StreamInfo>((resolve, reject) => {
    const nbProcess = globalVars.nbProcessManager?.getProcess();
    const nbProcessManager = globalVars.nbProcessManager;

    if (!nbProcessManager || !nbProcess) {
        reject();
        return;
    }

    LOGGER.log(`LSP server launching: ${nbProcessManager.getProcessId()}`);
    LOGGER.log(`LSP server user directory: ${getUserConfigLaunchOptionsDefaults()[configKeys.userdir].value}`);

    let status = false;
    nbProcess.stdout?.on('data', (d: any) => {
        status = processOnDataHandler(nbProcessManager, d.toString(), true);
    });
    nbProcess.stderr?.on('data', (d: any) => {
        processOnDataHandler(nbProcessManager, d.toString(), false);
    });
    nbProcess.on('close', (code: number) => {
        const status = processOnCloseHandler(nbProcessManager, code)
        if (status != null) {
            reject(status);
        }
    });

    try {
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

const processOnDataHandler = (nbProcessManager: NbProcessManager, text: string, isOut: boolean) => {
    if (nbProcessManager) {
        globalVars.clientPromise.activationPending = false;
    }
    LOGGER.logNoNL(text);
    isOut ? nbProcessManager.appendStdOut(text) : nbProcessManager.appendStdErr(text);

    if (nbProcessManager.getStdOut()?.match(/org.netbeans.modules.java.lsp.server/)) {
        return true;
    }
    return false;
}


const processOnCloseHandler = (nbProcessManager: NbProcessManager, code: number): string | null => {
    const globalnbProcessManager = globalVars.nbProcessManager;
    if (globalnbProcessManager == nbProcessManager) {
        globalVars.nbProcessManager = null;
        if (code != 0) {
            window.showWarningMessage(l10n.value("jdk.extension.lspServer.warning_message.serverExited", { SERVER_NAME: extConstants.SERVER_NAME, code: code }));
        }
    }
    if (nbProcessManager.getStdOut()?.match(/Cannot find java/) || (os.type() === NODE_WINDOWS_LABEL && !globalVars.deactivated)) {
        jdkDownloaderPrompt();
    }
    if (nbProcessManager.getStdOut() != null) {
        let match = nbProcessManager.getStdOut()!.match(/org.netbeans.modules.java.lsp.server[^\n]*/)
        if (match?.length == 1) {
            LOGGER.log(match[0]);
        } else {
            LOGGER.log("Cannot find org.netbeans.modules.java.lsp.server in the log!", LogLevel.ERROR);
        }
        LOGGER.log(`Please refer to troubleshooting section for more info: https://github.com/oracle/javavscode/blob/main/README.md#troubleshooting`);
        LOGGER.showOutputChannelUI(false);

        nbProcessManager.killProcess(false);
        return l10n.value("jdk.extension.error_msg.notEnabled", { SERVER_NAME: extConstants.SERVER_NAME });
    } else {
        LOGGER.log(`LSP server ${nbProcessManager.getProcessId()} terminated with ${code}`);
        LOGGER.log(`Exit code ${code}`);
    }
    return null;
}

const enableDisableNbjavacModule = () => {
    const userdirPath = getUserConfigLaunchOptionsDefaults()[configKeys.userdir].value
    const nbjavacValue = isNbJavacDisabledHandler();
    const extensionPath = globalVars.extensionInfo.getExtensionStorageUri().fsPath;
    enableDisableModules(extensionPath, userdirPath, ['org.netbeans.libs.nbjavacapi'], nbjavacValue);
}

const serverBuilder = () => {
    enableDisableNbjavacModule();
    launchNbcode();
    return establishConnection;
}

export const clientInit = () => {
    const connection: () => Promise<StreamInfo> = serverBuilder();
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