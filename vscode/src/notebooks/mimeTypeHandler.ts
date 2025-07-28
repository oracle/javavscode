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
import { IMimeBundle } from './types';
import { mimeTypes } from './constants';

export type DataOrBytes = string | Uint8Array;

export class MimeTypeHandler {
  constructor(public readonly value: string) {}
  get isText(): boolean {
    return this.value === mimeTypes.TEXT;
  }
  get isImage(): boolean {
    return this.value.startsWith('image/');
  }

  static toBytes(data: DataOrBytes): Uint8Array {
    if (typeof data === 'string') {
      return Buffer.from(data, 'base64');
    }
    return data;
  }

  static toString(data: DataOrBytes): string {
    if (typeof data === 'string') {
      return data;
    }
    return new TextDecoder().decode(data);
  }

    makeOutputItem(data: DataOrBytes): vscode.NotebookCellOutputItem {
    if (this.isImage) {
      const bytes = MimeTypeHandler.toBytes(data);
      return new vscode.NotebookCellOutputItem(bytes, this.value);
    }
    const text = MimeTypeHandler.toString(data);
    return vscode.NotebookCellOutputItem.text(text, this.value);
  }

    static itemsFromBundle(bundle: IMimeBundle): vscode.NotebookCellOutputItem[] {
    return Object.entries(bundle).flatMap(([mime, data]) => {
      const mt = new MimeTypeHandler(mime);
      if (mt.isText || mt.isImage) {
        const payload = Array.isArray(data) ? data.join('') : data;
        return [mt.makeOutputItem(payload)];
      }
      return [];
    });
  }
}
