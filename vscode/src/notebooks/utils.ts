import { Buffer } from 'buffer';
import * as vscode from 'vscode';
import { CellJSON, CellOutputJSON } from './types';

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

export function parseCell(cell: CellJSON): vscode.NotebookCellData {
  if (cell.cell_type !== 'code' && cell.cell_type !== 'markdown')
    throw new Error(`Invalid cell_type: ${cell.cell_type}`);
  if (cell.source === undefined || cell.source === null)
    throw new Error('Missing cell.source');
  const kind =
    cell.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup;
  const language = kind === vscode.NotebookCellKind.Code ? 'java' : 'markdown';
  const value = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source);

  const cellData = new vscode.NotebookCellData(kind, value, language);
  if (typeof cell.execution_count === 'number') {
    cellData.executionSummary = {
      executionOrder: cell.execution_count,
      success: true,
    };
  }

  if (Array.isArray(cell.outputs)) {
    const outputs = cell.outputs.flatMap((out: CellOutputJSON) => {
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

  return cellData;
}

export function parseOutput(raw: CellOutputJSON): vscode.NotebookCellOutput[] {
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

export function serializeCell(cell: vscode.NotebookCellData): any {
  const cellType = cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown';
  const source = [cell.value];
  const executionCount = cell.executionSummary?.executionOrder ?? null;
  const outputs = (cell.outputs || []).map((output) => {
    const data: any = {};
    let meta = output.metadata;

    for (const item of output.items) {
      if (item.mime === 'text/plain') {
        data['text/plain'] = Buffer.from(item.data).toString();
      } else if (item.mime.startsWith('image/')) {
        data[item.mime] = uint8ArrayToBase64(item.data);
      }
    }

    return {
      output_type: 'execute_result',
      data,
      metadata: meta,
      execution_count: executionCount,
    };
  });

  return {
    cell_type: cellType,
    source,
    metadata: { language: cell.languageId, ...cell.metadata },
    execution_count: executionCount,
    outputs,
  };
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
