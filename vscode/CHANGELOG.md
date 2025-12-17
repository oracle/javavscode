<!--
    Copyright (c) 2023-2025, Oracle and/or its affiliates.

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
# Change Log

## Version 25.0.1
### What's Changed

#### Bug Fixes
* Clarified usage of the two vscode File URI APIs [#494](https://github.com/oracle/javavscode/pull/494), resolving:
    - Notebook creation failure on Windows with no workspace
    - Go To Test/Tested navigation failure
* Fixed project context mapping for notebooks on Windows [#498](https://github.com/oracle/javavscode/pull/498)
* Fixed refactor method parameters UI to display button icons (move up/down, delete, add) [#495](https://github.com/oracle/javavscode/pull/495)
* Surfaced NetBeans Language Server warnings during refactoring to prevent unexpected results [#511](https://github.com/oracle/javavscode/pull/511)
* Corrected class-name validation in "Create New File from Template":
    - Allow `module-info`, `package-info`; disallow `.` [#496](https://github.com/oracle/javavscode/pull/496)
    - Warn for `$` in names [#509](https://github.com/oracle/javavscode/pull/509)
* [JAVAVSCODE-353] Fixed Run/Debug of main classes in Gradle test sources [#487](https://github.com/oracle/javavscode/pull/487)
* [JAVAVSCODE-499] Fixed code completions for module imports [#502](https://github.com/oracle/javavscode/pull/502)
* Fixed applying code suggestions when implemented methods require imports [#520](https://github.com/oracle/javavscode/pull/520)
* Notebook code cell execution fixes:
    - Input box dismissal no longer blocks future input [#501](https://github.com/oracle/javavscode/pull/501)
    - Notebook kernel can be restarted after execution crash [#506](https://github.com/oracle/javavscode/pull/506)
    - Show unresolved dependency warnings [#507](https://github.com/oracle/javavscode/pull/507)
    - Set current working directory (CWD) to the notebook's directory [#508](https://github.com/oracle/javavscode/pull/508)
* [JAVAVSCODE-486] Handled cache deletion failures to allow manual cleanup before NetBeans Language Server restart [#515](https://github.com/oracle/javavscode/pull/515)


#### Other Changes
* Removed microsoft/vscode-l10n dependency [#504](https://github.com/oracle/javavscode/pull/504)
* Fixed NetBeans Language Server launch on Windows ARM64 with an x64 JDK [#513](https://github.com/oracle/javavscode/pull/513)
* Netbeans Language Server now honors project directory traversal settings when scanning for Gradle projects
* Updated dependencies and removed unused modules

**Full Changelog**: https://github.com/oracle/javavscode/compare/v25.0.0...v25.0.1

## Version 25.0.0
### What's Changed


#### Enhancements
* Introduction of Java Notebook  [#464](https://github.com/oracle/javavscode/pull/464)
* Open JShell in project context [#464](https://github.com/oracle/javavscode/pull/464)
* Upgrade to NB-27 [#456](https://github.com/oracle/javavscode/pull/456)
    * Full JDK 25 support
    * Inlined values inside debugger
    * Improved Gradle 9 support 
    * And more ...
* Improved support for JDK 25
    * Improved support for Module imports  [#474](https://github.com/oracle/javavscode/pull/474)
    * Improved support for Compact source files [#466](https://github.com/oracle/javavscode/pull/466)
* Backport of important patches from NB28  [#473](https://github.com/oracle/javavscode/pull/473)

#### Bug Fixes
* Fixed Run and Debug hanging when more than 2 main classes  in the project [#468](https://github.com/oracle/javavscode/pull/468)
* Fixed "Launch Java App" related to launch app [#468](https://github.com/oracle/javavscode/pull/468)

#### Other Changes
* Updated openjdk25 URL to 25.0.1 [#488](https://github.com/oracle/javavscode/pull/488)
* Translation of new messages to ja and zh-cn [#464](https://github.com/oracle/javavscode/pull/464) 
* Graceful close handler implementation in Netbeans Language Server [#458](https://github.com/oracle/javavscode/pull/458)
* Message labels updates and improvements [#471](https://github.com/oracle/javavscode/pull/471)


**Full Changelog**: https://github.com/oracle/javavscode/compare/v24.1.1...v25.0.0

## Version 24.1.1
### What's Changed

#### Bug Fixes
* Standalone run output correction [#448](https://github.com/oracle/javavscode/pull/448)
* Fix run/debug/test due to launch-config clashes [#432](https://github.com/oracle/javavscode/pull/432)
* Updated the JavaLangFeatures feature name extractor to work with JDK25+ EA [#451](https://github.com/oracle/javavscode/pull/451)
* Constructor init of java.lsp.server JavaPlatformProvider override [#453](https://github.com/oracle/javavscode/pull/453)
* Extension restart fix [#433](https://github.com/oracle/javavscode/pull/433)
* Fix formatting issue when there is erroneous if tree [#429](https://github.com/oracle/javavscode/pull/429)
* Fixed project clean and project compile commands in the command palette [#438](https://github.com/oracle/javavscode/pull/438)
* Fixed enable preview event field value for Gradle and Standalone projects [#452](https://github.com/oracle/javavscode/pull/452)

#### Other Changes
* Updated openjdk24 URL to 24.0.2 [#442](https://github.com/oracle/javavscode/pull/442)
* Updated openjdk25 URL to 25 [#465](https://github.com/oracle/javavscode/pull/465)

**Full Changelog**: https://github.com/oracle/javavscode/compare/v24.1.0...v24.1.1

## Version 24.1.0
### What's Changed

#### Enhancements
* User-input validation while creating a new project/file [#405](https://github.com/oracle/javavscode/pull/405)
* Support refactoring in single-source files [#411](https://github.com/oracle/javavscode/pull/408)
* User configuration for setting up code completion selection character [#418](https://github.com/oracle/javavscode/pull/418)

#### Bug Fixes
* Method parameter refactoring UI fix [#408](https://github.com/oracle/javavscode/pull/408)
* Improved control on execution launch commands	[#413](https://github.com/oracle/javavscode/pull/413),[#416](https://github.com/oracle/javavscode/pull/416)
* Class cast exception while opening pom.xml file fixed [#414](https://github.com/oracle/javavscode/pull/414)

#### Other Changes
* Upgraded dev dependencies and removed unused dependencies [#322](https://github.com/oracle/javavscode/pull/322), [#412](https://github.com/oracle/javavscode/pull/412)
* Telemetry release	[#417](https://github.com/oracle/javavscode/pull/417)
* Fixed label and id issue in JDK downloader [#379](https://github.com/oracle/javavscode/pull/379), [#389](https://github.com/oracle/javavscode/pull/389)
* Updated OpenJDK CPU release download url [#400](https://github.com/oracle/javavscode/pull/400)
* copyright headers maintenance [#404](https://github.com/oracle/javavscode/pull/404)
* Updated messages for the minimum version of JDK to 24 for disabling nb-javac [#410](https://github.com/oracle/javavscode/pull/410)
* Translation of additional localisable content [#419](https://github.com/oracle/javavscode/pull/419), [#422](https://github.com/oracle/javavscode/pull/422)

**Full Changelog**: https://github.com/oracle/javavscode/compare/v24.0.0...v24.1.0

## Version 24.0.0
### What's Changed

#### Enhancements
* [JAVAVSCODE-36,335] Allow relative paths and class names as 'mainClass' setting in launch.json [netbeans/#8280](https://github.com/apache/netbeans/pull/8280)
* [JAVAVSCODE-317,336] Support similar style as Java CLI for providing classpath in the vmOptions configuration [netbeans/#8289](https://github.com/apache/netbeans/pull/8289)
* Upgrade to NB-25 [#382](https://github.com/oracle/javavscode/pull/382) & [#383](https://github.com/oracle/javavscode/pull/383)
    * Full JDK 24 support
    * Support for vmArgs in array form as well
    * Performance improvements
    * And more ...

#### Bug Fixes
* Fixed constructor autocomplete not getting generated [netbeans/#8242](https://github.com/apache/netbeans/pull/8242)

#### Other Changes
* Dynamically fetch Oracle JDK versions available for download [#376](https://github.com/oracle/javavscode/pull/376)
* Updated OpenJDK Downloader URLs for JDK 24 release [#390](https://github.com/oracle/javavscode/pull/390)

**Full Changelog**: https://github.com/oracle/javavscode/compare/v23.1.0...v24.0.0

## Version 23.1.0
### What's Changed

#### Other Changes
* Minor README updates and fixes  [#334](https://github.com/oracle/javavscode/pull/334) and [#339](https://github.com/oracle/javavscode/pull/339)
* Suppressed JNI warning during language server startup [#338](https://github.com/oracle/javavscode/pull/338)
* Dependency upgrades [#337](https://github.com/oracle/javavscode/pull/337)
* Extension maintainance changes [#348](https://github.com/oracle/javavscode/pull/348) and [#349](https://github.com/oracle/javavscode/pull/349)
* Updated JDK Downloader URLs for Jan25 CPUs [#365](https://github.com/oracle/javavscode/pull/365)

**Full Changelog**: https://github.com/oracle/javavscode/compare/v23.0.1...v23.1.0

## Version 23.0.1
### What's Changed

#### Bug Fixes
* [JAVAVSCODE-217] Remove grouping of test runner cases to fix incorrect results https://github.com/oracle/javavscode/pull/307
* [JAVAVSCODE-249] Fixed code folding for if-else https://github.com/oracle/javavscode/pull/304 and https://github.com/oracle/javavscode/pull/308
* [JAVAVSCODE-291] Fixed JDK Downloader to NOT offer Windows ARM64 option https://github.com/oracle/javavscode/pull/294
* [JAVAVSCODE-300] Fixed launching of NBLS when arguments contain spaces https://github.com/oracle/javavscode/pull/301
* Fixed "Move Refactoring" for some buggy cases https://github.com/oracle/javavscode/pull/320

#### Other Changes
* Remove the usage of java SecurityManager in NBLS https://github.com/oracle/javavscode/pull/318
* Refactored extension frontend code for better maintainability and tests https://github.com/oracle/javavscode/pull/292 and https://github.com/oracle/javavscode/pull/310 
* Renamed command label "New from Template" to "New File from Template" for better understandability https://github.com/oracle/javavscode/pull/323
* Updated JDK Downloader URLs for Oct24 CPUs https://github.com/oracle/javavscode/pull/294
* Updated JVSC Git repo to use Git submodules for ease of use: NB & NB-l10n https://github.com/oracle/javavscode/pull/295
* Fix l10n translations for important modules/keys of the NetBeans LS https://github.com/oracle/javavscode/pull/325

**Full Changelog**: https://github.com/oracle/javavscode/compare/v23.0.0...v23.0.1

## Version 23.0.0
### What's Changed

#### Enhancements
* [JAVAVSCODE-253] Localization to support Japanese and Simplified Chinese https://github.com/oracle/javavscode/pull/254
* [JAVAVSCODE-224] Option to configure different JDK versions for JVSC extension runtime and project https://github.com/oracle/javavscode/pull/244
* [JAVAVSCODE-229] Introduced Quick Fix action for suppressing warnings https://github.com/oracle/javavscode/pull/259
* Upgrade to NB-23 https://github.com/oracle/javavscode/pull/259
    * Full JDK 23 support
    * Upgraded Gradle Tooling to 8.10
    * Fixed Exception templates
    * And more ...
* Progress bar added to track JDK download progress https://github.com/oracle/javavscode/pull/248
* JDK 23 now available in the JDK Downloader https://github.com/oracle/javavscode/pull/274
* Restrict parent directory traversal when locating the associated project https://github.com/oracle/javavscode/pull/251
#### Bug Fixes
* [JAVAVSCODE-57] Rename refactoring should not replace in comments by default https://github.com/oracle/javavscode/pull/261
* [JAVAVSCODE-148] Corrected configuration selection from launch settings during run and debug sessions https://github.com/oracle/javavscode/pull/266
* [JAVAVSCODE-203] Fixed rename refactoring for record components https://github.com/apache/netbeans/pull/7670
* [JAVAVSCODE-212] Fixed implicit imports precedence issue https://github.com/oracle/javavscode/pull/262
* [JAVAVSCODE-221] Reliable implementation of the "delete extension cache" command https://github.com/oracle/javavscode/pull/245


#### Other Changes
* Refactored JDK Downloader implementation https://github.com/oracle/javavscode/pull/248
* Removed redundant elements from the extension https://github.com/oracle/javavscode/pull/263
* README updated where necessary 

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.1.2...v23.0.0

## Version 22.1.2
### What's Changed

#### Bug Fixes
* [JAVAVSCODE-96] Honour SuppressWarnings annotations for `unused` entities https://github.com/oracle/javavscode/pull/227
* [JAVAVSCODE-182] Show the constructor's JavaDoc on hovering over its usage; instead of the class' JavaDoc https://github.com/oracle/javavscode/pull/238
* [JAVAVSCODE-185] Formatting of XML (pom.xml) files fixed https://github.com/oracle/javavscode/pull/226
* [JAVAVSCODE-190] Upgrade Gradle tooling to support JDK-22 https://github.com/oracle/javavscode/pull/220
* [JAVAVSCODE-194] Support uncommon inline tags in JavaDoc re-formatting, instead of producing incorrectly formatted block tags https://github.com/oracle/javavscode/pull/237
* [JAVAVSCODE-196] Fixed run Configuration section is unavailable in the Explorer panel for non-workspace opened Java files https://github.com/oracle/javavscode/pull/210
* [JAVAVSCODE-199] Fixed Quick Fix actions are unable to edit runConfig options in global settings for non-workspace opened Java files https://github.com/oracle/javavscode/pull/211
* [JAVAVSCODE-214] Fixed Source Actions menu https://github.com/oracle/javavscode/pull/227

#### Other Changes
* [JAVAVSCODE-223] Updated BUILD.md https://github.com/oracle/javavscode/pull/225
* Updated README.md https://github.com/oracle/javavscode/pull/228
* Ant build script reorganization for patches and clean-netbeans https://github.com/oracle/javavscode/pull/234
* Pre-commit hook to check artifactory urls in package-lock.json https://github.com/oracle/javavscode/pull/192
* Bump up axios to 1.7.4 https://github.com/oracle/javavscode/pull/241
* Upgraded node-jsonc-parser library https://github.com/oracle/javavscode/pull/200

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.1.1...v22.1.2

## Version 22.1.1
### What's Changed

#### Enhancements
* [JAVAVSCODE-172] Support for using JDK 23 EA builds with the extension including features like ClassFile API, Implicitly Declared Classes and Instance Main Methods, etc. https://github.com/oracle/javavscode/pull/174
* [JAVAVSCODE-175] Support for JEP 467 (Markdown format for Javadoc) added https://github.com/oracle/javavscode/pull/176
* [JAVAVSCODE-74] Support for running a project with dependencies not managed by Maven or Gradle https://github.com/oracle/javavscode/pull/173 
* Upgrading to NB-22 https://github.com/oracle/javavscode/pull/169

#### Other Changes
* Bump braces from 3.0.2 to 3.0.3 https://github.com/oracle/javavscode/pull/171
* [JAVAVSCODE-110] Updated README for troubleshoot guide https://github.com/oracle/javavscode/pull/169

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.0.1...v22.1.1

## Version 22.0.1 (May 30th, 2024)
### What's Changed

#### Bug Fixes
* [JAVAVSCODE-59] In VSCode provide quickfix relevant to the position of the cursor https://github.com/apache/netbeans/pull/7353
* [JAVAVSCODE-101] Command jdk.java.project.resolveProjectProblems' not found https://github.com/apache/netbeans/pull/7370

#### Other Changes
* Disable unused modules https://github.com/oracle/javavscode/pull/159
* Copyright modification in README https://github.com/oracle/javavscode/pull/155
* Minor README updates https://github.com/oracle/javavscode/pull/157
* Provide better tags in vscode marketplace https://github.com/oracle/javavscode/pull/162

**Full Changelog**: https://github.com/oracle/javavscode/compare/v22.0.0...v22.0.1

## Version 22.0.0 (April 25th, 2024)
### What's Changed

#### Enhancements
* [JAVAVSCODE-9] Disable hints according to user preference https://github.com/apache/netbeans/pull/6760
* [JAVAVSCODE-110] Added option to delete workspace cache with respect to oracle java extension https://github.com/oracle/javavscode/pull/124
* [JAVAVSCODE-123] Update to NetBeans 21 and JDK 22 features support https://github.com/oracle/javavscode/pull/128
* [JAVAVSCODE-131] Added JDK 22 GA download option in JDK downloader https://github.com/oracle/javavscode/pull/133
* [JAVAVSCODE-146] Rename "Java Platform Support" as "Java" https://github.com/oracle/javavscode/pull/147
* Option to work with JDK 23 early access by disabling javac bundled with Netbeans https://github.com/oracle/javavscode/pull/130
* Bump up axios 1.6.0 to 1.6.8 https://github.com/oracle/javavscode/pull/127
* Bump up @vscode/debugadapter from 1.55.1 to 1.65.0 https://github.com/oracle/javavscode/pull/135

#### Bug Fixes
* [JAVAVSCODE-29] vscode reports a need to upgrade Gradle to an earlier version for JDK-21 https://github.com/apache/netbeans/pull/6807
* [JAVAVSCODE-30] Fixed refactoring of pom.xml as well on renaming class name https://github.com/oracle/javavscode/pull/120
* [JAVAVSCODE-95] Fixed false error thrown if parent pom version uses variable https://github.com/oracle/javavscode/pull/125

#### Other Changes
* [JAVAVSCODE-137] Updated Third party licenses related to Node JS third party dependencies https://github.com/oracle/javavscode/pull/138
* Removing (unused) DB support from extension https://github.com/oracle/javavscode/pull/112

**Full Changelog**: https://github.com/oracle/javavscode/compare/v1.0.1...v22.0.0

## Version 1.0.1 (February 22nd, 2024)
### What’s Changed

#### Enhancements
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

#### Bug Fixes
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

#### Other Changes
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
