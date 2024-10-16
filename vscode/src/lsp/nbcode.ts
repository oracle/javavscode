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

import { window } from "vscode";
import { configKeys } from "../configurations/configuration";
import { extConstants, NODE_WINDOWS_LABEL } from "../constants";
import { globalVars } from "../extension";
import { prepareNbcodeLaunchOptions, getUserConfigLaunchOptionsDefaults } from "./launchOptions";
import { NbProcessManager } from "./nbProcessManager";
import { findNbcode } from "./utils";
import { l10n } from "../localiser";
import { jdkDownloaderPrompt } from "../webviews/jdkDownloader/prompt";
import { LOGGER } from "../logger";
import * as os from 'os';

export const launchNbcode = (): void => {
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


export const attachNbProcessListeners = (nbProcessManager: NbProcessManager): void => {
    const nbProcess = nbProcessManager.getProcess();
    nbProcess?.stdout?.on('data', chunk => {
        processOnDataHandler(nbProcessManager, chunk.toString(), true);
    });
    nbProcess?.stderr?.on('data', chunk => {
        processOnDataHandler(nbProcessManager, chunk.toString(), false);
    });
    nbProcess?.on('close', (code: number) => {
        const status = processOnCloseHandler(nbProcessManager, code)
        if (status != null) {
            throw status;
        }
    });
}

const processOnDataHandler = (nbProcessManager: NbProcessManager, text: string, isOut: boolean) => {
    if (nbProcessManager) {
        globalVars.clientPromise.activationPending = false;
    }
    if (nbProcessManager.getStdOut() == null) {
        return;
    }
    LOGGER.logNoNL(text);
    isOut ? nbProcessManager.appendStdOut(text) : nbProcessManager.appendStdErr(text);

    if (nbProcessManager.getStdOut()?.match(/org.netbeans.modules.java.lsp.server/)) {
        nbProcessManager.setStdOut(null);
    }
}


const processOnCloseHandler = (nbProcessManager: NbProcessManager, code: number): string | null => {
    const globalnbProcessManager = globalVars.nbProcessManager;
    if (globalnbProcessManager == nbProcessManager) {
        globalVars.nbProcessManager = null;
        if (code && code != 0) {
            window.showWarningMessage(l10n.value("jdk.extension.lspServer.warning_message.serverExited", { SERVER_NAME: extConstants.SERVER_NAME, code }));
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
            LOGGER.error("Cannot find org.netbeans.modules.java.lsp.server in the log!");
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
