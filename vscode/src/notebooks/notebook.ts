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

import * as vscode from 'vscode';
import { ICell, INotebook } from './types';
import { serializeCell } from './utils';
import Ajv from "ajv";
import schema = require('./nbformat.v4.d7.schema.json');
import { LOGGER } from '../logger';
import { l10n } from '../localiser';

export class NotebookVersionInfo {
    static readonly NBFORMAT = 4;
    static readonly NBFORMAT_MINOR = 5;
}

export class Notebook {
    readonly nbformat: number;
    readonly nbformat_minor: number;
    readonly metadata: { language_info: { name: string } };
    readonly cells: ICell[];
    static ajv = new Ajv({
        allErrors: true,
        strict: false
    });
    static validateFn = this.ajv.compile(schema);

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
                LOGGER.error('Error serializing cell: ' + cell + cellError);
                throw new Error(l10n.value("jdk.notebook.cell.serializer.error_msg"))
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

    assertValidNotebook() {
        Notebook.assertValidNotebookJson(this.toJSON());
    }

    static assertValidNotebookJson(notebook: INotebook) {
        if (!Notebook.validateFn(notebook)) {
            const errors = (Notebook.validateFn.errors || [])
                .map(e => `${e.schemaPath || '/'} ${e.message}`)
                .join('\n');
            LOGGER.error(`Notebook JSON validation failed:\n${errors}`);
            throw new Error(l10n.value("jdk.notebook.validation.failed.error_msg"));
        }
        LOGGER.debug("Notebook successfully validated.");
    }
}
