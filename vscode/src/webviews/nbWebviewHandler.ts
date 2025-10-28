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
import { commands, Uri, ViewColumn, Webview, window, workspace } from "vscode";
import { HtmlPageParams } from "../lsp/protocol";
import { nbCommands } from "../commands/commands";
import { globalState } from "../globalState";

const webviews = new Map<string, Webview>();

export const showHtmlPage = async (params: HtmlPageParams): Promise<void> => {
    return new Promise(resolve => {
        let data = params.text;
        const extensionContext = globalState.getExtensionContextInfo();
        const match = /<title>(.*)<\/title>/i.exec(data);
        const name = match && match.length > 1 ? match[1] : '';
        const resourceDir = Uri.joinPath(extensionContext.getGlobalStorage(), params.id);
        workspace.fs.createDirectory(resourceDir);
        let view = window.createWebviewPanel('htmlView', name, ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [resourceDir]
        });
        webviews.set(params.id, view.webview);
        const resources = params.resources;
        if (resources) {
            for (const resourceName in resources) {
                const resourceText = resources[resourceName];
                const resourceUri = Uri.joinPath(resourceDir, resourceName);
                workspace.fs.writeFile(resourceUri, Buffer.from(resourceText, 'utf8'));
                data = data.replace(`href="${resourceName}"`, `href="${view.webview.asWebviewUri(resourceUri)}"`);
            }
        }
        view.webview.html = data;
        view.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'dispose':
                    webviews.delete(params.id);
                    view.dispose();
                    break;
                case 'command':
                    commands.executeCommand(nbCommands.htmlProcessCmd, message.data);
                    break;
            }
        });
        view.onDidDispose(() => {
            resolve();
            workspace.fs.delete(resourceDir, { recursive: true });
        });
    });
}

export const execInHtmlPage = (params: HtmlPageParams): Promise<boolean> => {
    return new Promise(resolve => {
        const webview = webviews.get(params.id);
        if (webview) {
            webview.postMessage({
                execScript: params.text,
                pause: params.pause
            }).then(ret => {
                resolve(ret);
            });
        }
        resolve(false);
    });
}