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
import { TextEditorDecorationType, Uri } from 'vscode';
import { NbTestAdapter } from './views/TestViewController';
import { SetTextEditorDecorationParams } from './lsp/protocol';
import { ExtensionContextInfo } from './extensionContextInfo';
import { ClientPromise } from './lsp/clientPromise';
import { NbProcessManager } from './lsp/nbProcessManager';

class GlobalState {
    private initialized: boolean = false;
    
    private listeners: Map<string, string[]>;
    private extensionContextInfo!: ExtensionContextInfo;
    private clientPromise!: ClientPromise;
    private debugPort: number;
    private debugHash?: string;
    // TODO: Find a way in nbcode.ts processOnCloseHandler to handle exit code, 
    // so that deactivated can be removed from global state 
    private deactivated: boolean;
    private nbProcessManager: NbProcessManager | null;
    private testAdapter?: NbTestAdapter;
    private decorations: Map<string, TextEditorDecorationType>;
    private decorationParamsByUri: Map<Uri, SetTextEditorDecorationParams>;

    public constructor() {
        this.listeners = new Map<string, string[]>();
        this.debugPort = -1;
        this.deactivated = true;
        this.nbProcessManager = null;
        this.decorations = new Map<string, TextEditorDecorationType>();
        this.decorationParamsByUri = new Map<Uri, SetTextEditorDecorationParams>();
    }

    public initialize(extensionContextInfo: ExtensionContextInfo, clientPromise: ClientPromise): void {
        if (this.initialized) {
            throw new Error('GlobalState has already been initialized');
        }
        
        this.clientPromise = clientPromise;
        this.extensionContextInfo = extensionContextInfo;
        this.initialized = true;
    }

    public getListener(key: string): string[] | undefined {
        return this.listeners.get(key);
    }

    public getExtensionContextInfo(): ExtensionContextInfo {
        return this.extensionContextInfo;
    }

    public getClientPromise(): ClientPromise {
        return this.clientPromise;
    }

    public getDebugPort(): number {
        return this.debugPort;
    }

    public getDebugHash(): string | undefined {
        return this.debugHash;
    }

    public isDeactivated(): boolean {
        return this.deactivated;
    }

    public getNbProcessManager(): NbProcessManager | null {
        return this.nbProcessManager;
    }

    public getTestAdapter(): NbTestAdapter | undefined {
        return this.testAdapter;
    }

    public getDecoration(key: string): TextEditorDecorationType | undefined {
        return this.decorations.get(key);
    }

    public getDecorationParamsByUri(): ReadonlyMap<Uri, SetTextEditorDecorationParams> {
        return this.decorationParamsByUri;
    }

    public getDecorationParamsByUriByKey(key: Uri): SetTextEditorDecorationParams | undefined {
        return this.decorationParamsByUri.get(key);
    }

    public addListener(key: string, value: string): void {
        const existing = this.listeners.get(key) || [];
        existing.push(value);
        this.listeners.set(key, existing);
    }

    public setDebugPort(port: number): void {
        this.debugPort = port;
    }

    public setDebugHash(hash: string): void {
        this.debugHash = hash;
    }

    public setDeactivated(state: boolean): void {
        this.deactivated = state;
    }

    public setNbProcessManager(manager: NbProcessManager | null): void {
        this.nbProcessManager = manager;
    }

    public setTestAdapter(adapter: NbTestAdapter | undefined): void {
        this.testAdapter = adapter;
    }

    public setDecoration(key: string, decoration: TextEditorDecorationType): void {
        this.decorations.set(key, decoration);
    }

    public setDecorationParams(uri: Uri, params: SetTextEditorDecorationParams): void {
        this.decorationParamsByUri.set(uri, params);
    }

    public removeDecoration(key: string): void {
        this.decorations.delete(key);
    }

    public removeDecorationParams(uri: Uri): void {
        this.decorationParamsByUri.delete(uri);
    }
}

export const globalState = new GlobalState();