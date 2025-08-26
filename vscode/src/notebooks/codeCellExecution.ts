/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { commands, NotebookCell, NotebookCellExecution, NotebookCellOutput, NotebookController } from "vscode";
import { LOGGER } from "../logger";
import { NotebookCellExecutionResult } from "../lsp/protocol";
import { createErrorOutputItem } from "./utils";
import { nbCommands } from "../commands/commands";
import { mimeTypes } from "./constants";
import { MimeTypeHandler } from "./mimeTypeHandler";

export class CodeCellExecution {
    private controller?: NotebookController;
    private execution?: NotebookCellExecution;
    private isExecutionStarted: boolean = false;
    private mimeMap = new Map<string, string>();
    private output: NotebookCellOutput = new NotebookCellOutput([]);
    private isError: boolean = false;

    constructor(
        private controllerId: string,
        private notebookId: string,
        private cell: NotebookCell
    ) { }

    public queued = async (controller: NotebookController | undefined) => {
        if (!controller) {
            LOGGER.warn(`Received undefined controller ${this.getCellId()}`);
            return;
        }
        LOGGER.debug(`${this.getCellId()} queued for execution`);
        this.controller = controller;
    }

    public executing = async (out: NotebookCellExecutionResult.Result | undefined,
        err: NotebookCellExecutionResult.Result | undefined,
        diagnostics: string[] | undefined,
        errorDiagnostics: string[] | undefined,
        metadata: any,
        executionOrder: number | undefined) => {

        if (!this.isExecutionStarted) {
            this.handleExecutionStart(executionOrder);
        }
        if (!this.execution) {
            return
        }

        if (out) {
            const { data, mimeType } = out;
            const newData = new TextDecoder().decode(Uint8Array.from(data));
            this.handleOutput(newData, mimeType);
        }

        if (err) {
            this.isError = true;
            const { data } = err;
            const newData = new TextDecoder().decode(Uint8Array.from(data));
            this.handleOutput(newData, mimeTypes.ERROR, true);
        }
        if (diagnostics) {
            diagnostics.forEach(diag => {
                this.handleOutput(diag + "\n", mimeTypes.TEXT);
            });
        }

        if (errorDiagnostics) {
            this.isError = true;
            errorDiagnostics.forEach(diag => {
                this.handleOutput(diag + "\n", mimeTypes.ERROR, true);
            });
        }
    }

    private handleOutput = async (data: string, mimeType: string, isError: boolean = false) => {
        const oldData = this.mimeMap.get(mimeType) ?? "";
        const updatedData = oldData + data;
        this.mimeMap.set(mimeType, updatedData);

        if (isError) {
            await this.execution!.replaceOutputItems(createErrorOutputItem(updatedData), this.output);
        } else {
            await this.execution!.replaceOutputItems(
                new MimeTypeHandler(mimeType).makeOutputItem(updatedData),
                this.output
            );
        }
    }

    public executionCompleted = (status: boolean) => {
        const finalExecStatus = status && !this.isError;
        if (this.isExecutionStarted) {
            status && !this.isError ?
                LOGGER.debug(`${this.getCellId()} successfully executed`)
                :
                LOGGER.error(`${this.getCellId()} failed while executing`);
            this.execution!.end(finalExecStatus, Date.now());
        }
    }

    public executionInterrupted = () => {
        if (this.isExecutionStarted) {
            LOGGER.log(`${this.getCellId()} interrupted while executing`);
            this.execution!.end(false, Date.now());
        }
    }

    private handleExecutionStart = async (executionOrder: number | undefined) => {
        if (this.controller) {
            this.execution = this.controller.createNotebookCellExecution(this.cell);
            this.isExecutionStarted = true;
            this.execution.start(Date.now());
            this.execution.executionOrder = executionOrder;
            this.execution.clearOutput();
            await this.execution.replaceOutput(this.output);
            this.execution.token.onCancellationRequested(async () => {
                await commands.executeCommand(nbCommands.interruptNotebookCellExecution, this.notebookId);
            });
            return;
        }
        LOGGER.warn(`Controller for cell is not created yet ${this.getCellId()}`);
    }

    public getCellId = () => this.cell.document.uri.toString();

    public getControllerId = () => this.controllerId;

    public getNotebookId = () => this.notebookId;
}