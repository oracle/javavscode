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

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.util.List;
import java.util.concurrent.ExecutionException;
import org.eclipse.lsp4j.ConfigurationItem;
import org.eclipse.lsp4j.ConfigurationParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class NotebookConfigs {

    private static final String NOTEBOOK_JDK_HOME = "notebook.jdkhome";
    private String jdkVersion = null;
    private NbCodeLanguageClient client = null;

    private NotebookConfigs() {
    }

    public static NotebookConfigs getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final NotebookConfigs instance = new NotebookConfigs();
    }

    public void setLanguageClient(NbCodeLanguageClient client) {
        this.client = client;
    }

    public NbCodeLanguageClient getLanguageClient() {
        return client;
    }

    public String getJdkVersion() throws InterruptedException, ExecutionException {
        // Figure out how to get Java major version from the path to jdk home
        // Option-1: Run java --version in a different process and get it's output.
        // Option-2: Check release file in the home path it might have info about major version.
        String notebookJdkVersion = jdkVersion != null ? jdkVersion : null;
        if (notebookJdkVersion != null && client != null) {
            if (client != null) {
                ConfigurationItem configItem = new ConfigurationItem();
                configItem.setSection(client.getNbCodeCapabilities().getConfigurationPrefix() + NOTEBOOK_JDK_HOME);
                notebookJdkVersion = client.configuration(new ConfigurationParams(List.of(configItem))).thenApply((c) -> {
                    if (c != null) {
                        return ((JsonPrimitive) c.get(0)).getAsString();
                    }
                    return null;
                }).get();
                if (notebookJdkVersion != null) {
                    this.jdkVersion = notebookJdkVersion;
                }
            }
        }
        return notebookJdkVersion;
    }

    public void notebookConfigsChangeListener(JsonObject settings) {
        // depends on #8514 PR open in Netbeans
    }
}
