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