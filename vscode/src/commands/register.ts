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
import { commands, Disposable, ExtensionContext } from "vscode";
import { ICommand } from "./types";
import { registerCreateCommands } from "./create";
import { registerCacheCommands } from "./cache";
import { registerNavigationCommands } from "./navigation";
import { registerWebviewCommands } from "./webViews";
import { registerBuildOperationCommands } from "./buildOperations";
import { registerRefactorCommands } from "./refactor";
import { registerUtilCommands } from "./utilCommands";
import { registerDebugCommands } from "./debug";

type ICommandModules = Record<string, ICommand[]>;

const commandModules: ICommandModules = {
    create: registerCreateCommands,
    cache: registerCacheCommands,
    navigation: registerNavigationCommands,
    webview: registerWebviewCommands,
    buildOperations: registerBuildOperationCommands,
    refactor: registerRefactorCommands,
    util: registerUtilCommands,
    debug: registerDebugCommands
}

export const subscribeCommands = (context: ExtensionContext) => {
    for (const cmds of Object.values(commandModules)) {
        for (const command of cmds) {
            const cmdRegistered = registerCommand(command);
            if (cmdRegistered) {
                context.subscriptions.push(cmdRegistered);
            }
        }
    }
}

const registerCommand = (commandInfo: ICommand): Disposable | null => {
    const { command, handler } = commandInfo;
    if (command.trim().length && handler) {
        return commands.registerCommand(command, handler);
    }
    return null;
}
