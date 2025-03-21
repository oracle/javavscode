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
import { ExtensionContext, window, commands, TreeView, TextEditor } from "vscode";
import { runConfigurationNodeProvider } from "./runConfiguration";
import { NbLanguageClient } from "../lsp/nbLanguageClient";
import { TreeViewService, Visualizer } from "./projects";
import { builtInCommands, extCommands } from "../commands/commands";
import { getConfigurationValue } from "../configurations/handlers";
import { configKeys } from "../configurations/configuration";
import { initializeRunConfiguration } from "../utils";
import { NbTestAdapter } from "./TestViewController";
import { globalState } from "../globalState";

export async function createViews() {
    const context = globalState.getExtensionContextInfo().getExtensionContext();
    createRunConfigurationView(context);
    const client = await globalState.getClientPromise().client;
    createProjectView(client);
    globalState.setTestAdapter(new NbTestAdapter());
}

function createRunConfigurationView(context: ExtensionContext) {
    initializeRunConfiguration().then(initialized => {
        if (initialized) {
            context.subscriptions.push(window.registerTreeDataProvider('run-config', runConfigurationNodeProvider));
            commands.executeCommand(builtInCommands.setCustomContext, 'runConfigurationInitialized', true);
        }
    });
}


async function createProjectView(client: NbLanguageClient) {
    const ts: TreeViewService = client.findTreeViewService();
    let tv: TreeView<Visualizer> = await ts.createView('foundProjects', 'Projects', { canSelectMany: false });

    async function revealActiveEditor(ed?: TextEditor) {
        const uri = window.activeTextEditor?.document?.uri;
        if (!uri || uri.scheme.toLowerCase() !== 'file') {
            return;
        }
        if (!tv.visible) {
            return;
        }
        let vis: Visualizer | undefined = await ts.findPath(tv, uri.toString());
        if (!vis) {
            return;
        }
        tv.reveal(vis, { select: true, focus: false, expand: false });
    }
    globalState.getExtensionContextInfo().pushSubscription(window.onDidChangeActiveTextEditor(ed => {
        if (getConfigurationValue(configKeys.revealInActivteProj)) {
            revealActiveEditor(ed);
        }
    }));
    globalState.getExtensionContextInfo().pushSubscription(commands.registerCommand(extCommands.selectEditorProjs, () => revealActiveEditor()));

    // attempt to reveal NOW:
    if (getConfigurationValue(configKeys.revealInActivteProj)) {
        revealActiveEditor();
    }
}