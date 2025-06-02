
import * as vscode from 'vscode';
import { CellJSON, NotebookJSON } from './types';
import { serializeCell } from './utils';

export class NotebookVersionInfo {
  static readonly NBFORMAT = 4;
  static readonly NBFORMAT_MINOR = 2;
}

export class Notebook {
  readonly nbformat: number;
  readonly nbformat_minor: number;
  readonly metadata: { language_info: { name: string } };
  readonly cells: CellJSON[];

  constructor(cells: CellJSON[], language: string = 'java') {
    this.nbformat = NotebookVersionInfo.NBFORMAT;
    this.nbformat_minor = NotebookVersionInfo.NBFORMAT_MINOR;
    this.metadata = { language_info: { name: language } };
    this.cells = cells;
  }

  static fromNotebookData(
    data: vscode.NotebookData,
    language: string = 'java'
  ): Notebook {
    const cells = data.cells.map((cell) => {
        try {
        return serializeCell(cell)
        } catch (cellError) {
        console.error('Error serializing cell: ', cell, cellError);
        throw new Error('Failed to serialize one or more cells')
        }
    })
    return new Notebook(cells, language);
  }

  toJSON(): NotebookJSON {
    return {
      nbformat: this.nbformat,
      nbformat_minor: this.nbformat_minor,
      metadata: this.metadata,
      cells: this.cells,
    };
  }

  toUint8Array(): Uint8Array {
    const json = JSON.stringify(this.toJSON(), null, 2);
    return new TextEncoder().encode(json);
  }
}
