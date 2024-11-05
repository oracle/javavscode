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

import * as vscode from 'vscode';
import { mock, when, anyString, anyOfClass, anything, instance } from "ts-mockito";

type VSCode = typeof vscode;

let mockedWindow: typeof vscode.window;
export const mockWindowNamespace = (mockedVSCode: Partial<VSCode>) => {
    mockedWindow = mock<typeof vscode.window>();
    mockedVSCode.window = instance(mockedWindow);
    mockCreateWebViewPanel();
    mockCreateOutputChannel();
    mockMessageView();
}

const mockCreateWebViewPanel = () => {
    const mockedWebviewPanel = mock<vscode.WebviewPanel>();
    when(mockedWindow.createWebviewPanel(
        anyString(),
        anyString(),
        anyOfClass(Number),
        anything()
    )).thenReturn(instance(mockedWebviewPanel));
} 

const mockCreateOutputChannel = () => {
    const mockedOutputChannel = mock<vscode.OutputChannel>();
    when(mockedWindow.createOutputChannel(
        anyString()
    )).thenReturn(instance(mockedOutputChannel));
} 

const mockMessageView = () => {
    when(mockedWindow.showErrorMessage(anyString())).thenReturn(Promise.resolve(anyString()));
    when(mockedWindow.showInformationMessage(anyString())).thenReturn(Promise.resolve(anyString()));
    when(mockedWindow.showWarningMessage(anyString())).thenReturn(Promise.resolve(anyString()));
}
