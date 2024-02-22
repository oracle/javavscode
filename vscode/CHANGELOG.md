# Change Log

<!--

    Copyright (c) 2023, Oracle and/or its affiliates.

    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

-->

<!-- This file has been modified for Oracle Java SE extension -->

## Version 1.0.0
* Initial release

## Version 1.0.1
### What’s Changed

### Enhancements
* Working with JDK 22 ea binaries added https://github.com/apache/netbeans/pull/6742
* [JAVAVSCODE-16] Added option for running any Java project using context menu https://github.com/oracle/javavscode/pull/75
* [JAVAVSCODE-22] Added support for using different jdk in each workspace and deprecated jdk.userdir configuration https://github.com/oracle/javavscode/pull/67
* [JAVAVSCODE-28] Include TestNG tests in the test explorer.https://github.com/oracle/javavscode/pull/40
* [JAVAVSCODE-56] Added “Go To Test” option https://github.com/oracle/javavscode/pull/93
* [JAVAVSCODE-60] Added a configuration for user-defined vm arguments to start the Java language server https://github.com/oracle/javavscode/pull/63
* [JAVAVSCODE-69] Add a warning for cases like var foo = new ArrayList<>(); https://github.com/apache/netbeans/pull/6780
* [JAVAVSCODE-76] Support for parameter hints added https://github.com/apache/netbeans/pull/6476
* [JAVAVSCODE-78] Added checksum match for jdk downloader https://github.com/oracle/javavscode/pull/81
* [JAVAVSCODE-80] Renamed downloaded jdk binaries so that it is not replaced by the already present binaries https://github.com/oracle/javavscode/pull/82
* Upgraded available JDK versions in JDK downloader https://github.com/oracle/javavscode/pull/104
* Update to NetBeans 20 https://github.com/oracle/javavscode/pull/92

### Bugs
* [JAVAVSCODE-23] Class outline/structure missing in some cases fixed https://github.com/apache/netbeans/pull/6642
* [JAVAVSCODE-24]  Error on formatting pom.xml fixed https://github.com/apache/netbeans/pull/6631
* [JAVAVSCODE-26] Don’t create “lock files” in the user’s project folders https://github.com/apache/netbeans/pull/6690
* [JAVAVSCODE-35] String templates break formatting fixed https://github.com/apache/netbeans/pull/6637
* [JAVAVSCODE-48] Renaming variable fails when using string template fixed https://github.com/apache/netbeans/pull/6637
* [JAVAVSCODE-52] Avoiding crash during indexing when a record has a component with a wrong name https://github.com/apache/netbeans/pull/6649
* [JAVAVSCODE-53] Incorrect hint “The assigned value is never used” fixed https://github.com/apache/netbeans/pull/6635
* [JAVAVSCODE-62] “The collection is only added to, never read” warning now detects forEach https://github.com/apache/netbeans/pull/6646
* [JAVAVSCODE-71] Updated download.jdk command configuration to open JDK downloader window even if no folder is open in workspace https://github.com/oracle/javavscode/pull/72
* [JAVAVSCODE-73] Symbols defined in a different file but the same packages are now defined https://github.com/apache/netbeans/pull/6329
* [JAVAVSCODE-86] “Surround with...” option fixed under refactor options https://github.com/oracle/javavscode/pull/89

### Other Changes
* adding the extension markeplace in README https://github.com/oracle/javavscode/pull/12
* Added more style in readme file https://github.com/oracle/javavscode/pull/98
* README urls fix https://github.com/oracle/javavscode/pull/20
* Adding workflow to build the extension on push and pull request. https://github.com/oracle/javavscode/pull/39
* Update README.md https://github.com/oracle/javavscode/pull/43
* Removed “information_for_contributors” field https://github.com/oracle/javavscode/pull/68
* Bump axios from 1.5.0 to 1.6.0 in /vscode https://github.com/oracle/javavscode/pull/77
* Build.md and .gitignore changes https://github.com/oracle/javavscode/pull/87
* added formatter preferences readme https://github.com/oracle/javavscode/pull/85
* updated THIRD_PARTY_LICENSES.txt https://github.com/oracle/javavscode/pull/111
* Upgrade commons-codec from 1.15 to 1.16.0 https://github.com/oracle/javavscode/pull/107
* Upgrade of failureaccess (component of Guava) https://github.com/oracle/javavscode/pull/109

**Full Changelog**: https://github.com/oracle/javavscode/compare/v1.0.0...v1.0.0.1

