/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

'use strict';

import { ExtensionContext } from 'vscode';
import * as launchConfigurations from './launchConfigurations';
import { extConstants } from './constants';
import { clientInit } from './lsp/initializer';
import { subscribeCommands } from './commands/register';
import { VSNetBeansAPI } from './lsp/types';
import { registerDebugger } from './debugger/debugger';
import { registerConfigChangeListeners } from './configurations/listener';
import { registerFileProviders } from './lsp/listeners/textDocumentContentProvider';
import { ExtensionContextInfo } from './extensionContextInfo';
import { ClientPromise } from './lsp/clientPromise';
import { globalState } from './globalState';
import { Telemetry } from './telemetry/telemetry';

export function activate(context: ExtensionContext): VSNetBeansAPI {
    const contextInfo = new ExtensionContextInfo(context);
    globalState.initialize(contextInfo, new ClientPromise());
    globalState.getClientPromise().initialize();

    Telemetry.initializeTelemetry(contextInfo);
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
    Telemetry.enqueueCloseEvent();
    const process = globalState.getNbProcessManager()?.getProcess();
    if (process != null) {
        process?.kill();
    }
    return globalState.getClientPromise().stopClient();
}

