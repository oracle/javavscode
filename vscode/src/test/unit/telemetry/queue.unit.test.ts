/*
  Copyright (c) 2025, Oracle and/or its affiliates.

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

import { expect } from 'chai';
import * as sinon from 'sinon';
import { TelemetryEventQueue } from '../../../telemetry/impl/telemetryEventQueue';
import { BaseEvent } from '../../../telemetry/events/baseEvent';
import { LOGGER } from '../../../logger';
import { describe, it, beforeEach, afterEach } from 'mocha';

describe('TelemetryEventQueue', () => {
    let queue: TelemetryEventQueue;
    let loggerStub: sinon.SinonStub;

    class MockEvent extends BaseEvent<any> {
        public static readonly NAME = "mock";
        public static readonly ENDPOINT = "/mock";


        constructor(name?: string, data?: any) {
            super(name || MockEvent.NAME, MockEvent.ENDPOINT, data || {});
        }
    }

    beforeEach(() => {
        queue = new TelemetryEventQueue();

        loggerStub = sinon.stub(LOGGER, 'debug');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('enqueue', () => {
        it('should add an event to the queue', () => {
            const event = new MockEvent();
            queue.enqueue(event);
            expect(queue.size()).to.equal(1);
        });

        it('should add multiple events in order', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');

            queue.enqueue(event1);
            queue.enqueue(event2);

            const firstEvent = queue.dequeue();
            expect(firstEvent).to.equal(event1);
            expect(queue.size()).to.equal(1);
        });
    });

    describe('dequeue', () => {
        it('should remove and return the first event from the queue', () => {
            const event = new MockEvent();
            queue.enqueue(event);

            const dequeuedEvent = queue.dequeue();
            expect(dequeuedEvent).to.equal(event);
            expect(queue.size()).to.equal(0);
        });

        it('should return undefined if queue is empty', () => {
            const dequeuedEvent = queue.dequeue();
            expect(dequeuedEvent).to.be.undefined;
        });
    });

    describe('concatQueue', () => {
        it('should append events to the end of the queue by default', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');
            const event3 = new MockEvent('event3');

            queue.enqueue(event1);
            queue.concatQueue([event2, event3]);

            expect(queue.size()).to.equal(3);
            expect(queue.dequeue()).to.equal(event1);
            expect(queue.dequeue()).to.equal(event2);
            expect(queue.dequeue()).to.equal(event3);
        });

        it('should prepend events to the start of the queue when mergeAtStarting is true', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');
            const event3 = new MockEvent('event3');

            queue.enqueue(event1);
            queue.concatQueue([event2, event3], true);

            expect(queue.size()).to.equal(3);
            expect(queue.dequeue()).to.equal(event2);
            expect(queue.dequeue()).to.equal(event3);
            expect(queue.dequeue()).to.equal(event1);
        });
    });

    describe('size', () => {
        it('should return the number of events in the queue', () => {
            expect(queue.size()).to.equal(0);

            queue.enqueue(new MockEvent('event1'));
            expect(queue.size()).to.equal(1);

            queue.enqueue(new MockEvent('event2'));
            expect(queue.size()).to.equal(2);

            queue.dequeue();
            expect(queue.size()).to.equal(1);
        });
    });

    describe('flush', () => {
        it('should return all events and empty the queue', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');

            queue.enqueue(event1);
            queue.enqueue(event2);

            const flushedEvents = queue.flush();

            expect(flushedEvents).to.deep.equal([event1, event2]);
            expect(queue.size()).to.equal(0);
        });
    });

    describe('decreaseSizeOnMaxOverflow', () => {
        it('should do nothing if queue size is below the max', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');

            queue.enqueue(event1);
            queue.enqueue(event2);

            queue.adjustQueueSize(5);

            expect(queue.size()).to.equal(2);
            expect(loggerStub.called).to.be.false;
        });

        it('should log and deduplicate events when queue exceeds max size', () => {
            const event1 = new MockEvent('event1');
            const event2 = new MockEvent('event2');
            const event3 = new MockEvent('event1');
            const event4 = new MockEvent('event3');
            const event5 = new MockEvent('event4');
            const event6 = new MockEvent('event5');

            queue.enqueue(event1);
            queue.enqueue(event2);
            queue.enqueue(event3);
            queue.enqueue(event4);
            queue.enqueue(event5);
            queue.enqueue(event6);

            queue.adjustQueueSize(3);

            expect(queue.size()).to.equal(5);
            expect(loggerStub.calledOnce).to.be.true;

            const remainingEvents = queue.flush();
            const eventNames = remainingEvents.map(e => e.NAME);
            expect(eventNames).to.deep.equal(['event1', 'event2', 'event3', 'event4', 'event5']);
        });
    });

});