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
import { LogMessageNotification, MessageType, TelemetryEventNotification } from "vscode-languageclient";
import { notificationOrRequestListenerType } from "../../types";
import { asRanges, ShowStatusMessageParams, StatusMessageRequest, TestProgressNotification, TextEditorDecorationDisposeNotification, TextEditorDecorationSetNotification } from "../../protocol";
import { commands, window, workspace } from "vscode";
import { isNbJavacDisabledHandler, updateConfigurationValue } from "../../../configurations/handlers";
import { l10n } from "../../../localiser";
import { configKeys } from "../../../configurations/configuration";
import { builtInCommands } from "../../../commands/commands";
import { LOGGER } from '../../../logger';
import { globalState } from "../../../globalState";
import { WorkspaceChangeData, WorkspaceChangeEvent } from "../../../telemetry/events/workspaceChange";
import { Telemetry } from "../../../telemetry/telemetry";

const checkInstallNbJavac = (msg: string) => {
    const NO_JAVA_SUPPORT = "Cannot initialize Java support";
    if (msg.startsWith(NO_JAVA_SUPPORT)) {
        if (isNbJavacDisabledHandler()) {
            const message = l10n.value("jdk.extension.nbjavac.message.supportedVersionRequired");
            const enable = l10n.value("jdk.extension.nbjavac.label.enableNbjavac");
            const settings = l10n.value("jdk.extension.nbjavac.label.openSettings");
            window.showErrorMessage(message, enable, settings).then(reply => {
                if (enable === reply) {
                    updateConfigurationValue(configKeys.disableNbJavac, false);
                } else if (settings === reply) {
                    commands.executeCommand(builtInCommands.openSettings, configKeys.jdkHome);
                }
            });
        }
    }
}

const showStatusBarMessageHandler = (params : ShowStatusMessageParams) => {
    let decorated : string = params.message;
    let defTimeout;

    switch (params.type) {
        case MessageType.Error:
            decorated = '$(error) ' + params.message;
            defTimeout = 0;
            checkInstallNbJavac(params.message);
            break;
        case MessageType.Warning:
            decorated = '$(warning) ' + params.message;
            defTimeout = 0;
            break;
        default:
            defTimeout = 10000;
            break;
    }
    // params.timeout may be defined but 0 -> should be used
    const timeout = params.timeout != undefined ? params.timeout : defTimeout;
    if (timeout > 0) {
        window.setStatusBarMessage(decorated, timeout);
    } else {
        window.setStatusBarMessage(decorated);
    }
}

const logMessageHandler = (param: any) => {
    LOGGER.log(param.message);
}

const testProgressHandler = (param: any) => {
    const testAdapter = globalState.getTestAdapter();
    if (testAdapter) {
        testAdapter.testProgress(param.suite);
    }
}

const textEditorSetDecorationHandler = (param: any) => {
    let decorationType = globalState.getDecoration(param.key);
    if (decorationType) {
        let editorsWithUri = window.visibleTextEditors.filter(
            editor => editor.document.uri.toString() == param.uri
        );
        if (editorsWithUri.length > 0) {
            editorsWithUri[0].setDecorations(decorationType, asRanges(param.ranges));
            globalState.setDecorationParams(editorsWithUri[0].document.uri, param);
        }
    }
}

const textEditorDecorationDisposeHandler = (param: any) => {
    let decorationType = globalState.getDecoration(param);
    if (decorationType) {
        globalState.removeDecoration(param);
        decorationType.dispose();
        
        globalState.getDecorationParamsByUri().forEach((value, key) => {
            if (value.key == param) {
                globalState.removeDecorationParams(key);
            }
        });
    }
}


const telemetryEventHandler = (param: any) => {
    if(WorkspaceChangeEvent.NAME === param?.name){
        const {projectInfo, numProjects, lspInitTimeTaken, projInitTimeTaken} = param?.properties;
        const eventData: WorkspaceChangeData = {
            projectInfo,
            numProjects,
            lspInitTimeTaken,
            projInitTimeTaken
        };
        const workspaceChangeEvent: WorkspaceChangeEvent = new WorkspaceChangeEvent(eventData);
        Telemetry.sendTelemetry(workspaceChangeEvent);
        return;
    }
    const ls = globalState.getListener(param);
    if (ls) {
        for (const listener of ls) {
            commands.executeCommand(listener);
        }
    }
}

export const notificationListeners : notificationOrRequestListenerType[] = [{
    type: StatusMessageRequest.type,
    handler: showStatusBarMessageHandler
}, {
    type: LogMessageNotification.type,
    handler: logMessageHandler
}, {
    type: TestProgressNotification.type,
    handler: testProgressHandler
},{
    type: TextEditorDecorationSetNotification.type,
    handler: textEditorSetDecorationHandler
},{
    type: TextEditorDecorationDisposeNotification.type,
    handler: textEditorDecorationDisposeHandler
},{
    type: TelemetryEventNotification.type,
    handler: telemetryEventHandler
}];