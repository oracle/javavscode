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
import { integer } from "vscode-languageclient";
import { LOGGER } from "../../logger";
import { TelemetryConfiguration } from "../config";
import { BaseEvent } from "../events/baseEvent";

interface TelemetryEventResponse {
    statusCode: number;
    event: BaseEvent<any>;
};

export interface TelemetryPostResponse {
    success: TelemetryEventResponse[];
    failures: TelemetryEventResponse[];
};

export class PostTelemetry {
    private TELEMETRY_API = TelemetryConfiguration.getInstance().getApiConfig();

    public post = async (events: BaseEvent<any>[]): Promise<TelemetryPostResponse> => {
        try {
            if (this.TELEMETRY_API.baseUrl == null) {
                return {
                    success: [],
                    failures: []
                }
            }
            LOGGER.debug("Posting telemetry...");
            const results = await Promise.allSettled(events.map(event => this.postEvent(event)));

            return this.parseTelemetryResponse(events, results);
        } catch (err) {
            LOGGER.debug(`Error occurred while posting telemetry : ${(err as Error)?.message}`);
            throw err;
        }
    };

    private addBaseEndpoint = (endpoint: string) => {
        return `${this.TELEMETRY_API.baseUrl}${this.TELEMETRY_API.baseEndpoint}${this.TELEMETRY_API.version}${endpoint}`;
    }

    private postEvent = (event: BaseEvent<any>): Promise<Response> => {
        const { ENDPOINT, getPayload: payload } = event;

        const serverEndpoint = this.addBaseEndpoint(ENDPOINT);

        return fetch(serverEndpoint, {
            method: "POST",
            body: JSON.stringify(payload),
            redirect: "follow",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });
    }

    private parseTelemetryResponse = (events: BaseEvent<any>[], eventResponses: PromiseSettledResult<Response>[]): TelemetryPostResponse => {
        let success: TelemetryEventResponse[] = [], failures: TelemetryEventResponse[] = [];
        eventResponses.forEach((eventResponse, index) => {
            const event = events[index];
            let list: TelemetryEventResponse[] = success;
            let statusCode: integer = 0;
            if (eventResponse.status === "rejected") {
                list = failures;
                statusCode = -1;
            } else {
                statusCode = eventResponse.value.status;
                if (statusCode <= 0 || statusCode >= 400) {
                    list = failures;
                }
            }
            list.push({
                event,
                statusCode
            });
        });

        return {
            success,
            failures
        };
    }
}