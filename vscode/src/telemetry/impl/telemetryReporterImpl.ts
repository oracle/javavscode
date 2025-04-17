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
import { getCurrentUTCDateInSeconds } from "../utils";
import { TelemetryEventQueue } from "./telemetryEventQueue";
import { TelemetryReporter } from "../types";
import { LOGGER } from "../../logger";
import { isError } from "../../utils";
import { BaseEvent } from "../events/baseEvent";
import { ExtensionCloseEvent } from "../events/close";
import { ExtensionStartEvent } from "../events/start";
import { TelemetryRetry } from "./telemetryRetry";
import { JdkFeatureEvent } from "../events/jdkFeature";
import { PostTelemetry, TelemetryPostResponse } from "./postTelemetry";

export class TelemetryReporterImpl implements TelemetryReporter {
    private activationTime: number = getCurrentUTCDateInSeconds();
    private postTelemetry: PostTelemetry = new PostTelemetry();
    private onCloseEventState: { status: boolean, numOfRetries: number } = { status: false, numOfRetries: 0 };
    private readonly MAX_RETRY_ON_CLOSE = 5;

    constructor(
        private queue: TelemetryEventQueue,
        private retryManager: TelemetryRetry,
    ) {
        this.retryManager.registerCallbackHandler(this.sendEvents);
    }

    public startEvent = (): void => {
        this.setOnCloseEventState();
        this.retryManager.startTimer();

        const extensionStartEvent = ExtensionStartEvent.builder();
        if (extensionStartEvent != null) {
            this.addEventToQueue(extensionStartEvent);
            LOGGER.debug(`Start event enqueued: ${extensionStartEvent.getPayload}`);
        }
    }

    public closeEvent = (): void => {
        const extensionCloseEvent = ExtensionCloseEvent.builder(this.activationTime);
        this.addEventToQueue(extensionCloseEvent);

        LOGGER.debug(`Close event enqueued: ${extensionCloseEvent.getPayload}`);
        this.sendEvents();
    }

    public addEventToQueue = (event: BaseEvent<any>): void => {
        this.setOnCloseEventState(event);

        this.queue.enqueue(event);
        if (this.retryManager.isQueueOverflow(this.queue.size())) {
            LOGGER.debug(`Send triggered to queue size overflow`);
            const numOfeventsToBeDropped = this.retryManager.getNumberOfEventsToBeDropped();
            this.sendEvents();
            if (numOfeventsToBeDropped) {
                this.queue.decreaseSizeOnMaxOverflow(numOfeventsToBeDropped);
            }
        }
    }

    private setOnCloseEventState = (event?: BaseEvent<any>) => {
        if (event?.NAME === ExtensionCloseEvent.NAME) {
            this.onCloseEventState = {
                status: true,
                numOfRetries: 0
            };
        } else {
            this.onCloseEventState = {
                status: false,
                numOfRetries: 0
            };
        }
    }

    private increaseRetryCountOrDisableRetry = () => {
        if (!this.onCloseEventState.status) return;

        const queueEmpty = this.queue.size() === 0;
        const retriesExceeded = this.onCloseEventState.numOfRetries >= this.MAX_RETRY_ON_CLOSE;

        if (queueEmpty || retriesExceeded) {
            LOGGER.debug(`Telemetry disabled state: ${queueEmpty ? 'Queue is empty' : 'Max retries reached'}, clearing timer`);
            this.retryManager.clearTimer();
            this.queue.flush();
            this.setOnCloseEventState();
        } else {
            LOGGER.debug("Telemetry disabled state: Increasing retry count");
            this.onCloseEventState.numOfRetries++;
        }
    };

    private sendEvents = async (): Promise<void> => {
        try {
            if (!this.queue.size()) {
                LOGGER.debug(`Queue is empty nothing to send`);
                return;
            }
            const eventsCollected = this.queue.flush();

            LOGGER.debug(`Number of events to send: ${eventsCollected.length}`);
            this.retryManager.clearTimer();

            const transformedEvents = this.transformEvents(eventsCollected);

            const response = await this.postTelemetry.post(transformedEvents);

            LOGGER.debug(`Number of events successfully sent: ${response.success.length}`);
            LOGGER.debug(`Number of events failed to send: ${response.failures.length}`);
            const isAllEventsSuccess = this.handlePostTelemetryResponse(response);

            this.retryManager.startTimer(isAllEventsSuccess);

            this.increaseRetryCountOrDisableRetry();
        } catch (err: any) {
            LOGGER.debug(`Error while sending telemetry: ${isError(err) ? err.message : err}`);
        }
    }

    private transformEvents = (events: BaseEvent<any>[]): BaseEvent<any>[] => {
        const jdkFeatureEvents = events.filter(event => event.NAME === JdkFeatureEvent.NAME);
        const concatedEvents = JdkFeatureEvent.concatEvents(jdkFeatureEvents);
        const removedJdkFeatureEvents = events.filter(event => event.NAME !== JdkFeatureEvent.NAME);

        return [...removedJdkFeatureEvents, ...concatedEvents];
    }

    private handlePostTelemetryResponse = (response: TelemetryPostResponse): boolean => {
        const eventsToBeEnqueued = this.retryManager.eventsToBeEnqueuedAgain(response);

        this.queue.concatQueue(eventsToBeEnqueued);

        LOGGER.debug(`Number of failed events enqueuing again: ${eventsToBeEnqueued.length}`);

        return eventsToBeEnqueued.length === 0;
    }
}