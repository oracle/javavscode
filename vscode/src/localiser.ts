'use strict';


import * as l10nLib from '@vscode/l10n'

import * as vscode from 'vscode';


type TranslatorFn = typeof vscode.l10n.t

export interface l10n{
  translate(key:string,...args:Array<l10nLib.L10nReplacement>):string
  translateMap(key: string, record:Record<string, any>): string 
}

class l10Wrapper implements l10n{
  private defaultTranslation: TranslatorFn;
  constructor(extensionId:string,defaultBundlePath:string){
    let defaultBundleAbsoluteFsPath = vscode.Uri.file(`${vscode.extensions.getExtension(extensionId)?.extensionPath}/${defaultBundlePath}`).fsPath
    l10nLib.config({  
          fsPath:defaultBundleAbsoluteFsPath
    });
    this.defaultTranslation = l10nLib.t;
    
  }
  translate(key: string, ...args: Array<l10nLib.L10nReplacement>): string {
    if(vscode.l10n.bundle&&vscode.l10n.t(key)!==key){
       return  vscode.l10n.t(key,args);
    }else{
      return this.defaultTranslation(key,args);
    }
  }


  translateMap(key: string, record:Record<string, any>): string {
    if(vscode.l10n.bundle&&vscode.l10n.t(key)!==key){
       return  vscode.l10n.t(key,record);
    }else{
      return this.defaultTranslation(key,record);
    }
  }
}


export const l10n:l10n = new l10Wrapper("Oracle.oracle-java","l10n/bundle.l10n.en.json")