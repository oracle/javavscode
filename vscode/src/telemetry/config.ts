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
import { RetryConfig, TelemetryApi } from "./types";

export const TELEMETRY_RETRY_CONFIG: RetryConfig = Object.freeze({
    maxRetries: 6,
    baseCapacity: 256,
    baseTimer: 5 * 1000,
    maxDelayMs: 100 * 1000,
    backoffFactor: 2,
    jitterFactor: 0.25
});

export const TELEMETRY_API: TelemetryApi = Object.freeze({
    baseUrl: null,
    baseEndpoint: "/vscode/java/sendTelemetry",
    version: "/v1"
});