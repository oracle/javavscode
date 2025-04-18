# Developing Extension for VS Code

<!--

    Copyright (c) 2023-2025 Oracle and/or its affiliates.

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

- JDK, version 17 or later
- Ant, latest version
- Maven, latest version
- Node.js, latest LTS (to build VSIX)

## Fetching and building the code

```bash
$ git clone --recurse-submodules https://github.com/oracle/javavscode.git
$ cd javavscode
# the following target requires git executable to be on PATH:
$ ant apply-patches
$ ant build-netbeans

# Note if you do not wish to have l10n in scope then add no-l10n before any ant invocation target at beginning as below, by default l10n is enabled
$ ant no-l10n apply-patches
$ ant no-l10n build-netbeans
```


## Building VS Code extension

To build the VS Code extension invoke:

```bash
ant build-vscode-ext
```
The resulting extension is then in the `build` directory, with the `.vsix` extension.
The typical file name is `oracle-java-0.1.0.vsix`.

### Building for Development

If you're developing the extension, follow these steps to build the project for faster iterations without packaging a `.vsix` file:

1. Run the following command to build the Language Server Protocol (LSP) server:
   ```bash
   $ ant build-lsp-server
   ```
2. Navigate to the `vscode` folder:
   ```bash
   $ cd vscode
   ```
3. Install the necessary Node.js dependencies:
   ```bash
   $ npm install
   ```
4. Start the build watcher to automatically rebuild the extension on file changes:
   ```bash
   $ npm run watch
   ```

This process is faster than packaging the extension as a `.vsix` file, allowing for quicker development cycles.

### Debugging the Extension

Follow these steps to debug both the extension's TypeScript code and the NetBeans server code:

#### 1. Debugging TypeScript Code (VS Code Extension)
1. Open the `vscode` folder in VS Code.
2. Press `F5` to launch and debug the extension.

#### 2. Debugging NetBeans Code (Server Side)
1. Open the **Command Palette** using `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Search for **Preferences: Open User Settings (JSON)** and select it.
3. Locate or add the `jdk.serverVmOptions` setting in the JSON file and append the following arguments:
   ```json
   "jdk.serverVmOptions": [
      "-Xdebug",
      "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=8000"
   ]
   ```
4. Start your debugging session. The NetBeans server will suspend execution and wait for a remote debugger to connect at port `8000`.

[NOTE: If you are using multiple profiles in VS Code, then set above configuration in appropriate profile

This configuration will enable you to debug both the extension’s TypeScript code and the NetBeans server-side code.

#### To enable Netbeans logs in the output channel of VS Code IDE

##### Option 1: Enable `jdk.verbose` Logging
1. Open the **Command Palette** using `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Search for **Preferences: Open User Settings (JSON)** and select it.
3. In the settings JSON file, add or update the following setting:
   ```json
   "jdk.verbose": true
   ```

##### Option 2: Enable NetBeans Logs via JVM Options
1. Open the **Command Palette** using `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Search for **Preferences: Open User Settings (JSON)** and select it.
3. Locate or add the `jdk.serverVmOptions` setting and append the following argument to the array:
   ```json
   "jdk.serverVmOptions": ["-J-Dnetbeans.logger.console=true"]
   ```
4. For further debugging you can set Log Level to FINEST by appending following argument to the array:
   ```json
   "jdk.serverVmOptions": ["-J-Dnetbeans.logger.console=true", "-J-Dorg.netbeans.modules.java.lsp.server.lsptrace.level=FINEST"]
   ```

Both options will enable logging from the NetBeans server in the VS Code Output Channel.

### Cleaning the Extension

Often it is also important to properly clean everything. Use:

```bash
$ ant clean-vscode-ext
$ cd netbeans/
$ ant clean
```

### Testing the Extension

The `java.lsp.server` module has classical (as other NetBeans modules) tests.
The most important one is [ServerTest](https://github.com/apache/netbeans/blob/master/java/java.lsp.server/test/unit/src/org/netbeans/modules/java/lsp/server/protocol/ServerTest.java)
which simulates LSP communication and checks expected replies. In addition to
that there are VS Code integration tests - those launch VS Code with the
VS extension and check behavior of the TypeScript integration code:

```bash
$ ant build-vscode-ext # first and then
$ ant test-vscode-ext
```

In case you are behind a proxy, you may want to run the tests with

```bash
$ npm_config_https_proxy=http://your.proxy.com:port ant test-vscode-ext
```

when executing the tests for the first time. That shall overcome the proxy
and download an instance of `code` to execute the tests with.

## Working with git submodules

This project uses [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) . In particular netbeans and netbeans-l10n are submodules pointing to specific commits in their respective repositories .

### Switching Branches 

Add the --recurse-submodules  flag to the git checkout command to update the submodules during the checkout.
```bash
git checkout --recurse-submodules <branch_name>
```
Note:- Merging branches with submodules pointing to different commits can be tricky. Refer the [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) for more details on the same.

### Changing submodules versions 

```bash
# Fetching changes from remote submodule repositories 
git submodule update --remote   
# Changing the submodule version
cd netbeans
git checkout <commit_hash>
cd ..
# Committing the submodule version 
git add netbeans
git commit -m "Updated netbeans"
```