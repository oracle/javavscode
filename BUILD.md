# Developing Extension for VS Code

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

## Prerequisities

- JDK, version 11 or later
- Ant, latest version
- Maven, latest version
- node.js, latest LTS (to build VSIX)


## Fetching and building netbeans code

```bash
$ git clone https://github.com/apache/netbeans.git
$ cd netbeans/
$ git checkout f48f91e6c197d8a40bd82fc2f2d12a4e71242afe
$ cd ..
$ ant apply-patches
$ ant

```

## Building VS Code extension

To build the VS Code extension invoke:

```bash
ant build-vscode-ext
```
The resulting extension is then in the `build` directory, with the `.vsix` extension.
The typical file name is `oracle-java-0.1.0.vsix`.

### Building for Development

If you want to develop the extension, use these steps for building instead:

```bash
ant build-lsp-server
```

This target is faster than building the `.vsix` file. Find the instructions
for running and debugging below.

### Cleaning

Often it is also important to properly clean everything. Use:

```bash
ant clean-vscode-ext
cd netbeans/
netbeans$ ant clean
```

### Testing

The `java.lsp.server` module has classical (as other NetBeans modules) tests.
The most important one is [ServerTest](https://github.com/apache/netbeans/blob/master/java/java.lsp.server/test/unit/src/org/netbeans/modules/java/lsp/server/protocol/ServerTest.java)
which simulates LSP communication and checks expected replies. In addition to
that there are VS Code integration tests - those launch VS Code with the
VS extension and check behavior of the TypeScript integration code:

```bash
java.lsp.server$ ant build-vscode-ext # first and then
java.lsp.server$ ant test-vscode-ext
```

In case you are behind a proxy, you may want to run the tests with

```bash
java.lsp.server$ npm_config_https_proxy=http://your.proxy.com:port ant test-vscode-ext
```

when executing the tests for the first time. That shall overcome the proxy
and download an instance of `code` to execute the tests with.
