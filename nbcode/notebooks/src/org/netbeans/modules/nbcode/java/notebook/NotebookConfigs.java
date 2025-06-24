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

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import org.eclipse.lsp4j.ConfigurationItem;
import org.eclipse.lsp4j.ConfigurationParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.openide.util.Exceptions;

/**
 *
 * @author atalati
 */
public class NotebookConfigs {

    private static final String[] NOTEBOOK_CONFIG_LABELS = {"notebook.classpath", "notebook.modulepath", "notebook.addmodules", "notebook.enablePreview", "notebook.implicitImports"};
    private NbCodeLanguageClient client = null;
    private String classPath = null;
    private String modulePath = null;
    private String addModules = null;
    private boolean enablePreview = false;
    private List<String> implicitImports = null;
    private CompletableFuture<Void> initialized;

    public CompletableFuture<Void> getInitialized() {
        return initialized;
    }

    public String getClassPath() {
        return classPath;
    }

    public String getModulePath() {
        return modulePath;
    }

    public String getAddModules() {
        return addModules;
    }

    public boolean isEnablePreview() {
        return enablePreview;
    }

    public List<String> getImplicitImports() {
        return implicitImports;
    }

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

        try {
            this.initialized = initializeConfigs();
        } catch (InterruptedException | ExecutionException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public NbCodeLanguageClient getLanguageClient() {
        return client;
    }

    private List<ConfigurationItem> getConfigItems() {
        List<ConfigurationItem> items = new ArrayList<>();
        for (String label : NOTEBOOK_CONFIG_LABELS) {
            ConfigurationItem item = new ConfigurationItem();
            item.setSection(client.getNbCodeCapabilities().getConfigurationPrefix() + label);
            items.add(item);
        }
        return items;
    }

    private CompletableFuture<Void> initializeConfigs() throws InterruptedException, ExecutionException {
        if (client != null) {

            CompletableFuture<List<Object>> configValues = client.configuration(new ConfigurationParams(getConfigItems()));
            return configValues.thenAccept((c) -> {
                if (c != null) {
                    if (c.get(0) != null) {
                        classPath = ((JsonPrimitive) c.get(0)).getAsString();
                    }
                    if (c.get(1) != null) {
                        modulePath = ((JsonPrimitive) c.get(1)).getAsString();
                    }
                    if (c.get(2) != null) {
                        addModules = ((JsonPrimitive) c.get(2)).getAsString();
                    }
                    if (c.get(3) != null) {
                        enablePreview = ((JsonPrimitive) c.get(3)).getAsBoolean();
                    }
                    if (c.get(4) != null) {
                        implicitImports = ((JsonArray) c.get(4)).asList().stream().map((elem) -> elem.getAsString()).toList();

                    }
                }
            });

        }
        return CompletableFuture.completedFuture(null);

    }

    public String getJdkVersion() {
        return System.getProperty("java.version").split("\\.")[0];
    }

    public void notebookConfigsChangeListener(JsonObject settings) {
        // depends on #8514 PR open in Netbeans

    }
}
