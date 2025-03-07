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

import { LineBufferingPseudoterminal } from "../../../views/pseudoTerminal";
import { CloseOutputRequest, ResetOutputRequest, ShowOutputRequest, WriteOutputRequest } from "../../protocol";
import { notificationOrRequestListenerType } from "../../types";

const writeOutputRequestHandler = (param: any) => {
    const outputTerminal = LineBufferingPseudoterminal.getInstance(param.outputName)
    outputTerminal.acceptInput(param.message);
}

const showOutputRequestHandler = (param: any) => {
    const outputTerminal = LineBufferingPseudoterminal.getInstance(param)
    outputTerminal.show();
}

const closeOutputRequestHandler = (param: any) => {
    const outputTerminal = LineBufferingPseudoterminal.getInstance(param)
    outputTerminal.close();
}

const resetOutputRequestHandler = (param: any) => {
    const outputTerminal = LineBufferingPseudoterminal.getInstance(param)
    outputTerminal.clear();
}


export const terminalListeners: notificationOrRequestListenerType[] = [{
    type: WriteOutputRequest.type,
    handler: writeOutputRequestHandler
}, {
    type: ShowOutputRequest.type,
    handler: showOutputRequestHandler
}, {
    type: CloseOutputRequest.type,
    handler: closeOutputRequestHandler
}, {
    type: ResetOutputRequest.type,
    handler: resetOutputRequestHandler
}];