/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* This file has been modified for Oracle Java SE extension */

'use strict';

import { ExtensionContext, TextEditorDecorationType, Uri } from 'vscode';
import { NbTestAdapter } from './views/TestViewController';
import { SetTextEditorDecorationParams } from './lsp/protocol';
import * as launchConfigurations from './launchConfigurations';
import { extConstants } from './constants';
import { ExtensionInfo } from './extensionInfo';
import { ClientPromise } from './lsp/clientPromise';
import { NbProcessManager } from './lsp/nbProcessManager';
import { clientInit } from './lsp/initializer';
import { subscribeCommands } from './commands/register';
import { VSNetBeansAPI } from './lsp/types';
import { registerDebugger } from './debugger/debugger';
import { registerConfigChangeListeners } from './configurations/listener';
import { registerFileProviders } from './lsp/listeners/textDocumentContentProvider';

export namespace globalVars {
    export const listeners = new Map<string, string[]>();
    export let extensionInfo: ExtensionInfo;
    export let clientPromise: ClientPromise;
    export let debugPort: number = -1;
    export let debugHash: string | undefined;
    export let deactivated: boolean = true;
    export let nbProcessManager: NbProcessManager | null;
    export let testAdapter: NbTestAdapter | undefined;
    export let decorations = new Map<string, TextEditorDecorationType>();
    export let decorationParamsByUri = new Map<Uri, SetTextEditorDecorationParams>();
}


export function activate(context: ExtensionContext): VSNetBeansAPI {
    globalVars.clientPromise = new ClientPromise();
    globalVars.extensionInfo = new ExtensionInfo(context);

    globalVars.clientPromise.initialize();
    registerConfigChangeListeners(context);
    clientInit();

    registerDebugger(context);
    subscribeCommands(context);
    registerFileProviders(context);

    launchConfigurations.updateLaunchConfig();

    // register completions:
    launchConfigurations.registerCompletion(context);

    return Object.freeze({
        version: extConstants.API_VERSION,
        apiVersion: extConstants.API_VERSION
    });
}



export function deactivate(): Thenable<void> {
    const process = globalVars.nbProcessManager?.getProcess();
    if (process != null) {
        process?.kill();
    }
    return globalVars.clientPromise.stopClient();
}

