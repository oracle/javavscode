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
import { ConfigurationChangeEvent, env, workspace, Disposable } from "vscode";
import { getConfigurationValue, inspectConfiguration, updateConfigurationValue } from "../../configurations/handlers";
import { configKeys } from "../../configurations/configuration";
import { appendPrefixToCommand } from "../../utils";
import { ExtensionContextInfo } from "../../extensionContextInfo";
import { TelemetryPreference } from "../types";
import { cacheService } from "./cacheServiceImpl";
import { TELEMETRY_CONSENT_POPUP_TIME_KEY, TELEMETRY_CONSENT_VERSION_SCHEMA_KEY, TELEMETRY_SETTING_VALUE_KEY } from "../constants";
import { TelemetryConfiguration } from "../config";
import { LOGGER } from "../../logger";

export class TelemetrySettings {
  private isTelemetryEnabled: boolean;
  private extensionPrefs: ExtensionTelemetryPreference;
  private vscodePrefs: VscodeTelemetryPreference;

  constructor(
    extensionContext: ExtensionContextInfo,
    private onTelemetryEnableCallback: () => void,
    private onTelemetryDisableCallback: () => void,
    private triggerPopup: () => void) {

    this.extensionPrefs = new ExtensionTelemetryPreference();
    this.vscodePrefs = new VscodeTelemetryPreference();

    extensionContext.pushSubscription(
      this.extensionPrefs.onChangeTelemetrySetting(this.onChangeTelemetrySettingCallback)
    );
    extensionContext.pushSubscription(
      this.vscodePrefs.onChangeTelemetrySetting(this.onChangeTelemetrySettingCallback)
    );

    this.isTelemetryEnabled = this.checkTelemetryStatus();
    this.updateGlobalState();
    this.checkConsentVersion();
  }

  private checkTelemetryStatus = (): boolean => this.extensionPrefs.getIsTelemetryEnabled() && this.vscodePrefs.getIsTelemetryEnabled();

  private onChangeTelemetrySettingCallback = () => {
    const newTelemetryStatus = this.checkTelemetryStatus();
    if (newTelemetryStatus !== this.isTelemetryEnabled) {
      this.isTelemetryEnabled = newTelemetryStatus;
      cacheService.put(TELEMETRY_SETTING_VALUE_KEY, newTelemetryStatus.toString());

      if (newTelemetryStatus) {
        this.onTelemetryEnableCallback();
      } else {
        this.onTelemetryDisableCallback();
      }
    } else if (this.vscodePrefs.getIsTelemetryEnabled() && !this.extensionPrefs.isTelemetrySettingSet()) {
      this.triggerPopup();
    }
  }

  public getIsTelemetryEnabled = (): boolean => this.isTelemetryEnabled;

  public isConsentPopupToBeTriggered = (): boolean => {
    const isExtensionSettingSet = this.extensionPrefs.isTelemetrySettingSet();
    const isVscodeSettingEnabled = this.vscodePrefs.getIsTelemetryEnabled();

    const showPopup = !isExtensionSettingSet && isVscodeSettingEnabled;

    if (showPopup) {
      cacheService.put(TELEMETRY_CONSENT_POPUP_TIME_KEY, Date.now().toString());
    }

    return showPopup;
  }

  public updateTelemetrySetting = (value: boolean | undefined): void => {
    this.extensionPrefs.updateTelemetryConfig(value);
  }

  private updateGlobalState(): void {
    const cachedValue = cacheService.get(TELEMETRY_SETTING_VALUE_KEY);

    if (this.isTelemetryEnabled.toString() !== cachedValue) {
      cacheService.put(TELEMETRY_SETTING_VALUE_KEY, this.isTelemetryEnabled.toString());
    }
  }

  private checkConsentVersion(): void {
    const cachedVersion = cacheService.get(TELEMETRY_CONSENT_VERSION_SCHEMA_KEY);
    const currentVersion = TelemetryConfiguration.getInstance().getTelemetryConfigMetadata()?.consentSchemaVersion;

    if (cachedVersion !== currentVersion) {
      cacheService.put(TELEMETRY_CONSENT_VERSION_SCHEMA_KEY, currentVersion);
      LOGGER.debug("Removing telemetry config from user settings");
      if (this.extensionPrefs.isTelemetrySettingSet()) {
        this.updateTelemetrySetting(undefined);
      }
      this.isTelemetryEnabled = false;
    }
  }
}

class ExtensionTelemetryPreference implements TelemetryPreference {
  private isTelemetryEnabled: boolean | undefined;
  private readonly CONFIG = appendPrefixToCommand(configKeys.telemetryEnabled);

  constructor() {
    this.isTelemetryEnabled = getConfigurationValue(configKeys.telemetryEnabled, false);
  }

  public getIsTelemetryEnabled = (): boolean => this.isTelemetryEnabled === undefined ? false : this.isTelemetryEnabled;

  public onChangeTelemetrySetting = (callback: () => void): Disposable => workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
    if (e.affectsConfiguration(this.CONFIG)) {
      this.isTelemetryEnabled = getConfigurationValue(configKeys.telemetryEnabled, false);
      callback();
    }
  });

  public updateTelemetryConfig = (value: boolean | undefined): void => {
    this.isTelemetryEnabled = value;
    updateConfigurationValue(configKeys.telemetryEnabled, value, true);
  }

  public isTelemetrySettingSet = (): boolean => {
    if (this.isTelemetryEnabled === undefined) return false;
    const config = inspectConfiguration(this.CONFIG);
    return (
      config?.globalValue !== undefined ||
      config?.globalLanguageValue !== undefined
    );
  }
}

class VscodeTelemetryPreference implements TelemetryPreference {
  private isTelemetryEnabled: boolean;

  constructor() {
    this.isTelemetryEnabled = env.isTelemetryEnabled;
  }

  public getIsTelemetryEnabled = (): boolean => this.isTelemetryEnabled;

  public onChangeTelemetrySetting = (callback: () => void): Disposable => env.onDidChangeTelemetryEnabled((newSetting: boolean) => {
    this.isTelemetryEnabled = newSetting;
    callback();
  });
}

// Question:
// When consent version is changed, we have to show popup to all the users or only those who had accepted earlier?

// Test cases:
// 1. User accepts consent and VSCode telemetry is set to 'all'. Output: enabled telemetry
// 2. User accepts consent and VSCode telemetry is not set to 'all'. Output: disabled telemetry
// 3. User rejects consent and VSCode telemetry is set to 'all'. Output: disabled telemetry
// 4. User rejects consent and VSCode telemetry is not set to 'all'. Output: disabled telemetry
// 5. User changes from accept to reject consent and VSCode telemetry is set to 'all'. Output: disabled telemetry
// 6. User changes from accept to reject consent and VSCode telemetry is not set to 'all'. Output: disabled telemetry
// 7. User changes from reject to accept consent and VSCode telemetry is set to 'all'. Output: enabled telemetry
// 8. User changes from reject to accept consent and VSCode telemetry is not set to 'all'. Output: disabled telemetry
// 9. User accepts consent and VSCode telemetry is changed from 'all' to 'error'. Output: disabled telemetry
// 10. User accepts consent and VSCode telemetry is changed from 'error' to 'all'. Output: enabled telemetry
// 11. When consent schema version updated, pop up should trigger again.
// 12. When consent schema version updated, pop up should trigger again, if closed without selecting any value and again reloading the screen, it should pop-up again.: Disabled telemetry in settings
// 13. When consent schema version updated, pop up should trigger again, if selected yes and again reloading the screen, it shouldn't pop-up again. Output: Enabled telemetry in settings
// 14. When consent schema version updated, pop up should trigger again, if selected no and again reloading the screen, it shouldn't pop-up again. Output: Disabled telemetry in settings
// 15. When VSCode setting is changed from reject to accept, our pop-up should come.
