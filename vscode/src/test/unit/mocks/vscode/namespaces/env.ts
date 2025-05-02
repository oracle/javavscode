/*
  Copyright (c) 2024-2025, Oracle and/or its affiliates.

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

import * as vscode from 'vscode';
import { mock, when, anyString, anyOfClass, anything, instance } from "ts-mockito";

type VSCode = typeof vscode;

let mockedEnv: typeof vscode.env;
export const mockEnvNamespace = (mockedVSCode: Partial<VSCode>) => {
    mockedEnv = mock<typeof vscode.env>();
    mockedVSCode.env = instance(mockedEnv);
    mockTelemetryFields();
}

const mockTelemetryFields = () => {
    when(mockedEnv.machineId).thenReturn("00mocked-xVSx-Code-0000-machineIdxxx");
    when(mockedEnv.sessionId).thenReturn("00mocked-xVSx-Code-0000-sessionIdxxx");
}