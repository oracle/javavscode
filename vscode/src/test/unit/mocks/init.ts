import { initMockedLocaliser } from "./mockLocaliser";
import { initMockedVSCode } from "./vscode/mockVscode";

const Module = require('module');
const originalLoad = Module._load;

export const initMocks = () => {
   const mockedVSCode = initMockedVSCode();
   const mockedLocaliser = initMockedLocaliser();
   
   const mocks = {
    vscode: mockedVSCode,
    localiser: mockedLocaliser
   };

   replaceImportsWithMocks(mocks);
}


const replaceImportsWithMocks = (mocks: any) => {
    Module._load = function (request: any, _parent: any) {
        if (request === 'vscode') {
            return mocks.vscode;
        } else if (request.includes('localiser')) {
            return mocks.localiser;
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
