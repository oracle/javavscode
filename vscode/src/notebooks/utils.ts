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

import { Buffer } from 'buffer';
import * as vscode from 'vscode';
import {
  ICell,
  ICodeCell,
  IMarkdownCell,
  IOutput,
  IExecuteResultOutput,
  IMimeBundle,
  IMetadata
} from './types';
import { randomUUID } from 'crypto';
import { isString } from '../utils';
import { mimeTypes } from './constants';
import { MimeTypeHandler } from './mimeTypeHandler';
import { ExecutionSummary } from './executionSummary';
import { LOGGER } from '../logger';
import { l10n } from '../localiser';


export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(base64, 'base64');
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(data: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(data).toString('base64');
  }
  let binary = '';
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

export const createErrorOutput = (err: string | Error) => {
  return new vscode.NotebookCellOutput([createErrorOutputItem(err)]);
}

export const createErrorOutputItem = (err: string | Error) => {
  return vscode.NotebookCellOutputItem.text(isString(err) ? err : err.message);
}

export function parseCell(cell: ICell): vscode.NotebookCellData {
  if (cell.cell_type !== 'code' && cell.cell_type !== 'markdown')
    throw new Error(l10n.value("jdk.notebook.cell.type.error_msg", { cellType: cell.cell_type }));
  if (cell.source === undefined || cell.source === null)
    throw new Error(l10n.value("jdk.notebook.cell.missing.error_msg", { fieldName: "cell.source" }));
  const kind =
    cell.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup;
  const language = kind === vscode.NotebookCellKind.Code ? 'java' : 'markdown';
  const value = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source);

  const cellData = new vscode.NotebookCellData(kind, value, language);
  cellData.metadata = { id: cell.id, ...cell.metadata };
  if (cell.cell_type === 'code') {
    const execSummary = ExecutionSummary.fromMetadata(
      (cell.metadata as IMetadata).executionSummary,
      cell.execution_count ?? null
    );
    if (execSummary.executionOrder) {
      cellData.executionSummary = {
        executionOrder: execSummary.executionOrder ?? undefined,
        success: execSummary.success,
      };
    }

    if (Array.isArray(cell.outputs)) {
      const outputs = cell.outputs.flatMap((out: IOutput) => {
        const parsed = parseOutput(out);
        if (!parsed) {
          throw new Error(`Unrecognized output format: ${JSON.stringify(out)}`);
        }
        return parsed;
      });
      if (outputs.length) {
        cellData.outputs = outputs;
      }
    }
  }
  if (cell.id) LOGGER.debug(`${cell.id.slice(0, 5)} Successfully parsed`);
  return cellData;
}

export function parseOutput(raw: IOutput): vscode.NotebookCellOutput[] {
  const outputs: vscode.NotebookCellOutput[] = [];
  switch (raw.output_type) {
    case 'stream':
      outputs.push(
        new vscode.NotebookCellOutput([
          new MimeTypeHandler(mimeTypes.TEXT).makeOutputItem(Array.isArray(raw.text) ? raw.text.join('') : raw.text),
        ])
      );
      break;

    case 'error':
      outputs.push(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error({
            name: raw.ename ?? 'Error',
            message: raw.evalue ?? '',
            stack: Array.isArray(raw.traceback) ? raw.traceback.join('\n') : undefined,
          }),
        ])
      );
      break;

    case 'display_data':
    case 'execute_result':
      const bundle = raw.data ?? {};
      const items = MimeTypeHandler.itemsFromBundle(bundle);
      if (items.length) {
        outputs.push(new vscode.NotebookCellOutput(items, raw.metadata));
      }
      break;
  }
  return outputs;
}

export function serializeCell(cell: vscode.NotebookCellData): ICell {
  const baseMeta = (cell.metadata as Record<string, any>) || {};
  const id = baseMeta.id || randomUUID();

  if (cell.kind === vscode.NotebookCellKind.Code) {
    const exec = cell.executionSummary ?? {};
    const executionCount = exec.executionOrder ?? null;
    const success = exec.success;

    const execSummary = new ExecutionSummary(executionCount, success);
    const metadata = executionCount ? { ...baseMeta, executionSummary: execSummary.toJSON() } : {};

    const outputs: IOutput[] = (cell.outputs || []).map((output): IOutput => {
      const data: IMimeBundle = {};
      const outMetadata = output.metadata ?? {};

      for (const item of output.items) {
        if (item.mime === mimeTypes.TEXT) {
          data[mimeTypes.TEXT] = Buffer.from(item.data).toString();
        } else {
          data[item.mime] = uint8ArrayToBase64(item.data);
        }
      }

      const execOut: IExecuteResultOutput = {
        output_type: 'execute_result',
        data,
        metadata: outMetadata,
        execution_count: executionCount,
      };
      return execOut;
    });

    const codeCell: ICodeCell = {
      id,
      cell_type: 'code',
      source: cell.value,
      metadata: {
        language: cell.languageId,
        ...metadata
      },
      execution_count: executionCount,
      outputs,
    };
    if (codeCell.id) LOGGER.debug(`${codeCell.id.slice(0, 5)} Successfully serialized code cell`);
    return codeCell;
  }
  const mdCell: IMarkdownCell = {
    id,
    cell_type: 'markdown',
    source: cell.value,
    metadata: {
      language: cell.languageId,
      id,
      ...cell.metadata
    },
  };
  return mdCell;
}

export function errorNotebook(title: string, message: string, consoleMessage: string = ''): vscode.NotebookData {
  LOGGER.error(title + ': ' + message + ': ' + consoleMessage);
  return new vscode.NotebookData([
    new vscode.NotebookCellData(
      vscode.NotebookCellKind.Markup,
      `# ${title}\n\n${message}`,
      'markdown'
    ),
  ]);
}
