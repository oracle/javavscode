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
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.lsp4j.ConfigurationItem;
import org.eclipse.lsp4j.ConfigurationParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class NotebookConfigs {
    private static final Logger LOG = Logger.getLogger(NotebookConfigs.class.getName());

    private static final String[] NOTEBOOK_CONFIG_LABELS = {"notebook.classpath",
        "notebook.modulepath",
        "notebook.addmodules",
        "notebook.enablePreview",
        "notebook.implicitImports",
        "notebook.projects.mapping"};
    private volatile String classPath = null;
    private volatile String modulePath = null;
    private volatile String addModules = null;
    private volatile boolean enablePreview = false;
    private volatile JsonObject notebookProjectMapping = new JsonObject();
    private volatile List<String> implicitImports = null;
    private volatile CompletableFuture<Void> initialized;

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

    public JsonObject getNotebookProjectMapping() {
        return notebookProjectMapping;
    }

    private NotebookConfigs() {

    }

    public static NotebookConfigs getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final NotebookConfigs instance = new NotebookConfigs();
    }

    public void initConfigs() {
        try {
            this.initialized = initializeConfigs();
        } catch (Exception ex) {
            LOG.log(Level.WARNING, "Exception occurred while init configs for notebooks: {0}", ex.getMessage());
        }
    }

    private List<ConfigurationItem> getConfigItems() {
        List<ConfigurationItem> items = new ArrayList<>();
        for (String label : NOTEBOOK_CONFIG_LABELS) {
            ConfigurationItem item = new ConfigurationItem();
            NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
            if (client != null) {
                item.setSection(client.getNbCodeCapabilities().getConfigurationPrefix() + label);
                items.add(item);
            }
        }
        return items;
    }

    private CompletableFuture<Void> initializeConfigs() {
        NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
        if (client != null) {
            CompletableFuture<List<Object>> configValues = client.configuration(new ConfigurationParams(getConfigItems()));
            return configValues.thenAccept((c) -> {
                if (c != null) {
                    JsonArray classPathConfig = NotebookUtils.getArgument(c, 0, JsonArray.class);
                    if (classPathConfig != null) {
                        classPath = String.join(File.pathSeparator,classPathConfig.asList().stream().map((elem) -> elem.getAsString()).toList());
                    }
                    
                    JsonArray modulePathConfig = NotebookUtils.getArgument(c, 1, JsonArray.class);
                    if (modulePathConfig != null) {
                        modulePath = String.join(File.pathSeparator,modulePathConfig.asList().stream().map((elem) -> elem.getAsString()).toList());
                    }
                    
                    JsonArray addModulesConfig = NotebookUtils.getArgument(c, 2, JsonArray.class);
                    if (addModulesConfig != null) {
                        addModules = String.join(",",addModulesConfig.asList().stream().map((elem) -> elem.getAsString()).toList());
                    }
                    
                    Boolean enablePreviewConfig = NotebookUtils.getArgument(c, 3, Boolean.class);
                    if (enablePreviewConfig != null) {
                        enablePreview = enablePreviewConfig;
                    }
                    
                    JsonArray implicitImportsConfig = NotebookUtils.getArgument(c, 4, JsonArray.class);
                    if (implicitImportsConfig != null) {
                        implicitImports = implicitImportsConfig.asList().stream().map((elem) -> elem.getAsString()).toList();
                    }

                    JsonObject notebookProjectMappingConfig = NotebookUtils.getArgument(c, 5, JsonObject.class);
                    if (notebookProjectMappingConfig != null) {
                        notebookProjectMapping = notebookProjectMappingConfig;
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
        // TODO: Cache configurations using changes done in #8514 PR open in Netbeans

    }
}
