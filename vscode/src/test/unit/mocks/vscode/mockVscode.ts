import * as vscode from 'vscode';
import { URI } from './uri';
import { mockWindowNamespace } from './namespaces/window';
import { mockedEnums } from './vscodeHostedTypes';

type VSCode = typeof vscode;
const mockedVSCode: Partial<VSCode> = {};

const mockedVscodeClassesAndTypes = () => {
    mockedVSCode.Uri = URI as any;
    mockedVSCode.ViewColumn = mockedEnums.viewColumn;
}

const mockNamespaces = () => {
    mockWindowNamespace(mockedVSCode);
}

export const initMockedVSCode = () => {
    mockedVscodeClassesAndTypes();
    mockNamespaces();

    return mockedVSCode;
}

