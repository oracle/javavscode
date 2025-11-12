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

import { globalState } from '../globalState';
import { isNbCommandRegistered } from '../commands/utils';
import { nbCommands } from '../commands/commands';
import { NotebookCellExecutionResult } from '../lsp/protocol';
import { NotebookCell, NotebookController, NotebookDocument, Disposable, notebooks, commands, NotebookCellOutput, workspace, Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { l10n } from '../localiser';
import { ijnbConstants, ipynbConstants, supportLanguages } from './constants';
import { LOGGER } from '../logger';
import { CodeCellExecution } from './codeCellExecution';
import { isError, isString } from '../utils';
import { MimeTypeHandler } from './mimeTypeHandler';
import { createErrorOutput } from './utils';

export class IJNBKernel implements Disposable {
  private readonly controllers: NotebookController[] = [];
  private cellControllerIdMap = new Map<string, CodeCellExecution>();
  static executionCounter = new Map<string, number>();

  constructor() {
    const custom = notebooks.createNotebookController(
      ijnbConstants.KERNEL_ID,
      ijnbConstants.NOTEBOOK_TYPE,
      ijnbConstants.KERNEL_LABEL
    );

    const jupyter = notebooks.createNotebookController(
      ipynbConstants.KERNEL_ID,
      ipynbConstants.NOTEBOOK_TYPE,
      ipynbConstants.KERNEL_LABEL
    );

    for (const ctr of [custom, jupyter]) {
      ctr.supportedLanguages = [supportLanguages.JAVA, supportLanguages.MARKDOWN];
      ctr.supportsExecutionOrder = true;
      ctr.executeHandler = this.executeCells.bind(this);
      this.controllers.push(ctr);
    }
  }

  dispose(): void {
    for (const ctr of this.controllers) {
      ctr.dispose();
    }
  }

  private async executeCells(
    cells: NotebookCell[],
    notebook: NotebookDocument,
    controller: NotebookController
  ): Promise<void> {
    const notebookId = notebook.uri.toString();

    for (const cell of cells) {
      if (cell.document.languageId === supportLanguages.MARKDOWN) {
        await this.handleMarkdownCellExecution(notebookId, cell, controller);
      } else if (cell.document.languageId === supportLanguages.JAVA) {
        await this.handleCodeCellExecution(notebookId, cell, controller);
      } else {
        await this.handleUnkownLanguageTypeExecution(notebookId, cell, controller);
      }
    }
  }

  private handleCodeCellExecution = async (notebookId: string, cell: NotebookCell, controller: NotebookController) => {
    const cellId = cell.document.uri.toString();
    const sourceCode = cell.document.getText();
    const codeCellExecution = new CodeCellExecution(controller.id, notebookId, cell);
    this.getIncrementedExecutionCounter(notebookId);
    try {
      this.cellControllerIdMap.set(cellId, codeCellExecution);
      const client: LanguageClient = await globalState.getClientPromise().client;

      if (!(await isNbCommandRegistered(nbCommands.executeNotebookCell))) {
        throw l10n.value("jdk.extension.error_msg.doesntSupportNotebookCellExecution", { client: client?.name });
      }

      const response = await commands.executeCommand<string>(nbCommands.executeNotebookCell,
        notebookId,
        cellId,
        sourceCode);

      if (!response) {
        LOGGER.error(`Some error occurred while cell execution: ${cellId}`);
      }
    } catch (error) {
      LOGGER.error(isError(error) ? error.message : String(error));
    } finally {
      this.cellControllerIdMap.delete(cellId);
    }
  }

  public handleCellExecutionNotification = async (params: NotebookCellExecutionResult.params) => {
    const codeCellExecution = this.cellControllerIdMap.get(params.cellUri);
    if (!codeCellExecution) {
      LOGGER.warn(`There is no code cell execution object created for ${params.cellUri}`);
      return;
    }
    switch (params.status) {
      case NotebookCellExecutionResult.STATUS.QUEUED:
        const controller = this.controllers.find(el => el.id === codeCellExecution.getControllerId());
        codeCellExecution.queued(controller);
        break;
      case NotebookCellExecutionResult.STATUS.EXECUTING:
        const { outputStream, errorStream, diagnostics, errorDiagnostics, metadata } = params;
        await codeCellExecution.executing(outputStream, errorStream, diagnostics, errorDiagnostics, metadata, this.getExecutionCounter(codeCellExecution.getNotebookId()));
        break;
      case NotebookCellExecutionResult.STATUS.SUCCESS:
        codeCellExecution.executionCompleted(true);
        this.cellControllerIdMap.delete(params.cellUri);
        break;
      case NotebookCellExecutionResult.STATUS.FAILURE:
        codeCellExecution.executionCompleted(false);
        this.cellControllerIdMap.delete(params.cellUri);
        break;
      case NotebookCellExecutionResult.STATUS.INTERRUPTED:
        codeCellExecution.executionInterrupted();
        this.cellControllerIdMap.delete(params.cellUri);
        break;
    }
  }

  private handleUnkownLanguageTypeExecution = async (notebookId: string, cell: NotebookCell, controller: NotebookController) => {
    const exec = controller.createNotebookCellExecution(cell);
    exec.executionOrder = this.getIncrementedExecutionCounter(notebookId);
    exec.start(Date.now());
    await exec.replaceOutput(createErrorOutput(new Error(l10n.value("jdk.notebook.cell.language.not.found", { languageId: cell.document.languageId }))));
    exec.end(false, Date.now());
  }

  private getIncrementedExecutionCounter = (notebookId: string) => {
    const next = (IJNBKernel.executionCounter.get(notebookId) ?? 0) + 1;
    IJNBKernel.executionCounter.set(notebookId, next);
    return next;
  }

  private getExecutionCounter = (notebookId: string) => {
    return IJNBKernel.executionCounter.get(notebookId);
  }

  private handleMarkdownCellExecution = async (notebookId: string, cell: NotebookCell, controller: NotebookController) => {
    const exec = controller.createNotebookCellExecution(cell);
    const mimeType = 'text/markdown';
    exec.executionOrder = this.getIncrementedExecutionCounter(notebookId);
    try {
      exec.start(Date.now());
      await exec.replaceOutput([
        new NotebookCellOutput([new MimeTypeHandler(mimeType).makeOutputItem(cell.document.getText())]),
      ]);
      exec.end(true, Date.now());
    } catch (error) {
      await exec.replaceOutput(createErrorOutput(error as Error));
      exec.end(false, Date.now());
    }
  }

  cleanUpKernel = workspace.onDidCloseNotebookDocument(doc => {
    if (doc.notebookType === ijnbConstants.NOTEBOOK_TYPE || doc.notebookType === ipynbConstants.NOTEBOOK_TYPE) {
      IJNBKernel.executionCounter.delete(doc.uri.toString());
    }
  });

  public resetKernelCounter(notebookUri: Uri): void {
    IJNBKernel.executionCounter.delete(notebookUri.toString());
  }
}

export const notebookKernel = new IJNBKernel();