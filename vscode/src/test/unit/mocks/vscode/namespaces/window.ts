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
