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
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { CloseAction, CloseHandlerResult, DocumentSelector, ErrorAction, ErrorHandlerResult, Message, RevealOutputChannelOn } from "vscode-languageclient";
import { createTreeViewService, TreeViewService } from "../views/projects";
import { OutputChannel, workspace } from "vscode";
import { extConstants } from "../constants";
import { userConfigsListenedByServer } from '../configurations/configuration';
import { restartWithJDKLater } from './utils';
import { ExtensionLogger } from '../logger';
import { globalState } from '../globalState';
import { Telemetry } from '../telemetry/telemetry';


export class NbLanguageClient extends LanguageClient {
    private _treeViewService: TreeViewService;
    constructor(id: string, name: string, s: ServerOptions, log: OutputChannel, c: LanguageClientOptions) {
        super(id, name, s, c);
        this._treeViewService = createTreeViewService(log, this);
    }

    static build = (serverOptions: ServerOptions, logger: ExtensionLogger): NbLanguageClient => {
        let documentSelectors: DocumentSelector = [
            { language: extConstants.LANGUAGE_ID },
            { language: 'properties', pattern: '**/*.properties' },
            { language: 'jackpot-hint' },
            { language: 'xml', pattern: '**/pom.xml' },
            { pattern: '*.gradle' },
            { pattern: '*.gradle.kts' }
        ];

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            // Register the server for java documents
            documentSelector: documentSelectors,
            synchronize: {
                configurationSection: userConfigsListenedByServer,
                fileEvents: [
                    workspace.createFileSystemWatcher('**/*.java')
                ]
            },
            outputChannel: logger.getOutputChannel(),
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            progressOnInitialization: true,
            initializationOptions: {
                'nbcodeCapabilities': {
                    'statusBarMessageSupport': true,
                    'testResultsSupport': true,
                    'showHtmlPageSupport': true,
                    'wantsJavaSupport': true,
                    'wantsGroovySupport': false,
                    'wantsTelemetryEnabled': Telemetry.isTelemetryFeatureAvailable,
                    'commandPrefix': extConstants.COMMAND_PREFIX,
                    'configurationPrefix': `${extConstants.COMMAND_PREFIX}.`,
                    'altConfigurationPrefix': `${extConstants.COMMAND_PREFIX}.`
                }
            },
            errorHandler: {
                error: function (error: Error, _message: Message, count: number): ErrorHandlerResult {
                    return { action: ErrorAction.Continue, message: error.message };
                },
                closed: function (): CloseHandlerResult {
                    logger.warn(`Connection to ${extConstants.SERVER_NAME} closed.`);
                    if (!globalState.getClientPromise().activationPending) {
                        restartWithJDKLater(10000, false);
                    }
                    return { action: CloseAction.DoNotRestart };
                }
            }
        }

        return new NbLanguageClient(
            extConstants.NB_LANGUAGE_CLIENT_ID,
            extConstants.NB_LANGUAGE_CLIENT_NAME,
            serverOptions,
            logger.getOutputChannel(),
            clientOptions
        )
    }

    findTreeViewService(): TreeViewService {
        return this._treeViewService;
    }

    stop(): Promise<void> {
        const r: Promise<void> = super.stop();
        this._treeViewService.dispose();
        return r;
    }

}
