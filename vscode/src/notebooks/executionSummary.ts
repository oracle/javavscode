/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export interface ExecutionSummaryData {
  executionOrder?: number | null;
  success?: boolean;
}

export class ExecutionSummary {
  constructor(
    public executionOrder: number | null = null,
    public success: boolean = false
  ) {}

  static fromMetadata(
    meta?: ExecutionSummaryData,
    fallbackExecCount?: number | null
  ): ExecutionSummary {
    const order =
      meta?.executionOrder != null
        ? meta.executionOrder
        : fallbackExecCount ?? null;
    const success = meta?.success ?? false;
    return new ExecutionSummary(order, success);
  }

  toJSON(): ExecutionSummaryData {
    return {
      executionOrder: this.executionOrder,
      success: this.success,
    };
  }
}
