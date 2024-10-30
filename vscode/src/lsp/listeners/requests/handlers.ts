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
import { QuickPickItem, Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { notificationOrRequestListenerType } from "../../types";
import { ExecInHtmlPageRequest, HtmlPageRequest, InputBoxRequest, InputBoxStep, MutliStepInputRequest, QuickPickRequest, QuickPickStep, SaveDocumentRequestParams, SaveDocumentsRequest, TextEditorDecorationCreateRequest, UpdateConfigurationRequest } from "../../protocol";
import { InputStep, MultiStepInput } from "../../../utils";
import { runConfigurationUpdateAll } from "../../../views/runConfiguration";
import { isError } from "../../../utils";
import { isString } from "../../../utils";
import { LOGGER } from "../../../logger";
import { execInHtmlPage, showHtmlPage } from "../../../webviews/nbWebviewHandler";
import { globalState } from "../../../globalState";

const textEditorDecorationCreateRequestHandler = (param: any) => {
    let decorationType = window.createTextEditorDecorationType(param);
    globalState.setDecoration(decorationType.key, decorationType);
    return decorationType.key;
}

const multiStepInputRequestHandler = async (param: any) => {
    const client = await globalState.getClientPromise().client;
    const data: { [name: string]: readonly QuickPickItem[] | string } = {};
    async function nextStep(input: MultiStepInput, step: number, state: { [name: string]: readonly QuickPickItem[] | string }): Promise<InputStep | void> {
        const inputStep = await client.sendRequest(MutliStepInputRequest.step, { inputId: param.id, step, data: state });
        if (inputStep && inputStep.hasOwnProperty('items')) {
            const quickPickStep = inputStep as QuickPickStep;
            state[inputStep.stepId] = await input.showQuickPick({
                title: param.title,
                step,
                totalSteps: quickPickStep.totalSteps,
                placeholder: quickPickStep.placeHolder,
                items: quickPickStep.items,
                canSelectMany: quickPickStep.canPickMany,
                selectedItems: quickPickStep.items.filter(item => item.picked)
            });
            return (input: MultiStepInput) => nextStep(input, step + 1, state);
        } else if (inputStep && inputStep.hasOwnProperty('value')) {
            const inputBoxStep = inputStep as InputBoxStep;
            state[inputStep.stepId] = await input.showInputBox({
                title: param.title,
                step,
                totalSteps: inputBoxStep.totalSteps,
                value: state[inputStep.stepId] as string || inputBoxStep.value,
                prompt: inputBoxStep.prompt,
                password: inputBoxStep.password,
                validate: (val) => {
                    const d = { ...state };
                    d[inputStep.stepId] = val;
                    return client.sendRequest(MutliStepInputRequest.validate, { inputId: param.id, step, data: d });
                }
            });
            return (input: MultiStepInput) => nextStep(input, step + 1, state);
        }
    }
    await MultiStepInput.run(input => nextStep(input, 1, data));
    return data;
}

const inputBoxRequestHandler = async (param: any) => {
    return await window.showInputBox({ title: param.title, prompt: param.prompt, value: param.value, password: param.password });
}

const saveDocumentRequestHandler = async (request: SaveDocumentRequestParams) => {
    const uriList = request.documents.map(s => {
        let re = /^file:\/(?:\/\/)?([A-Za-z]):\/(.*)$/.exec(s);
        if (!re) {
            return s;
        }
        // don't ask why vscode mangles URIs this way; in addition, it uses lowercase drive letter ???
        return `file:///${re[1].toLowerCase()}%3A/${re[2]}`;
    });
    for (let ed of workspace.textDocuments) {
        if (uriList.includes(ed.uri.toString())) {
            return ed.save();
        }
    }
    return false;
}

const updateConfigRequestHandler = async (param: any) => {
    LOGGER.log(`Received config update: ${param.section}.${param.key}=${param.value}`);
    let wsFile: Uri | undefined = workspace.workspaceFile;
    let wsConfig: WorkspaceConfiguration = workspace.getConfiguration(param.section);
    if (wsConfig) {
        try {
            wsConfig.update(param.key, param.value, wsFile ? null : true)
                .then(() => {
                    LOGGER.log("Updated configuration: " + param.section + "." + param.key + "=" + param.value + "; in: " + (wsFile ? wsFile.toString() : "Global"));
                })
                .then(() => {
                    runConfigurationUpdateAll();
                });
        } catch (err) {
            LOGGER.error("Failed to update configuration. Reason: " + (isString(err) ? err : isError(err) ? err.message : "error"));
        }
    }
}

const quickPickRequestHandler = async (param: any) => {
    const selected = await window.showQuickPick(param.items, { title: param.title, placeHolder: param.placeHolder, canPickMany: param.canPickMany, ignoreFocusOut: true });
    return selected ? Array.isArray(selected) ? selected : [selected] : undefined;
}


export const requestListeners: notificationOrRequestListenerType[] = [{
    type: TextEditorDecorationCreateRequest.type,
    handler: textEditorDecorationCreateRequestHandler
}, {
    type: MutliStepInputRequest.type,
    handler: multiStepInputRequestHandler
}, {
    type: InputBoxRequest.type,
    handler: inputBoxRequestHandler
}, {
    type: SaveDocumentsRequest.type,
    handler: saveDocumentRequestHandler
}, {
    type: UpdateConfigurationRequest.type,
    handler: updateConfigRequestHandler
}, {
    type: QuickPickRequest.type,
    handler: quickPickRequestHandler
}, {
    type: HtmlPageRequest.type,
    handler: showHtmlPage
}, {
    type: ExecInHtmlPageRequest.type,
    handler: execInHtmlPage
}];