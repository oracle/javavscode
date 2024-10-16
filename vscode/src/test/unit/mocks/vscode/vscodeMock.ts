const Module = require('module');
import type * as vscode from 'vscode';
import { URI } from './uri';
import { instance, mock } from 'ts-mockito';
import { l10n } from '../../../../localiser';

const originalLoad = Module._load;

type VSCode = typeof vscode;
const mockedVSCode: Partial<VSCode> = {};

export const mockedVSCodeNamespaces: { [P in keyof VSCode]?: VSCode[P] } = {};

function generateMock<K extends keyof VSCode>(name: K): void {
    const mockedObj = mock<VSCode[K]>();
    (mockedVSCode as any)[name] = instance(mockedObj);
    mockedVSCodeNamespaces[name] = mockedObj as any;
}


export const vscodeMockInit = () => {
    generateMock('extensions');

    mockedVSCode.Uri = URI as any;
    const l10n: l10n = {
        value(key) {
            console.log(key);
            return key;
        },
        nbLocaleCode() {
            return 'en';
        },
    };
    
    Module._load = function (request: any, _parent: any) {
        if (request === 'vscode') {
            console.log('Returning mocked VS Code');
            return mockedVSCode;
        } else if (request.includes('localiser')) {
            console.log('Returning mocked localiser');
            return l10n;
        }
        
        if (/\.less$/.test(request)) {
            return;
        }
        return originalLoad.apply(this, arguments);
    };
}

export function restore() {
    Module._load = originalLoad;
}

mockedVSCode.Uri = mockedVSCode.Uri as any;
