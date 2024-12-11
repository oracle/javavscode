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
import { commands, window } from "vscode";
import { builtInCommands, extCommands } from "./commands";
import { ICommand } from "./types";
import { l10n } from "../localiser";
import * as fs from 'fs';
import * as path from 'path';
import { globalState } from "../globalState";

const deleteCache = async () => {
    // TODO: Change workspace path to userdir path
    const storagePath = globalState.getExtensionContextInfo().getWorkspaceStorage()?.fsPath;
    if (!storagePath) {
        window.showErrorMessage(l10n.value("jdk.extension.cache.error_msg.cannotFindWrkSpacePath"));
        return;
    }

    const userDir = path.join(storagePath, "userdir");
    if (userDir && fs.existsSync(userDir)) {
        const yes = l10n.value("jdk.extension.cache.label.confirmation.yes")
        const cancel = l10n.value("jdk.extension.cache.label.confirmation.cancel")
        const confirmation = await window.showInformationMessage(l10n.value("jdk.extension.cache.message.confirmToDeleteCache"),
            yes, cancel);
        if (confirmation === yes) {
            const reloadWindowActionLabel = l10n.value("jdk.extension.cache.label.reloadWindow");
            try {
                await globalState.getClientPromise().stopClient();
                globalState.setDeactivated(true);
                await globalState.getNbProcessManager()?.killProcess(false);
                await fs.promises.rm(userDir, { recursive: true });
                await window.showInformationMessage(l10n.value("jdk.extension.message.cacheDeleted"), reloadWindowActionLabel);
            } catch (err) {
                await window.showErrorMessage(l10n.value("jdk.extension.error_msg.cacheDeletionError"), reloadWindowActionLabel);
            } finally {
                commands.executeCommand(builtInCommands.reloadWindow);
            }
        }
    } else {
        window.showErrorMessage(l10n.value("jdk.extension.cache.message.noUserDir"));
    }
}

export const registerCacheCommands: ICommand[] = [{
    command: extCommands.deleteCache,
    handler: deleteCache
}];