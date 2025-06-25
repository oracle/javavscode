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

export function createOutputItem(data: string | Uint8Array, mimeType: string): vscode.NotebookCellOutputItem {
  if (mimeType.startsWith('image/')) {
    const bytes = typeof data === 'string' ? base64ToUint8Array(data) : data;
    return new vscode.NotebookCellOutputItem(bytes, mimeType);
  }
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return vscode.NotebookCellOutputItem.text(text, mimeType);
}

export function parseCell(cell: ICell): vscode.NotebookCellData {
  if (cell.cell_type !== 'code' && cell.cell_type !== 'markdown')
    throw new Error(`Invalid cell_type: ${cell.cell_type}`);
  if (cell.source === undefined || cell.source === null)
    throw new Error('Missing cell.source');
  const kind =
    cell.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup;
  const language = kind === vscode.NotebookCellKind.Code ? 'java' : 'markdown';
  const value = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source);

  const cellData = new vscode.NotebookCellData(kind, value, language);
  cellData.metadata = { id: cell.id, ...cell.metadata };
  if (cell.cell_type === 'code') {
    
    const metaExec = (cell.metadata as IMetadata).executionSummary;
    const executionOrder = metaExec?.executionOrder ?? cell.execution_count ?? undefined;
    const success = metaExec?.success ?? undefined;

    cellData.executionSummary = {
      executionOrder,
      success,
    };

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
  if(cell.id) console.log(`${cell.id.slice(0,5)} Successfully parsed`);
  return cellData;
}

export function parseOutput(raw: IOutput): vscode.NotebookCellOutput[] {
  const outputs: vscode.NotebookCellOutput[] = [];
  switch (raw.output_type) {
    case 'stream':
      outputs.push(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(Array.isArray(raw.text) ? raw.text.join('') : raw.text),
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
      const items: vscode.NotebookCellOutputItem[] = [];
      const bundle = raw.data || {};
      for (const mime in bundle) {
        const data = bundle[mime];
        if (mime === 'text/plain') {
          const text = Array.isArray(data) ? data.join('') : String(data);
          items.push(vscode.NotebookCellOutputItem.text(text));
        } else if ((mime as string).startsWith('image/')) {
          const b64 = Array.isArray(data) ? data.join('') : String(data);
          const bytes = base64ToUint8Array(b64);
          items.push(new vscode.NotebookCellOutputItem(bytes, mime));
        }
      }
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
    const success = exec.success ?? false;

    const metadata = { ...baseMeta, executionSummary: { executionOrder: executionCount, success } };

    const outputs: IOutput[] = (cell.outputs || []).map((output): IOutput => {
      const data: IMimeBundle = {};
      const outMetadata = output.metadata ?? {};

      for (const item of output.items) {
        if (item.mime === 'text/plain') {
          data['text/plain'] = Buffer.from(item.data).toString();
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
    if(codeCell.id) console.log(`${codeCell.id.slice(0,5)} Successfully serialized code cell`);
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
  console.error(title, ': ', message, ': ', consoleMessage);
  return new vscode.NotebookData([
    new vscode.NotebookCellData(
      vscode.NotebookCellKind.Markup,
      `# ${title}\n\n${message}`,
      'markdown'
    ),
  ]);
}
