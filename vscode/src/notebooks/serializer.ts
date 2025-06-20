import * as vscode from 'vscode';
import { errorNotebook, parseCell, serializeCell } from './utils';
import { CellJSON, NotebookJSON } from './types';
import { Notebook } from './notebook';

export class IJNBNotebookSerializer implements vscode.NotebookSerializer {
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const raw = this.decoder.decode(content).trim();
    if (!raw) {
      return errorNotebook('Empty Notebook', 'The notebook file appears to be empty.');
    }

    let parsed: NotebookJSON;
    try {
      parsed = JSON.parse(raw) as NotebookJSON;
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
      cells = parsed.cells.map((cell: CellJSON) => parseCell(cell));
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
      return notebook.toUint8Array();
    } catch (err) {
      console.error('Unhandled error in serializeNotebook:', err);
      vscode.window.showErrorMessage(`Failed to serialize notebook: ${(err as Error).message}`);
      throw err;
    }
  }
}
