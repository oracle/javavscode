/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.notebook;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import org.netbeans.modules.nbcode.java.project.CommandHandler;
import org.netbeans.spi.lsp.CommandProvider;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author atalati
 */
@ServiceProvider(service = CommandProvider.class)
public class NotebookCommandsHandler implements CommandProvider {

    private static final String NBLS_JSHELL_EXEC = "nbls.jshell.execute.cell";
    private static final String NBLS_OPEN_PROJECT_JSHELL = "nbls.jshell.project.open";
    private static final Set<String> COMMANDS = new HashSet<>(Arrays.asList(NBLS_JSHELL_EXEC, NBLS_OPEN_PROJECT_JSHELL));

    @Override
    public Set<String> getCommands() {
        return COMMANDS;
    }

    @Override
    public CompletableFuture<Object> runCommand(String command, List<Object> arguments) {
        try {

            switch (command) {
                case NBLS_JSHELL_EXEC:
                    return CodeEval.evaluate(arguments).thenApply(list -> (Object)list);
                case NBLS_OPEN_PROJECT_JSHELL:
                    return CommandHandler.openJshellInProjectContext(arguments).thenApply(list -> (Object) list);
                default:
                    return CompletableFuture.failedFuture(new UnsupportedOperationException("Command not supported: " + command));
            }
        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }
}
