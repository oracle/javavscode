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
import { TelemetryManager } from "./telemetryManager";
import { ExtensionContextInfo } from "../extensionContextInfo";
import { LOGGER } from "../logger";
import { BaseEvent } from "./events/baseEvent";

export namespace Telemetry {

	let telemetryManager: TelemetryManager;

	export const initializeTelemetry = (contextInfo: ExtensionContextInfo): TelemetryManager => {
		if (!!telemetryManager) {
			LOGGER.warn("Telemetry is already initialized");
			return telemetryManager;
		}
		telemetryManager = new TelemetryManager(contextInfo);
		telemetryManager.initializeReporter();

		return telemetryManager;
	}

	export const sendTelemetry = (event: BaseEvent<any>): void => {
		if (!telemetryManager.isExtTelemetryEnabled()) {
			return;
		}

		telemetryManager.getReporter()?.addEventToQueue(event);
	}

	export const enqueueStartEvent = (): void => {
		telemetryManager.getReporter()?.startEvent();
	}

	export const enqueueCloseEvent = (): void => {
		telemetryManager.getReporter()?.closeEvent();
	}
}
