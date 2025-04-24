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
import { RetryConfig, TelemetryApi, TelemetryConfigMetadata } from "./types";
import * as path from 'path';
import * as fs from 'fs';
import { LOGGER } from "../logger";

export class TelemetryConfiguration {
  private static CONFIG_FILE_PATH = path.resolve(__dirname, "..", "..", "telemetryConfig.json");

  private static instance: TelemetryConfiguration;
  private retryConfig!: RetryConfig;
  private apiConfig!: TelemetryApi;
  private metadata!: TelemetryConfigMetadata;

  public constructor() {
    this.initialize();
  }

  public static getInstance(): TelemetryConfiguration {
    if (!TelemetryConfiguration.instance) {
      TelemetryConfiguration.instance = new TelemetryConfiguration();
    }
    return TelemetryConfiguration.instance;
  }

  private initialize(): void {
    try {
      const config = JSON.parse(fs.readFileSync(TelemetryConfiguration.CONFIG_FILE_PATH).toString());

      this.retryConfig = Object.freeze({
        maxRetries: config.telemetryRetryConfig.maxRetries,
        baseCapacity: config.telemetryRetryConfig.baseCapacity,
        baseTimer: config.telemetryRetryConfig.baseTimer,
        maxDelayMs: config.telemetryRetryConfig.maxDelayMs,
        backoffFactor: config.telemetryRetryConfig.backoffFactor,
        jitterFactor: config.telemetryRetryConfig.jitterFactor
      });

      this.apiConfig = Object.freeze({
        baseUrl: config.telemetryApi.baseUrl,
        baseEndpoint: config.telemetryApi.baseEndpoint,
        version: config.telemetryApi.version
      });

      this.metadata = Object.freeze({
        consentSchemaVersion: config.metadata.consentSchemaVersion
      });

    } catch (error: any) {
      LOGGER.error("Error occurred while setting up telemetry config");
      LOGGER.error(error.message);
    }
  }

  public getRetryConfig(): Readonly<RetryConfig> {
    return this.retryConfig;
  }

  public getApiConfig(): Readonly<TelemetryApi> {
    return this.apiConfig;
  }

  public getTelemetryConfigMetadata(): Readonly<TelemetryConfigMetadata> {
    return this.metadata;
  }
}