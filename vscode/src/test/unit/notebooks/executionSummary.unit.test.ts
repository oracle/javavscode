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
import { ExecutionSummary, ExecutionSummaryData } from '../../../notebooks/executionSummary';
import { describe, it } from 'mocha';

describe('ExecutionSummary', () => {
  describe('constructor defaults', () => {
    it('defaults to null executionOrder and false success', () => {
      const es = new ExecutionSummary();
      expect(es.executionOrder).to.be.null;
      expect(es.success).to.equal(false);
    });

    it('accepts explicit values', () => {
      const es = new ExecutionSummary(3, true);
      expect(es.executionOrder).to.equal(3);
      expect(es.success).to.equal(true);

      const es2 = new ExecutionSummary(0, false);
      expect(es2.executionOrder).to.equal(0);
      expect(es2.success).to.equal(false);
    });
  });

  describe('static fromMetadata()', () => {
    it('returns defaults when meta and fallback are undefined', () => {
      const es = ExecutionSummary.fromMetadata();
      expect(es.executionOrder).to.be.null;
      expect(es.success).to.equal(false);
    });

    it('uses fallbackExecCount when meta.executionOrder is undefined', () => {
      const es = ExecutionSummary.fromMetadata({}, 7);
      expect(es.executionOrder).to.equal(7);
      expect(es.success).to.equal(false);
    });

    it('uses fallbackExecCount when meta.executionOrder is null', () => {
      const meta: ExecutionSummaryData = { executionOrder: null };
      const es = ExecutionSummary.fromMetadata(meta, 12);
      expect(es.executionOrder).to.equal(12);
      expect(es.success).to.equal(false);
    });

    it('ignores fallback when meta.executionOrder is provided', () => {
      const meta: ExecutionSummaryData = { executionOrder: 5, success: true };
      const es = ExecutionSummary.fromMetadata(meta, 10);
      expect(es.executionOrder).to.equal(5);
      expect(es.success).to.equal(true);
    });

    it('defaults success to false if meta.success is undefined', () => {
      const meta: ExecutionSummaryData = { executionOrder: 2 };
      const es = ExecutionSummary.fromMetadata(meta, null);
      expect(es.executionOrder).to.equal(2);
      expect(es.success).to.equal(false);
    });

    it('respects meta.success when false explicitly', () => {
      const meta: ExecutionSummaryData = { executionOrder: 8, success: false };
      const es = ExecutionSummary.fromMetadata(meta, 1);
      expect(es.executionOrder).to.equal(8);
      expect(es.success).to.equal(false);
    });
  });

  describe('toJSON()', () => {
    it('serializes current state to ExecutionSummaryData', () => {
      const es = new ExecutionSummary(9, true);
      const json = es.toJSON();
      expect(json).to.deep.equal({ executionOrder: 9, success: true });
    });

    it('handles null executionOrder serialization', () => {
      const es = new ExecutionSummary(null, false);
      const json = es.toJSON();
      expect(json).to.deep.equal({ executionOrder: null, success: false });
    });

    it('round-trips fromMetadata → toJSON', () => {
      const meta: ExecutionSummaryData = { executionOrder: 15, success: true };
      const es = ExecutionSummary.fromMetadata(meta, 20);
      const json = es.toJSON();
      expect(json).to.deep.equal(meta);
    });

    it('round-trips fallbackExecCount when meta missing', () => {
      const es = ExecutionSummary.fromMetadata(undefined, 33);
      const json = es.toJSON();
      expect(json).to.deep.equal({ executionOrder: 33, success: false });
    });
  });
});
