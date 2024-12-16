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
import * as os from 'os';
import { env as vscodeEnv, version } from 'vscode';
import { ExtensionContextInfo } from '../../extensionContextInfo';
import { StartEventData } from '../events/start';

const getPlatform = (): string => {
    const platform: string = os.platform();
    if (platform.startsWith('darwin')) {
        return 'Mac';
    }
    if (platform.startsWith('win')) {
        return 'Windows';
    }
    return platform.charAt(0).toUpperCase() + platform.slice(1);
}

const getArchType = (): string => {
    return os.arch();
}

const getPlatformVersion = (): string => {
    return os.release();
}

const getTimeZone = (): string => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const getLocale = (): string => {
    return Intl.DateTimeFormat().resolvedOptions().locale;
}

export const PLATFORM = getPlatform();
export const ARCH_TYPE = getArchType();
export const PLATFORM_VERSION = getPlatformVersion();
export const TIMEZONE = getTimeZone();
export const LOCALE = getLocale();

export const getEnvironmentInfo = (contextInfo: ExtensionContextInfo): StartEventData => {
    return {
        extension: {
            id: contextInfo.getExtensionId(),
            name: contextInfo.getPackageJson().name,
            version: contextInfo.getPackageJson().version
        },
        vsCode: {
            version: version,
            hostType: vscodeEnv.appHost,
            locale: vscodeEnv.language,
        },
        platform: {
            os: PLATFORM,
            arch: ARCH_TYPE,
            osVersion: PLATFORM_VERSION,
        },
        location: {
            timeZone: TIMEZONE,
            locale: LOCALE,
        }
    };
}