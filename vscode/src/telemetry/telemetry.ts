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
import { TelemetryReporter } from "./types";

export namespace Telemetry {

	let telemetryManager: TelemetryManager;
	export const isTelemetryFeatureAvailable = process.env["oracle.oracle-java.enable.telemetry"] === "true";

	export const initializeTelemetry = (contextInfo: ExtensionContextInfo): TelemetryManager => {
		if (!!telemetryManager) {
			LOGGER.warn("Telemetry is already initialized");
			return telemetryManager;
		}
		telemetryManager = new TelemetryManager(contextInfo);
		if (isTelemetryFeatureAvailable) {
			telemetryManager.initializeReporter();
		}

		return telemetryManager;
	}

	const enqueueEvent = (cbFunction: (reporter: TelemetryReporter) => void) => {
		if (telemetryManager.isExtTelemetryEnabled() && isTelemetryFeatureAvailable) {
			const reporter = telemetryManager.getReporter();
			if (reporter) {
				cbFunction(reporter);
			}
		}
	}

	export const sendTelemetry = (event: BaseEvent<any>): void => {
		enqueueEvent((reporter) => reporter.addEventToQueue(event));
	}

	export const enqueueStartEvent = (): void => {
		enqueueEvent((reporter) => reporter.startEvent());
	}

	export const enqueueCloseEvent = (): void => {
		enqueueEvent((reporter) => reporter.closeEvent());
	}
}
