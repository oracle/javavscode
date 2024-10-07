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
import { commands, Position, window, Selection, Range, Uri } from "vscode";
import { builtInCommands, extCommands, nbCommands } from "./commands";
import { l10n } from "../localiser";
import * as path from 'path';
import { ICommand } from "./types";
import { LanguageClient } from "vscode-languageclient/node";
import { globalVars, LOGGER } from "../extension";
import { getContextUri, isNbCommandRegistered, wrapCommandWithProgress } from "./utils";

const goToTest = async (ctx: any) => {
    let client: LanguageClient = await globalVars.clientPromise.client;
    if (await isNbCommandRegistered(nbCommands.goToTest)) {
        try {
            const res: any = await commands.executeCommand(nbCommands.goToTest, getContextUri(ctx)?.toString());
            if ("errorMessage" in res) {
                throw new Error(res.errorMessage);
            }
            res?.providerErrors?.map((error: any) => {
                if (error?.message) {
                    window.showErrorMessage(error.message);
                }
            });
            if (res?.locations?.length) {
                if (res.locations.length === 1) {
                    const { file, offset } = res.locations[0];
                    const filePath = Uri.parse(file);
                    const editor = await window.showTextDocument(filePath, { preview: false });
                    if (offset != -1) {
                        const pos: Position = editor.document.positionAt(offset);
                        editor.selections = [new Selection(pos, pos)];
                        const range = new Range(pos, pos);
                        editor.revealRange(range);
                    }

                } else {
                    const namePathMapping: { [key: string]: string } = {}
                    res.locations.forEach((fp: any) => {
                        const fileName = path.basename(fp.file);
                        namePathMapping[fileName] = fp.file
                    });
                    const selected = await window.showQuickPick(Object.keys(namePathMapping), {
                        title: l10n.value("jdk.extension.fileSelector.label.selectFiles"),
                        placeHolder: l10n.value("jdk.extension.fileSelector.label.testFilesOrSourceFiles"),
                        canPickMany: true
                    });
                    if (selected) {
                        for await (const filePath of selected) {
                            let file = Uri.parse(filePath);
                            await window.showTextDocument(file, { preview: false });
                        }
                    } else {
                        window.showInformationMessage(l10n.value("jdk.extension.fileSelector.label.noFileSelected"));
                    }
                }
            }
        } catch (err: any) {
            window.showInformationMessage(err?.message || l10n.value("jdk.extension.fileSelector.label.noTestFound"));
        }
    } else {
        throw l10n.value("jdk.extenstion.error_msg.doesntSupportGoToTest", { client });
    }
}

const openTypeHandler = () => {
    wrapCommandWithProgress(nbCommands.quickOpen, l10n.value('jdk.extension.command.progress.quickOpen'), LOGGER.getOutputChannel(), true).then(() => {
        commands.executeCommand(builtInCommands.focusActiveEditorGroup);
    });
}

const openStackHandler = async (uri: any, methodName: any, fileName: any, line: any) => {
    const location: string | undefined = uri ? await commands.executeCommand(nbCommands.resolveStackLocation, uri, methodName, fileName) : undefined;
    if (location) {
        const lNum = line - 1;
        window.showTextDocument(Uri.parse(location), { selection: new Range(new Position(lNum, 0), new Position(lNum, 0)) });
    } else {
        if (methodName) {
            const fqn: string = methodName.substring(0, methodName.lastIndexOf('.'));
            commands.executeCommand(builtInCommands.quickAccess, '#' + fqn.substring(fqn.lastIndexOf('.') + 1));
        }
    }
}

export const registerNavigationCommands: ICommand[] = [
    {
        command: extCommands.openTest,
        handler: goToTest
    },{
        command: extCommands.openType,
        handler: openTypeHandler
    },{
        command: extCommands.openStackTrace,
        handler: openStackHandler
    }
];