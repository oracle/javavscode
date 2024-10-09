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
import { commands } from "vscode";
import { globalVars, LOGGER } from "../extension";
import { LogLevel } from "../logger";
import { NbProcessManager } from "./nbProcessManager";
import { clientInit } from "./initializer";
import { NbLanguageClient } from "./nbLanguageClient";

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
        globalVars.clientPromise.setClient[0](client);
        commands.executeCommand('setContext', 'nbJdkReady', true);
    }

    public stopClient = async (): Promise<void> => {
        if (globalVars.testAdapter) {
            globalVars.testAdapter.dispose();
            globalVars.testAdapter = undefined;
        }
        if (!this.client) {
            return Promise.resolve();
        }

        return (await this.client).stop();
    }

    public restartExtension = async (nbProcessManager: NbProcessManager | null, notifyKill: boolean) => {
        if (this.activationPending) {
            LOGGER.log("Server activation requested repeatedly, ignoring...", LogLevel.WARN);
            return;
        }
        if (!nbProcessManager) {
            LOGGER.log("Nbcode Process is null", LogLevel.ERROR);
            return;
        }
        try {
            await this.stopClient();
            await nbProcessManager.killProcess(notifyKill);
            this.initialize();
            clientInit();
        } catch (error) {
            LOGGER.log(`Error during activation: ${error}`, LogLevel.ERROR);
            throw error;
        } finally {
            this.activationPending = false;
        }
    }

}