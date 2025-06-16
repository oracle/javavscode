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
import { commands, window } from "vscode";
import { LOGGER } from "../logger";
import { NbProcessManager } from "./nbProcessManager";
import { clientInit } from "./initializer";
import { NbLanguageClient } from "./nbLanguageClient";
import { globalState } from "../globalState";
import { l10n } from "../localiser";

export class ClientPromise {
    setClient!: [(c: NbLanguageClient) => void, (err: any) => void];
    client!: Promise<NbLanguageClient>;
    activationPending: boolean = true;

    public initialize = (): void => {
        this.client = new Promise<NbLanguageClient>((clientOK, clientErr) => {
            this.setClient = [
                (c: NbLanguageClient) => {
                    clientOK(c);
                },
                (err: any) => {
                    clientErr(err);
                }
            ];
        });

        this.activationPending = true;
        commands.executeCommand('setContext', 'nbJdkReady', false);
    }

    public initializedSuccessfully = (client: NbLanguageClient) => {
        globalState.getClientPromise().setClient[0](client);
        commands.executeCommand('setContext', 'nbJdkReady', true);
    }

    public stopClient = async (): Promise<void> => {
        const testAdapter = globalState.getTestAdapter();
        if (testAdapter) {
            testAdapter.dispose();
            globalState.setTestAdapter(undefined);
        }
        if (!this.client) {
            return Promise.resolve();
        }

        return (await this.client).stop();
    }

    public restartExtension = async (nbProcessManager: NbProcessManager | null, notifyKill: boolean) => {
        if (nbProcessManager) {
            try {
                globalState.setDeactivated(true);
                await this.stopClient();
                await nbProcessManager.killProcess(notifyKill);
                this.initialize();
                clientInit();
            } catch (error) {
                LOGGER.error(`Error during activation: ${error}`);
                const reloadNow: string = l10n.value("jdk.downloader.message.reload");
                const dialogBoxMessage = l10n.value("jdk.configChangedFailed");
                const selected = await window.showInformationMessage(dialogBoxMessage, reloadNow);
                if (selected === reloadNow) {
                    await commands.executeCommand('workbench.action.reloadWindow');
                }
            } finally {
                this.activationPending = false;
            }
        }else{
            LOGGER.error("Nbcode Process is null");
            const reloadNow: string = l10n.value("jdk.downloader.message.reload");
            const dialogBoxMessage = l10n.value("jdk.configChanged");
            const selected = await window.showInformationMessage(dialogBoxMessage, reloadNow);
            if (selected === reloadNow) {
                await commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }

}