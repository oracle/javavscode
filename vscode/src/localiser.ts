/*
  Copyright (c) 2023-2025, Oracle and/or its affiliates.

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

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { extConstants } from './constants';
import { FileUtils } from './utils';
import { LOGGER } from './logger';
import * as path from 'path';

const DEFAULT_LANGUAGE = "en";
const DEFAULT_BUNDLE_FILE = path.join("l10n", `bundle.l10n.${DEFAULT_LANGUAGE}.json`);
const _format2Regexp = /{([^}]+)}/g;

export interface l10n {
  value(key: string, placeholderMap?: Record<string, any>): string
  nbLocaleCode(): string
}


class l10Wrapper implements l10n {
  private defaultl10nMap: any;
  constructor(extensionId: string, defaultBundlePath: string) {
    let extnPath = vscode.extensions.getExtension(extensionId)!!.extensionPath;
    let defaultBundleAbsoluteFsPath = FileUtils.toUri(path.join(extnPath,defaultBundlePath)).fsPath;
    let fileContent: string = "";
    try {
      fileContent = fs.readFileSync(defaultBundleAbsoluteFsPath, 'utf-8');
    } catch (err) {
      LOGGER.logAndThrowError("error occured while reading bundle file : ", err);
    }
    try {
      this.defaultl10nMap = JSON.parse(fileContent);
    } catch (err) {
      LOGGER.logAndThrowError("error occured while parsing bundle file : ", err);
    }

  }

  value(key: string, placeholderMap: Record<string, any>): string {
    const valueFromBundle: string = vscode.l10n.bundle ? vscode.l10n.t(key, placeholderMap) : key;
    const isPresentInBundle = valueFromBundle !== key;
    return isPresentInBundle ? valueFromBundle : this.defaultTranslation(key, placeholderMap);
  }
  defaultTranslation(key: string, placeholderMap: Record<string, any>): string {
    let value = this.defaultl10nMap[key];
    return value ? this.format(value, placeholderMap) : key;
  }
  nbLocaleCode() {
    const vscodeLanguage = vscode.env.language;
    if (!vscodeLanguage) return DEFAULT_LANGUAGE;
    const localeParts = vscodeLanguage.split(/[-_]/g);
    if (localeParts.length > 1) {
      localeParts[1] = localeParts[1].toUpperCase();
    }
    var nbFormatLocale = localeParts.join(":");
    return nbFormatLocale;
  }


  //copied from:
  //https://github.com/microsoft/vscode-l10n/blob/57b5918f3b247a03387432037669e8ae5aff886b/l10n/src/main.ts#L222
  //original license: MIT
  /*
    Copyright (c) Microsoft Corporation

    All rights reserved.

    MIT License

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE
   */
  format(template: string, values: Record<string, unknown>): string {
    if (!values || Object.keys(values).length === 0) {
      return template;
    }
    return template.replace(_format2Regexp, (match, group) => (values[group] ?? match) as string);
  }
}


export const l10n: l10n = new l10Wrapper(extConstants.ORACLE_VSCODE_EXTENSION_ID, DEFAULT_BUNDLE_FILE);