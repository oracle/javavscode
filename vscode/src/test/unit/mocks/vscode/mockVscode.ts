/*
  Copyright (c) 2023-2026, Oracle and/or its affiliates.

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

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { mockWindowNamespace } from './namespaces/window';
import { mockEnvNamespace } from './namespaces/env';
import { mockWorkspaceNamespace } from './namespaces/workspace';
import { mockedEnums } from './vscodeHostedTypes';
import { NotebookCellOutputItem } from './notebookCellOutputItem';
import { mock,instance } from "ts-mockito";
type VSCode = typeof vscode;
const mockedVSCode: Partial<VSCode> & {
    mockedExtns?: typeof vscode.extensions,
    mockedL10n?: typeof vscode.l10n,
    mockedWorkspace?: Partial<typeof vscode.workspace>
} = {};

class EventEmitter<T> {
    private listeners: Array<(event: T) => unknown> = [];
    readonly event = (listener: (event: T) => unknown): vscode.Disposable => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            }
        };
    };

    fire(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

class TreeItem {
    label?: string;
    description?: string;
    tooltip?: string;
    contextValue?: string;
    collapsibleState?: number;

    constructor(label: string) {
        this.label = label;
    }
}

const mockedVscodeClassesAndTypes = () => {
    mockedVSCode.Uri = URI as any;
    mockedVSCode.EventEmitter = EventEmitter as any;
    mockedVSCode.TreeItem = TreeItem as any;
    mockedVSCode.TreeItemCollapsibleState = mockedEnums.treeItemCollapsibleState;
    mockedVSCode.ViewColumn = mockedEnums.viewColumn;
    mockedVSCode.NotebookCellOutputItem = NotebookCellOutputItem as any;
}

const mockNamespaces = () => {
    mockWindowNamespace(mockedVSCode);
    mockEnvNamespace(mockedVSCode);
    mockWorkspaceNamespace(mockedVSCode);
    mockedVSCode.mockedExtns =  mock<typeof vscode.extensions>();
    mockedVSCode.mockedL10n =  mock<typeof vscode.l10n>();
    mockedVSCode.extensions = instance(mockedVSCode.mockedExtns);
    mockedVSCode.l10n = instance(mockedVSCode.mockedL10n);
}

export const initMockedVSCode = () => {
    mockedVscodeClassesAndTypes();
    mockNamespaces();    
    return mockedVSCode;
}

