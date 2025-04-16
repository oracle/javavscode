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
import { workspace, commands, Uri, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { nbCommands, builtInCommands, extCommands } from "./commands";
import { l10n } from "../localiser";
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ICommand } from "./types";
import { getContextUri, isNbCommandRegistered } from "./utils";
import { isError, isString } from "../utils";
import { globalState } from "../globalState";
import { LOGGER } from "../logger";

const newFromTemplate = async (ctx: any, template: any) => {
    const client: LanguageClient = await globalState.getClientPromise().client;
    if (await isNbCommandRegistered(nbCommands.newFromTemplate)) {
        const workspaces = workspace.workspaceFolders;

        if (!workspaces) {
            const userHomeDir = os.homedir();
            const folderPath = await window.showInputBox({
                prompt: l10n.value('jdk.workspace.new.prompt'),
                value: `${userHomeDir}`
            });
            if (!folderPath?.trim()) return;

            if (!fs.existsSync(folderPath)) {
                await fs.promises.mkdir(folderPath);
            }
            const folderPathUri = Uri.file(folderPath);
            await commands.executeCommand(nbCommands.newFromTemplate, folderPathUri.toString());
            await commands.executeCommand(builtInCommands.openFolder, folderPathUri);

            return;
        }

        // first give the template (if present), then the context, and then the open-file hint in the case the context is not specific enough
        const params = [];
        if (isString(template)) {
            params.push(template);
        }
        params.push(getContextUri(ctx)?.toString(), window.activeTextEditor?.document?.uri?.toString());
        const res = await commands.executeCommand(nbCommands.newFromTemplate, ...params);

        if (isString(res)) {
            let newFile = Uri.parse(res as string);
            await window.showTextDocument(newFile, { preview: false });
        } else if (Array.isArray(res)) {
            for (let r of res) {
                if (isString(r)) {
                    let newFile = Uri.parse(r as string);
                    await window.showTextDocument(newFile, { preview: false });
                }
            }
        }
    } else {
        throw l10n.value("jdk.extension.error_msg.doesntSupportNewTeamplate", { client });
    }
}

const newProject = async (ctx: any) => {
    const client: LanguageClient = await globalState.getClientPromise().client;
    if (await isNbCommandRegistered(nbCommands.newProject)) {
        const res = await commands.executeCommand(nbCommands.newProject, getContextUri(ctx)?.toString());
        if (isString(res)) {
            let newProject = Uri.parse(res as string);

            const OPEN_IN_NEW_WINDOW = l10n.value("jdk.extension.label.openInNewWindow");
            const ADD_TO_CURRENT_WORKSPACE = l10n.value("jdk.extension.label.addToWorkSpace");

            const value = await window.showInformationMessage(l10n.value("jdk.extension.message.newProjectCreated"),
                OPEN_IN_NEW_WINDOW,
                ADD_TO_CURRENT_WORKSPACE);

            if (value === OPEN_IN_NEW_WINDOW) {
                await commands.executeCommand(builtInCommands.openFolder, newProject, true);
            } else if (value === ADD_TO_CURRENT_WORKSPACE) {
                workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, undefined, { uri: newProject });
            }
        }
    } else {
        throw l10n.value("jdk.extension.error_msg.doesntSupportNewProject", { client });
    }
};

const createNewNotebook = async () => {
    const userHomeDir = os.homedir();

    const filePath = await window.showInputBox({
        prompt: "Enter path for new Java notebook (.ijnb)",
        value: path.join(userHomeDir, "Untitled.ijnb")
    });

    if (!filePath?.trim()) {
        return;
    }

    const finalPath = filePath.endsWith('.ijnb') ? filePath : `${filePath}.ijnb`;

    LOGGER.log(`Attempting to create notebook at: ${finalPath}`);

    try {
        const exists = await fs.promises.access(finalPath)
            .then(() => true)
            .catch(() => false);

        if (exists) {
            window.showErrorMessage("Notebook already exists, please try creating with some different name");
            return;
        }

        const dir = path.dirname(finalPath);
        await fs.promises.mkdir(dir, { recursive: true });

        const emptyNotebook = {
            cells: [{
                cell_type: "code",
                source: [],
                metadata: {
                    language: "java"
                },
                execution_count: null,
                outputs: []
            }],
            metadata: {
                kernelspec: {
                    name: "java",
                    language: "java",
                    display_name: "Java"
                },
                language_info: {
                    name: "java"
                }
            },
            nbformat: 4,
            nbformat_minor: 5
        };

        await fs.promises.writeFile(finalPath, JSON.stringify(emptyNotebook, null, 2), { encoding: 'utf8' });

        LOGGER.log(`Created notebook at: ${finalPath}`);

        const notebookUri = Uri.file(finalPath);
        const notebookDocument = await workspace.openNotebookDocument(notebookUri);
        await window.showNotebookDocument(notebookDocument);
    } catch (err) {
        console.error(`Detailed error:`, err);
        window.showErrorMessage(`Failed to create notebook: ${isError(err) ? err.message : " "}`);
    }
};

export const registerCreateCommands: ICommand[] = [
    {
        command: extCommands.newFromTemplate,
        handler: newFromTemplate
    }, {
        command: extCommands.newProject,
        handler: newProject
    }, {
        command: extCommands.createNotebook,
        handler: createNewNotebook
    }
];