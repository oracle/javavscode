import * as vscode from 'vscode';
import { base64ToUint8Array, uint8ArrayToBase64 } from './utils';

export class IJNBNotebookSerializer implements vscode.NotebookSerializer {
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const raw = this.decoder.decode(content).trim();
    if (!raw) {
      return this.errorNotebook('Empty Notebook', 'The notebook file appears to be empty.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse notebook content:', err);
            vscode.window.showErrorMessage(`Failed to open notebook: ${(err as Error).message}`);
      return this.errorNotebook(
        'Error Opening Notebook',
        `Failed to parse notebook: ${(err as Error).message}`
      );
    }

    if (!parsed || !Array.isArray(parsed.cells)) {
      return this.errorNotebook('Invalid Notebook Structure', 'Missing or invalid `cells` array.');
    }

    const cells = parsed.cells.map((cell: any) => this.parseCell(cell));
    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    const notebook = {
      nbformat: 4,
      nbformat_minor: 2,
      metadata: { language_info: { name: 'java' } },
      cells: data.cells.map((cell) => this.serializeCell(cell)),
    };
    return this.encoder.encode(JSON.stringify(notebook, null, 2));
  }

  // Helpers

  private parseCell(cell: any): vscode.NotebookCellData {
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
      const outputs = cell.outputs.flatMap((out: any) => this.parseOutput(out));
      if (outputs.length) {
        cellData.outputs = outputs;
      }
    }

    return cellData;
  }

  private parseOutput(raw: any): vscode.NotebookCellOutput[] {
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
        for (const [mime, data] of Object.entries(raw.data || {})) {
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

  private serializeCell(cell: vscode.NotebookCellData): any {
    const cellType = cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown';
    const source = [cell.value];
    const executionCount = cell.executionSummary?.executionOrder ?? null;
    const outputs = (cell.outputs || []).map((output) => {
      // default to execute_result
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

  private errorNotebook(title: string, message: string): vscode.NotebookData {
    return new vscode.NotebookData([
      new vscode.NotebookCellData(
        vscode.NotebookCellKind.Markup,
        `# ${title}\n\n${message}`,
        'markdown'
      ),
    ]);
  }
}
