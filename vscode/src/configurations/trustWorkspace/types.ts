/*
  Copyright (c) 2026, Oracle and/or its affiliates.

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

import { QuickPickItem, Uri } from "vscode";

export const TRUST_TYPE = Object.freeze({
    TRUSTED: 'TRUSTED',
    NOT_TRUSTED: 'NOT_TRUSTED'
});

export type TrustType = typeof TRUST_TYPE[keyof typeof TRUST_TYPE];

export const enum SettingLocation {
    FOLDER,
    WORKSPACE_FILE
}

export type SettingLocationTrustDecision = {
    uri: Uri,
    type: SettingLocation,
    isUserInputAvailable: boolean,
    isTrusted: boolean,
}

export type TrustQuickPickItem = QuickPickItem & {
    resource: SettingLocationTrustDecision
}
