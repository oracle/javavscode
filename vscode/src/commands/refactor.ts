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
import { commands, window, Uri, Range, Location, workspace, Position } from "vscode";
import { ICommand } from "./types";
import { extConstants } from "../constants";
import { builtInCommands, extCommands, nbCommands } from "./commands";
import { l10n } from "../localiser";
import { globalVars } from "../extension";
import { WorkspaceEdit } from 'vscode-languageserver-protocol';
import { SymbolInformation } from 'vscode-languageclient';

const goToSuperImplementationHandler = async () => {
    if (window.activeTextEditor?.document.languageId !== extConstants.LANGUAGE_ID) {
        return;
    }
    const uri = window.activeTextEditor.document.uri;
    const position = window.activeTextEditor.selection.active;
    const locations: any[] = await commands.executeCommand(nbCommands.superImpl, uri.toString(), position) || [];
    return commands.executeCommand(builtInCommands.goToEditorLocations, window.activeTextEditor.document.uri, position,
        locations.map(location => new Location(Uri.parse(location.uri), new Range(location.range.start.line, location.range.start.character, location.range.end.line, location.range.end.character))),
        'peek', l10n.value('jdk.extension.error_msg.noSuperImpl'));
}

const renameElementHandler = async (offset: any) => {
    const editor = window.activeTextEditor;
    if (editor) {
        await commands.executeCommand(builtInCommands.renameSymbol, [
            editor.document.uri,
            editor.document.positionAt(offset),
        ]);
    }
}

const surroundWithHandler = async (items: any) => {
    const selected: any = await window.showQuickPick(items, { placeHolder: l10n.value('jdk.extension.command.quickPick.placeholder.surroundWith') });
    if (selected) {
        if (selected.userData.edit) {
            const client = await globalVars.clientPromise.client;
            const edit = await client.protocol2CodeConverter.asWorkspaceEdit(selected.userData.edit as WorkspaceEdit);
            await workspace.applyEdit(edit);
            await commands.executeCommand(builtInCommands.focusActiveEditorGroup);
        }
        await commands.executeCommand(selected.userData.command.command, ...(selected.userData.command.arguments || []));
    }
}

const codeGenerateHandler = async (command: any, data: any) => {
    const edit: any = await commands.executeCommand(command, data);
    if (edit) {
        const client = await globalVars.clientPromise.client;
        const wsEdit = await client.protocol2CodeConverter.asWorkspaceEdit(edit as WorkspaceEdit);
        await workspace.applyEdit(wsEdit);
        await commands.executeCommand(builtInCommands.focusActiveEditorGroup);
    }
}

const completeAbstractMethodsHandler = async () => {
    const active = window.activeTextEditor;
    if (active) {
        const position = new Position(active.selection.start.line, active.selection.start.character);
        await commands.executeCommand(nbCommands.implementAbstractMethods, active.document.uri.toString(), position);
    }
}

const workspaceSymbolsHandler = async (query: any) => {
    const client = await globalVars.clientPromise.client;
    return (await client.sendRequest<SymbolInformation[]>("workspace/symbol", { "query": query })) ?? [];
}


export const registerRefactorCommands: ICommand[] = [
    {
        command: extCommands.goToSuperImpl,
        handler: goToSuperImplementationHandler
    }, {
        command: extCommands.renameElement,
        handler: renameElementHandler
    }, {
        command: extCommands.surroundWith,
        handler: surroundWithHandler
    }, {
        command: extCommands.generateCode,
        handler: codeGenerateHandler
    }, {
        command: extCommands.abstractMethodsComplete,
        handler: completeAbstractMethodsHandler
    }, {
        command: extCommands.workspaceSymbols,
        handler: workspaceSymbolsHandler
    }
];