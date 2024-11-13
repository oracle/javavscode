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
import { LOGGER } from "../../logger";
import { TELEMETRY_API } from "../config";
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
    public post = async (events: BaseEvent<any>[]): Promise<TelemetryPostResponse> => {
        try {
            if (TELEMETRY_API.baseUrl == null) {
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
        return `${TELEMETRY_API.baseUrl}${TELEMETRY_API.baseEndpoint}${TELEMETRY_API.version}${endpoint}`;
    }

    private postEvent = (event: BaseEvent<any>): Promise<Response> => {
        const { ENDPOINT, getPayload: payload } = event;

        const serverEndpoint = this.addBaseEndpoint(ENDPOINT);

        return fetch(serverEndpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    private parseTelemetryResponse = (events: BaseEvent<any>[], eventResponses: PromiseSettledResult<Response>[]): TelemetryPostResponse => {
        let success: TelemetryEventResponse[] = [], failures: TelemetryEventResponse[] = [];
        eventResponses.forEach((eventResponse, index) => {
            const event = events[index];
            if (eventResponse.status === "rejected") {
                failures.push({
                    event,
                    statusCode: -1
                });
            } else {
                success.push({
                    statusCode: eventResponse.value.status,
                    event
                });
            }
        });

        return {
            success,
            failures
        };
    }
}