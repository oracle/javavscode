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
    private disableReporter: boolean = false;
    private postTelemetry: PostTelemetry = new PostTelemetry();

    constructor(
        private queue: TelemetryEventQueue,
        private retryManager: TelemetryRetry,
    ) {
        this.retryManager.registerCallbackHandler(this.sendEvents);
    }

    public startEvent = (): void => {
        const extensionStartEvent = ExtensionStartEvent.builder();
        if(extensionStartEvent != null){
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
        if (!this.disableReporter) {
            this.queue.enqueue(event);
            if (this.retryManager.isQueueOverflow(this.queue.size())) {
                LOGGER.debug(`Send triggered to queue size overflow`);
                this.sendEvents();
            }
        }
    }

    private sendEvents = async (): Promise<void> => {
        try {
            if(!this.queue.size()){
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
            this.handlePostTelemetryResponse(response);

            this.retryManager.startTimer();
        } catch (err: any) {
            this.disableReporter = true;
            LOGGER.debug(`Error while sending telemetry: ${isError(err) ? err.message : err}`);
        }
    }
    
    private transformEvents = (events: BaseEvent<any>[]): BaseEvent<any>[] => {
        const jdkFeatureEvents = events.filter(event => event.NAME === JdkFeatureEvent.NAME);
        const concatedEvents = JdkFeatureEvent.concatEvents(jdkFeatureEvents);
        const removedJdkFeatureEvents = events.filter(event => event.NAME !== JdkFeatureEvent.NAME);
        
        return [...removedJdkFeatureEvents, ...concatedEvents];
    }

    private handlePostTelemetryResponse = (response: TelemetryPostResponse) => {
        const eventsToBeEnqueued = this.retryManager.eventsToBeEnqueuedAgain(response);

        this.queue.concatQueue(eventsToBeEnqueued);

        LOGGER.debug(`Number of failed events enqueuing again: ${eventsToBeEnqueued.length}`);
    }
}