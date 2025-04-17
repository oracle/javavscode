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
import { window } from "vscode";
import { TelemetrySettings } from "./impl/telemetryPrefs";
import { TelemetryEventQueue } from "./impl/telemetryEventQueue";
import { TelemetryReporterImpl } from "./impl/telemetryReporterImpl";
import { TelemetryReporter } from "./types";
import { LOGGER } from "../logger";
import { ExtensionContextInfo } from "../extensionContextInfo";
import { l10n } from "../localiser";
import { TelemetryRetry } from "./impl/telemetryRetry";

export class TelemetryManager {
    private extensionContextInfo: ExtensionContextInfo;
    private settings: TelemetrySettings;
    private reporter?: TelemetryReporter;
    private telemetryRetryManager: TelemetryRetry = new TelemetryRetry()

    constructor(extensionContextInfo: ExtensionContextInfo) {
        this.extensionContextInfo = extensionContextInfo;
        this.settings = new TelemetrySettings(extensionContextInfo, 
            this.onTelemetryEnable, 
            this.onTelemetryDisable,
            this.openTelemetryDialog);
    }

    public isTelemetryEnabled = (): boolean => {
        return this.settings.getIsTelemetryEnabled();
    }

    public initializeReporter = (): void => {
        const queue = new TelemetryEventQueue();
        this.reporter = new TelemetryReporterImpl(queue, this.telemetryRetryManager);

        this.isTelemetryEnabled() ? this.onTelemetryEnable() : this.openTelemetryDialog();
    }

    public getReporter = (): TelemetryReporter | null => {
        return this.reporter || null;
    }

    private openTelemetryDialog = async () => {
        if (this.settings?.isConsentPopupToBeTriggered()) {
            LOGGER.log('Telemetry not enabled yet');

            const yesLabel = l10n.value("jdk.downloader.message.confirmation.yes");
            const noLabel = l10n.value("jdk.downloader.message.confirmation.no");
            const telemetryLabel = l10n.value("jdk.telemetry.consent", { extensionName: this.extensionContextInfo.getPackageJson().name });

            const enable = await window.showInformationMessage(telemetryLabel, yesLabel, noLabel);
            if (enable == undefined) {
                return;
            }

            this.settings.updateTelemetrySetting(enable === yesLabel);
        }
    }

    private onTelemetryEnable = () => {
        LOGGER.log("Telemetry is now enabled");
        this.reporter?.startEvent();
    }

    private onTelemetryDisable = () => {
        LOGGER.log("Telemetry is now disabled");
        this.reporter?.closeEvent();
    }
};