/*
  Copyright (c) 2026, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { Notebook } from '../../../notebooks/notebook';
import { INotebook } from '../../../notebooks/types';

describe('Notebook assertValidNotebookJson tests', () => {
  const createNotebook = (): INotebook => ({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      language_info: {
        name: 'java',
      },
    },
    cells: [
      {
        id: 'cell-1',
        cell_type: 'markdown',
        metadata: {},
        source: 'Hello notebook',
      },
    ],
  });

  afterEach(() => {
    sinon.restore();
  });

  it('accepts notebooks that declare a newer nbformat version', () => {
    const notebook = {
      ...createNotebook(),
      nbformat: 5,
      nbformat_minor: 1,
    };

    expect(() => Notebook.assertValidNotebookJson(notebook)).not.to.throw();
  });

  it('rejects v4 notebooks older than the supported minor version baseline', () => {
    const notebook = {
      ...createNotebook(),
      nbformat: 4,
      nbformat_minor: 4,
    };

    expect(() => Notebook.assertValidNotebookJson(notebook)).to.throw('jdk.notebook.validation.notebook_version.failed.error_msg');
  });

  it('still rejects invalid notebook structure for newer nbformat versions', () => {
    const notebook = {
      ...createNotebook(),
      nbformat: 5,
      nbformat_minor: 1,
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: 'Hello notebook',
        },
      ],
    } as INotebook;

    expect(() => Notebook.assertValidNotebookJson(notebook)).to.throw('jdk.notebook.validation.failed.error_msg');
  });
});
