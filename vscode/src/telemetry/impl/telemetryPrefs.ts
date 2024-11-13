/*
  Copyright (c) 2024, Oracle and/or its affiliates.

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
import { ConfigurationChangeEvent, env, workspace } from "vscode";
import { getConfigurationValue, inspectConfiguration, updateConfigurationValue } from "../../configurations/handlers";
import { configKeys } from "../../configurations/configuration";
import { appendPrefixToCommand } from "../../utils";

export class TelemetryPrefs {
  public isExtTelemetryEnabled: boolean;

  constructor() {
    this.isExtTelemetryEnabled = this.checkTelemetryStatus();
  }

  private checkTelemetryStatus = (): boolean => {
    return getConfigurationValue(configKeys.telemetryEnabled, false);
  }

  private configPref = (configCommand: string): boolean => {
    const config = inspectConfiguration(configCommand);
    return (
      config?.workspaceFolderValue !== undefined ||
      config?.workspaceFolderLanguageValue !== undefined ||
      config?.workspaceValue !== undefined ||
      config?.workspaceLanguageValue !== undefined ||
      config?.globalValue !== undefined ||
      config?.globalLanguageValue !== undefined
    );
  }

  public isExtTelemetryConfigured = (): boolean => {
    return this.configPref(appendPrefixToCommand(configKeys.telemetryEnabled));
  }

  public updateTelemetryEnabledConfig = (value: boolean): void => {
    this.isExtTelemetryEnabled = value;
    updateConfigurationValue(configKeys.telemetryEnabled, value, true);
  }

  public didUserDisableVscodeTelemetry = (): boolean => {
    return !env.isTelemetryEnabled;
  }

  public onDidChangeTelemetryEnabled = () => workspace.onDidChangeConfiguration(
    (e: ConfigurationChangeEvent) => {
      if (e.affectsConfiguration(appendPrefixToCommand(configKeys.telemetryEnabled))) {
        this.isExtTelemetryEnabled = this.checkTelemetryStatus();
      }
    }
  );
}