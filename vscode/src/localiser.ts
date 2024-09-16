'use strict';


import * as l10nLib from '@vscode/l10n'

import * as vscode from 'vscode';
import { ORACLE_VSCODE_EXTENSION_ID } from './constants';

const DEFAULT_LANGAUGE = "en";
const DEFAULT_BUNDLE_FILE = `l10n/bundle.l10n.${DEFAULT_LANGAUGE}.json`;

type TranslatorFn = typeof vscode.l10n.t

export interface l10n {
  value(key: string, placeholderMap?: Record<string, any>): string
  nbLocaleCode():string
}

const vcodeToNbLocaleCodes:{[key:string]:string} = {
  "ja":"ja",
  "zh-cn":"zh:CN"
};

class l10Wrapper implements l10n {
  private defaultTranslation: TranslatorFn;

    constructor(extensionId: string, defaultBundlePath: string) {
      let defaultBundleAbsoluteFsPath = vscode.Uri.file(`${vscode.extensions.getExtension(extensionId)?.extensionPath}/${defaultBundlePath}`).fsPath
      l10nLib.config({
        fsPath: defaultBundleAbsoluteFsPath
      });
      this.defaultTranslation = l10nLib.t;
    }

    value(key: string, placeholderMap: Record<string, any>): string {
      const valueFromBundle:string = vscode.l10n.bundle ? vscode.l10n.t(key, placeholderMap) : key;
      const isPresentInBundle = valueFromBundle !== key;
      return isPresentInBundle ? valueFromBundle : this.defaultTranslation(key, placeholderMap);
    }
    nbLocaleCode(){
      const supportedLanguage = vcodeToNbLocaleCodes[vscode.env.language];
      return supportedLanguage?supportedLanguage:DEFAULT_LANGAUGE;
    }
}


export const l10n: l10n = new l10Wrapper(ORACLE_VSCODE_EXTENSION_ID, DEFAULT_BUNDLE_FILE);