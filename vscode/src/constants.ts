/*
  Copyright (c) 2023, Oracle and/or its affiliates.

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


export namespace extConstants {
  export const API_VERSION: string = "1.0";
  export const SERVER_NAME: string = "Oracle Java SE Language Server";
  export const NB_LANGUAGE_CLIENT_ID: string = 'Oracle Java SE';
  export const NB_LANGUAGE_CLIENT_NAME: string = "java";
  export const LANGUAGE_ID: string = "java";
  export const ORACLE_VSCODE_EXTENSION_ID = 'oracle.oracle-java';
  export const COMMAND_PREFIX = 'jdk';
}

export namespace jdkDownloaderConstants {
  export const JDK_RELEASES_TRACK_URL = `https://www.java.com/releases/releases.json`;

  export const ORACLE_JDK_BASE_DOWNLOAD_URL = `https://download.oracle.com/java`;

  export const ORACLE_JDK_DOWNLOAD_VERSIONS = ['23', '21'];

  export const OPEN_JDK_VERSION_DOWNLOAD_LINKS: { [key: string]: string } = {
    "23": "https://download.java.net/java/GA/jdk23.0.1/c28985cbf10d4e648e4004050f8781aa/11/GPL/openjdk-23.0.1"
  };
}

export const NODE_WINDOWS_LABEL = "Windows_NT";
