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
import { OutputChannel, window } from "vscode";
import { extConstants } from "./constants";

enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
}

export class ExtensionLogger {
    private outChannel: OutputChannel;

    constructor(channelName: string) {
        this.outChannel = window.createOutputChannel(channelName);
    }

    public log(message: string): void {
        const formattedMessage = `[${LogLevel.INFO}]: ${message}`;
        this.printLog(formattedMessage);
    }

    public warn(message: string): void {
        const formattedMessage = `[${LogLevel.WARN}]: ${message}`;
        this.printLog(formattedMessage);
    }

    public error(message: string): void {
        const formattedMessage = `[${LogLevel.ERROR}]: ${message}`;
        this.printLog(formattedMessage);
    }

    public debug(message: string): void {
        if(process.env['debug_logs']){
            const formattedMessage = `[${LogLevel.DEBUG}]: ${message}`;
            this.printLog(formattedMessage);
        }
    }

    public logNoNL(message: string): void {
        this.outChannel.append(message);
    }

    public showOutputChannelUI(show: boolean): void {
        this.outChannel.show(show);
    }
    
    public getOutputChannel(): OutputChannel {
        return this.outChannel;
    }

    public dispose(): void {
        this.outChannel.dispose();
    }

    private printLog(message: string): void{
        const timestamp = new Date().toISOString();
        this.outChannel.appendLine(`[${timestamp}] ${message}`);
    }
}

export const LOGGER = new ExtensionLogger(extConstants.SERVER_NAME);