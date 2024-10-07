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
import { LOGGER } from "../extension";
import { l10n } from "../localiser";
import { extCommands, nbCommands } from "./commands";
import { ICommand } from "./types";
import { wrapCommandWithProgress, wrapProjectActionWithProgress } from "./utils";

const compileWorkspaceCHandler = () => {
    wrapCommandWithProgress(nbCommands.buildWorkspace, l10n.value('jdk.extension.command.progress.compilingWorkSpace'), LOGGER.getOutputChannel(), true);
}
const cleanWorkspaceHandler = () => {
    wrapCommandWithProgress(nbCommands.cleanWorkspace,l10n.value('jdk.extension.command.progress.cleaningWorkSpace'), LOGGER.getOutputChannel(), true)
}

const compileProjectHandler = (args: any) => {
    wrapProjectActionWithProgress('build', undefined, l10n.value('jdk.extension.command.progress.compilingProject'), LOGGER.getOutputChannel(), true, args);
}

const cleanProjectHandler = (args: any) => {
    wrapProjectActionWithProgress('clean', undefined, l10n.value('jdk.extension.command.progress.cleaningProject'), LOGGER.getOutputChannel(), true, args);
}


export const registerBuildOperationCommands: ICommand[] = [
    {
        command: extCommands.compileWorkspace,
        handler: compileWorkspaceCHandler
    }, {
        command: extCommands.cleanWorkspace,
        handler: cleanWorkspaceHandler
    },{
        command: extCommands.compileProject,
        handler: compileProjectHandler
    },{
        command: extCommands.cleanProject,
        handler: cleanProjectHandler
    }
];