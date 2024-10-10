/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

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

import { Disposable, TextEditor, window } from "vscode";
import { globalVars } from "../extension";
import { asRanges } from "../lsp/protocol";



const visibleTextEditorsChangeHandler = (editors: readonly TextEditor[]) => {
    editors.forEach((editor: any) => {
        let decorationParams = globalVars.decorationParamsByUri.get(editor.document.uri);
        if (decorationParams) {
            let decorationType = globalVars.decorations.get(decorationParams.key);
            if (decorationType) {
                editor.setDecorations(decorationType, asRanges(decorationParams.ranges));
            }
        }
    });
}

const visibleTextEditorsChangeListener = window.onDidChangeVisibleTextEditors(visibleTextEditorsChangeHandler);

const afterInitlisteners: Disposable[] = [visibleTextEditorsChangeListener];

export const registerListenersAfterClientInit = () => {
    afterInitlisteners.forEach(listener => {
        globalVars.extensionInfo.pushSubscription(listener);
    });
}