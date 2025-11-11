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
        var isLocaliserUnitTest = ['localiser.unit.test.ts','localiser.unit.test.js'].find(it=>request.includes(it)||_parent?.filename.includes(it))
        if (request === 'vscode') {
            return mocks.vscode;
        } else if (request.includes('localiser') && !isLocaliserUnitTest) {
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
