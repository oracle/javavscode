/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

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

export const getOsType = (): string => {
    switch (process.platform) {
        case "linux":
            return "linux";
        case "darwin":
            return "macOS";
        default:
            return "windows";
    }
}

export const getMachineArch = (): string => {
    switch (process.arch) {
        case "arm64":
            return "aarch64";
        default:
            return "x64";
    }
}

export const getHtmlTagContent = (html: string, tagName: string): string => {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
    const match = html.match(regex);
    return match?.[1]?.trim() || '';
}

export const checkTagContentNotEmpty = (html: string, tagName: string): boolean => {
    const content = getHtmlTagContent(html, tagName);
    return content.length !== 0;
}

export const enableMockedLoggers = (sandbox: sinon.SinonSandbox) => {
    sandbox.stub(LOGGER, 'log').callsFake((message) => {
        console.log(message);
      });
      sandbox.stub(LOGGER, 'error').callsFake((message) => {
        console.error(message);
      });
      sandbox.stub(LOGGER, 'warn').callsFake((message) => {
        console.warn(message);
      });
}