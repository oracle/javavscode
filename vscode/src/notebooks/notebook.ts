
import * as vscode from 'vscode';
import { ICell, INotebook } from './types';
import { serializeCell } from './utils';
import Ajv = require('ajv');
import schema = require('./nbformat.v4.d7.schema.json');

export class NotebookVersionInfo {
  static readonly NBFORMAT = 4;
  static readonly NBFORMAT_MINOR = 5;
}

export class Notebook {
    readonly nbformat: number;
    readonly nbformat_minor: number;
    readonly metadata: { language_info: { name: string } };
    readonly cells: ICell[];
    ajv = new Ajv();
    validateFn = this.ajv.compile(schema);

    constructor(cells: ICell[], language: string = 'java') {
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

    toJSON(): INotebook {
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
        
    assertValidNotebook(){
        if (!this.validateFn(this.toJSON())) {
            const errors = (this.validateFn.errors || [])
            .map(e => `${e.dataPath || '/'} ${e.message}`)
            .join('\n');
            throw new Error(`Notebook JSON validation failed:\n${errors}`);
        }
        console.log("Notebook successfully validated.")
    }
}
