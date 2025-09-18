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
import { errorNotebook, parseCell } from './utils';
import { ICell, INotebook } from './types';
import { Notebook } from './notebook';

class IJNBNotebookSerializer implements vscode.NotebookSerializer {
  private readonly decoder = new TextDecoder();

  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const raw = this.decoder.decode(content).trim();
    if (!raw) {
      return errorNotebook('Empty Notebook', 'The notebook file appears to be empty.');
    }

    let parsed: INotebook;
    try {
      parsed = JSON.parse(raw) as INotebook;
      Notebook.assertValidNotebookJson(parsed);
    } catch (err) {
      console.error('Failed to parse notebook content:', err);
      vscode.window.showErrorMessage(`Failed to open notebook: ${(err as Error).message}`);
      return errorNotebook(
        'Error Opening Notebook',
        `Failed to parse notebook: ${(err as Error).message}`
      );
    }

    if (!parsed || !Array.isArray(parsed.cells)) {
      return errorNotebook('Invalid Notebook Structure', 'Missing or invalid `cells` array.');
    }

    let cells: vscode.NotebookCellData[];
    try {
      cells = parsed.cells.map((cell: ICell) => parseCell(cell));
    } catch (cellError) {
      return errorNotebook(
        'Cell parsing error',
        (cellError as Error).message
      );
    }
    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    try {
      const notebook = Notebook.fromNotebookData(data, 'java');
      notebook.assertValidNotebook();
      return notebook.toUint8Array();
    } catch (err) {
      console.error('Unhandled error in serializeNotebook:', err);
      vscode.window.showErrorMessage(`Failed to serialize notebook: ${(err as Error).message}`);
      throw err;
    }
  }
}

export const notebookSerializer = new IJNBNotebookSerializer();