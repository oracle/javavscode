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
import { commands, OutputChannel, ProgressLocation, Uri, window } from "vscode";
import { nbCommands } from "./commands";
import { ProjectActionParams } from "../lsp/protocol";
import { LanguageClient } from "vscode-languageclient/node";
import { globalVars, LOGGER } from "../extension";
import { l10n } from "../localiser";
import { LogLevel } from "../logger";

export const getContextUri = (ctx: any): Uri | undefined => {
    if (ctx?.fsPath) {
        return ctx as Uri;
    }
    if (ctx?.resourceUri) {
        return ctx.resourceUri as Uri;
    }
    if (typeof ctx == 'string') {
        try {
            return Uri.parse(ctx, true);
        } catch (err) {
            return Uri.file(ctx);
        }
    }

    return window.activeTextEditor?.document?.uri;
}

export const isNbCommandRegistered = async (command: string) => {
    const registeredCommands = await commands.getCommands();
    return registeredCommands.includes(command);
}

/**
 * Executes a project action. It is possible to provide an explicit configuration to use (or undefined), display output from the action etc.
 * Arguments are attempted to parse as file or editor references or Nodes; otherwise they are attempted to be passed to the action as objects.
 *
 * @param action ID of the project action to run
 * @param configuration configuration to use or undefined - use default/active one.
 * @param title Title for the progress displayed in vscode
 * @param log output channel that should be revealed
 * @param showOutput if true, reveals the passed output channel
 * @param args additional arguments
 * @returns Promise for the command's result
 */
export const wrapProjectActionWithProgress = (action: string, configuration: string | undefined, title: string, log?: OutputChannel, showOutput?: boolean, ...args: any[]): Thenable<unknown> => {
    let items = [];
    let actionParams = {
        action: action,
        configuration: configuration,
    } as ProjectActionParams;
    for (let item of args) {
        let u: Uri | undefined;
        if (item?.fsPath) {
            items.push((item.fsPath as Uri).toString());
        } else if (item?.resourceUri) {
            items.push((item.resourceUri as Uri).toString());
        } else {
            items.push(item);
        }
    }
    return wrapCommandWithProgress(nbCommands.runProjectAction, title, log, showOutput, actionParams, ...items);
}

export const wrapCommandWithProgress = (lsCommand: string, title: string, log?: OutputChannel, showOutput?: boolean, ...args: any[]): Thenable<unknown> => {
    return window.withProgress({ location: ProgressLocation.Window }, p => {
        return new Promise(async (resolve, reject) => {
            let c: LanguageClient = await globalVars.clientPromise.client;
            if (await isNbCommandRegistered(lsCommand)) {
                p.report({ message: title });
                c.outputChannel.show(true);
                const start = new Date().getTime();
                try {
                    if (log) {
                        LOGGER.log(`starting ${lsCommand}`);
                    }
                    const res = await commands.executeCommand(lsCommand, ...args)
                    const elapsed = new Date().getTime() - start;
                    if (log) {
                        LOGGER.log(`finished ${lsCommand} in ${elapsed} ms with result ${res}`);
                    }
                    const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
                    setTimeout(() => { // set a timeout so user would still see the message when build time is short
                        if (res) {
                            resolve(res);
                        } else {
                            if (log) {
                                LOGGER.log(`Command ${lsCommand} takes too long to start`, LogLevel.ERROR);
                            }
                            reject(res);
                        }
                    }, humanVisibleDelay);
                } catch (err: any) {
                    if (log) {
                        LOGGER.log(`command ${lsCommand} executed with error: ${JSON.stringify(err)}`, LogLevel.ERROR);
                    }
                }
            } else {
                reject(l10n.value("jdk.extenstion.progressBar.error_msg.cannotRun", { lsCommand: lsCommand, client: c }));
            }
        });
    });
}