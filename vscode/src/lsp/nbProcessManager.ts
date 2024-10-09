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
import { LOGGER } from "../extension";
import { spawn, ChildProcessByStdio, ChildProcess } from 'child_process';
import { Readable } from "stream";
import { window } from "vscode";
import { l10n } from "../localiser";
import { extConstants } from "../constants";
import { LogLevel } from "../logger";

export class NbProcessManager {
    private process?: ChildProcess | null;
    private nbcodePath: string;
    private ideLaunchOptions: string[];
    private userdir: string;
    private stdOutText: string | null = "";
    private stdErrText: string = "";

    constructor(userdir: string, nbcodePath: string, ideLaunchOptions: string[]) {
        this.nbcodePath = nbcodePath;
        this.ideLaunchOptions = ideLaunchOptions;
        this.userdir = userdir;
    }

    startProcess = () => {
        const spawnProcess: ChildProcessByStdio<any, Readable, Readable> = spawn(this.nbcodePath,
            this.ideLaunchOptions,
            {
                cwd: this.userdir,
                stdio: ["ignore", "pipe", "pipe"]
            });
        this.process = spawnProcess;
    }

    killProcess = (notifyKill: boolean): Promise<void> => {
        LOGGER.log("Request to kill LSP server.");

        if (!this.process) {
            LOGGER.log("Cannot kill: No current process", LogLevel.ERROR);
            return Promise.resolve();
        }
        const processToKill = this.process;
        this.process = null;
        if (notifyKill) {
            window.setStatusBarMessage(
                l10n.value("jdk.extension.command.statusBar.message.restartingServer",
                    { SERVER_NAME: extConstants.SERVER_NAME }),
                2000);
        }

        return new Promise<void>((resolve, reject) => {
            processToKill.on('close', (code: number) => {
                LOGGER.log(`LSP server closed: ${processToKill.pid}`);
                resolve();
            });

            LOGGER.log(`Killing LSP server ${processToKill.pid}`);
            if (!processToKill.kill()) {
                reject(new Error("Cannot kill process"));
            }
        });
    }

    disconnect = () => {
        return this.process?.disconnect();
    }

    getProcess = () => {
        return this.process;
    }

    getProcessId = () => {
        return this.process?.pid;
    }

    appendStdOut = (text: string) => {
        if (this.stdOutText != null) {
            this.stdOutText += text;
        }
    }

    appendStdErr = (text: string) => {
        this.stdErrText += text;
    }

    getStdOut = () => {
        return this.stdOutText
    }
    
    setStdOut = (stdOut: string | null) => {
        this.stdOutText = stdOut;
    }

    getStdErr = () => {
        return this.stdErrText;
    }
}
