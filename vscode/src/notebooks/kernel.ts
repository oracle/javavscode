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

import * as vscode from 'vscode';
import { globalState } from '../globalState';
import { isNbCommandRegistered } from '../commands/utils';
import { nbCommands } from '../commands/commands';
import { getConfigurationValue } from '../configurations/handlers';
import { configKeys } from '../configurations/configuration';
import { createOutputItem } from './utils';

export class IJNBKernel implements vscode.Disposable {
  private readonly controllers: vscode.NotebookController[] = [];
  static executionCounter = new Map<string, number>();

  constructor() {
    const custom = vscode.notebooks.createNotebookController(
      'ijnb-kernel-ijnb',
      'ijnb-notebook',
      'IJNB Kernel'
    )
    const jupyter = vscode.notebooks.createNotebookController(
      'ijnb-kernel-jupyter',
      'jupyter-notebook',
      'IJNB Kernel'
    )
    for (const ctr of [custom, jupyter]) {
      ctr.supportedLanguages = ['markdown', 'java'];
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
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController
  ): Promise<void> {
    const notebookId = notebook.uri.toString();
    const classpath = getConfigurationValue(configKeys.notebookClasspath) || null;

    for (const cell of cells) {
      const exec = controller.createNotebookCellExecution(cell);
      const next = IJNBKernel.executionCounter.get(notebookId) ?? 1;
      exec.executionOrder = next;
      exec.start(Date.now());

      try {
        if (cell.document.languageId === 'markdown') {
          await exec.replaceOutput([
            new vscode.NotebookCellOutput([createOutputItem(cell.document.getText(), 'text/plain')]),
          ]);
        } else {
          if (!(await globalState.getClientPromise().client)) {
            throw new Error('JShell client not initialized. Notebook execution aborted.');
          }
          if (!(await isNbCommandRegistered(nbCommands.executeNotebookCell))) {
            throw new Error(`Notebook execution command '${nbCommands.executeNotebookCell}' is not registered.`);
          }
          const response = (await vscode.commands.executeCommand<
            { data: string; mimeType: string }[]
            >(nbCommands.executeNotebookCell, cell.document.getText(), notebookId, classpath));
          if (!response) throw new Error('No output received from notebook cell execution.');
          
          const mimeMap = new Map<string, string[]>();
          for (const { data, mimeType } of response) {
            const arr = mimeMap.get(mimeType) || [];
            arr.push(data);
            mimeMap.set(mimeType, arr);
          }

          if (mimeMap.size === 0) {
            await exec.replaceOutput([]);
          } else {
            const items = Array.from(mimeMap.entries()).map(([mime, chunks]) =>
              createOutputItem(mime.startsWith('image/') ? chunks[0] : chunks.join('\n'), mime)
            );
            await exec.replaceOutput([new vscode.NotebookCellOutput(items)]);
          }
        }

        exec.end(true, Date.now());
      } catch (err) {
        console.error(`Execution failed for cell (index: ${cell.index}): ${(err as Error).message}: `, err);
        await exec.replaceOutput([
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.error({
              name: 'Execution Error',
              message: String(err),
            }),
          ]),
        ]);
        exec.end(false, Date.now());
      }
      IJNBKernel.executionCounter.set(notebookId, next + 1);
    }
  }
}
