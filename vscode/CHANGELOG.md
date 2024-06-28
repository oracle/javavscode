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
## Version 22.1.1
### What's Changed

### Enhancements
* Upgrading to NB-22 https://github.com/oracle/javavscode/pull/169
* [JAVAVSCODE-175] Support for JEP-467 (Markdown Javadoc) added https://github.com/oracle/javavscode/pull/176
* [JAVAVSCODE-74] Support for relative paths to in the source file launcher's paths https://github.com/oracle/javavscode/pull/173 

### Other Changes
* Bump braces from 3.0.2 to 3.0.3 https://github.com/oracle/javavscode/pull/171
* [JAVAVSCODE-172] Updated README for how to use JDK EA builds with extension https://github.com/oracle/javavscode/pull/174
* [JAVAVSCODE-110] Updated README for troubleshoot guide https://github.com/oracle/javavscode/pull/169

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.0.1...v22.1.1

## Version 22.0.1 (May 30th, 2024)
### What's Changed

### Bugs
* [JAVAVSCODE-59] In VSCode provide quickfix relevant to the position of the cursor https://github.com/apache/netbeans/pull/7353
* [JAVAVSCODE-101] Command jdk.java.project.resolveProjectProblems' not found https://github.com/apache/netbeans/pull/7370

### Other Changes
* Disable unused modules https://github.com/oracle/javavscode/pull/159
* Copyright modification in README https://github.com/oracle/javavscode/pull/155
* Minor README updates https://github.com/oracle/javavscode/pull/157
* Provide better tags in vscode marketplace https://github.com/oracle/javavscode/pull/162

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.0.0...v22.0.1

## Version 22.0.0 (April 25th, 2024)
### What's Changed

### Enhancements
* [JAVAVSCODE-9] Disable hints according to user preference https://github.com/apache/netbeans/pull/6760
* [JAVAVSCODE-110] Added option to delete workspace cache with respect to oracle java extension https://github.com/oracle/javavscode/pull/124
* [JAVAVSCODE-123] Update to NetBeans 21 and JDK 22 features support https://github.com/oracle/javavscode/pull/128
* [JAVAVSCODE-131] Added JDK 22 GA download option in JDK downloader https://github.com/oracle/javavscode/pull/133
* [JAVAVSCODE-146] Rename "Java Platform Support" as "Java" https://github.com/oracle/javavscode/pull/147
* Option to work with JDK 23 early access by disabling javac bundled with Netbeans https://github.com/oracle/javavscode/pull/130
* Bump up axios 1.6.0 to 1.6.8 https://github.com/oracle/javavscode/pull/127
* Bump up @vscode/debugadapter from 1.55.1 to 1.65.0 https://github.com/oracle/javavscode/pull/135

### Bugs
* [JAVAVSCODE-29] vscode reports a need to upgrade Gradle to an earlier version for JDK-21 https://github.com/apache/netbeans/pull/6807
* [JAVAVSCODE-30] Fixed refactoring of pom.xml as well on renaming class name https://github.com/oracle/javavscode/pull/120
* [JAVAVSCODE-95] Fixed false error thrown if parent pom version uses variable https://github.com/oracle/javavscode/pull/125

### Other Changes
* [JAVAVSCODE-137] Updated Third party licenses related to Node JS third party dependencies https://github.com/oracle/javavscode/pull/138
* Removing (unused) DB support from extension https://github.com/oracle/javavscode/pull/112

**Full Changelog**: https://github.com/oracle/javavscode/compare/v1.0.1...v22.0.0

## Version 1.0.1 (February 22nd, 2024)
### What’s Changed

### Enhancements
* Implementing support for features in JDK 22 by utilizing OpenJDK 22 Early Access binaries https://github.com/apache/netbeans/pull/6742
* [JAVAVSCODE-16] Added option for running any Java project using context menu https://github.com/oracle/javavscode/pull/75
* [JAVAVSCODE-22] Added support for using different jdk in each workspace and deprecated jdk.userdir configuration https://github.com/oracle/javavscode/pull/67
* [JAVAVSCODE-28] Include TestNG tests in the test explorer.https://github.com/oracle/javavscode/pull/40
* [JAVAVSCODE-56] Added “Go To Test” option https://github.com/oracle/javavscode/pull/93
* [JAVAVSCODE-60] Added a configuration for user-defined vm arguments to start the Java language server https://github.com/oracle/javavscode/pull/63
* [JAVAVSCODE-69] Add a warning for cases like var foo = new ArrayList<>(); https://github.com/apache/netbeans/pull/6780
* [JAVAVSCODE-76] Support for parameter hints added https://github.com/apache/netbeans/pull/6476
* [JAVAVSCODE-78] Added checksum match for jdk downloader https://github.com/oracle/javavscode/pull/81
* [JAVAVSCODE-80] Renamed downloaded jdk binaries so that it is not replaced by the already present binaries https://github.com/oracle/javavscode/pull/82
* Update to NetBeans 20 https://github.com/oracle/javavscode/pull/92

### Bugs
* [JAVAVSCODE-23] Class outline/structure missing in some cases fixed https://github.com/apache/netbeans/pull/6642
* [JAVAVSCODE-24] Error on formatting pom.xml fixed https://github.com/apache/netbeans/pull/6631
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

**Full Changelog**: https://github.com/oracle/javavscode/compare/v1.0.0...v1.0.1

## Version 1.0.0 (October 18th, 2023)
* Initial release
