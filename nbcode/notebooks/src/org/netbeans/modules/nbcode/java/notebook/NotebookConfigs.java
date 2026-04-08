/*
 * Copyright (c) 2025-2026, Oracle and/or its affiliates.
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

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.netbeans.api.annotations.common.NonNull;
import org.netbeans.modules.java.lsp.server.protocol.ClientConfigurationManager;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class NotebookConfigs {

    private static final Logger LOG = Logger.getLogger(NotebookConfigs.class.getName());

    private static final String NOTEBOOK_CONFIG_SECTION = "notebook";
    private static final String CONFIG_CLASSPATH = "classpath";
    private static final String CONFIG_MODULEPATH = "modulepath";
    private static final String CONFIG_ADDMODULES = "addmodules";
    private static final String CONFIG_ENABLE_PREVIEW = "enablePreview";
    private static final String CONFIG_IMPLICIT_IMPORTS = "implicitImports";
    private static final String CONFIG_PROJECTS_MAPPING = "projects.mapping";
    private static final String CONFIG_VM_OPTIONS = "vmOptions";
    private static final String[] NOTEBOOK_CONFIG_LABELS = {
        CONFIG_CLASSPATH,
        CONFIG_MODULEPATH,
        CONFIG_ADDMODULES,
        CONFIG_ENABLE_PREVIEW,
        CONFIG_IMPLICIT_IMPORTS,
        CONFIG_PROJECTS_MAPPING,
        CONFIG_VM_OPTIONS
    };
    private volatile String classPath = null;
    private volatile String modulePath = null;
    private volatile String addModules = null;
    private volatile boolean enablePreview = false;
    private volatile JsonObject notebookProjectMapping = new JsonObject();
    private volatile List<String> notebookVmOptions = Collections.emptyList();
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

    @NonNull
    public List<String> getNotebookVmOptions() {
        return notebookVmOptions;
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

    private CompletableFuture<Void> initializeConfigs() {
        NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
        if (client != null) {
            ClientConfigurationManager configManager = client.getClientConfigurationManager();
            configManager.registerConfigChangeListener(client.getNbCodeCapabilities().getConfigurationPrefix() + NOTEBOOK_CONFIG_SECTION,
                    (config, newValue) -> notebookConfigsChangeListener(newValue.getAsJsonObject()));
            return configManager.getConfiguration(NOTEBOOK_CONFIG_SECTION)
                    .thenApply(c -> {
                        if (c != null) {
                            notebookConfigsChangeListener(c.getAsJsonObject());
                        }
                        return null;
                    });
        }
        return CompletableFuture.completedFuture(null);

    }

    public String getJdkVersion() {
        // As per JEP-223
        return System.getProperty("java.specification.version");
    }

    public void notebookConfigsChangeListener(JsonObject settings) {
        if (settings == null) {
            return;
        }
        
        JsonElement classPathConfig = settings.get(CONFIG_CLASSPATH);
        if (classPathConfig != null && classPathConfig.isJsonArray()) {
            classPath = String.join(File.pathSeparator, classPathConfig.getAsJsonArray().asList().stream().map((elem) -> elem.getAsString()).toList());
        } else {
            classPath = null;
        }

        JsonElement modulePathConfig = settings.get(CONFIG_MODULEPATH);
        if (modulePathConfig != null && modulePathConfig.isJsonArray()) {
            modulePath = String.join(File.pathSeparator, modulePathConfig.getAsJsonArray().asList().stream().map((elem) -> elem.getAsString()).toList());
        } else {
            modulePath = null;
        }

        JsonElement addModulesConfig = settings.get(CONFIG_ADDMODULES);
        if (addModulesConfig != null && addModulesConfig.isJsonArray()) {
            addModules = String.join(",", addModulesConfig.getAsJsonArray().asList().stream().map((elem) -> elem.getAsString()).toList());
        } else {
            addModules = null;
        }

        JsonElement enablePreviewConfig = settings.get(CONFIG_ENABLE_PREVIEW);
        if (enablePreviewConfig != null && enablePreviewConfig.isJsonPrimitive()) {
            JsonPrimitive primitive = enablePreviewConfig.getAsJsonPrimitive();
            enablePreview = primitive.isBoolean() && primitive.getAsBoolean();
        } else {
            enablePreview = false;
        }

        JsonElement implicitImportsConfig = settings.get(CONFIG_IMPLICIT_IMPORTS);
        if (implicitImportsConfig != null && implicitImportsConfig.isJsonArray()) {
            implicitImports = implicitImportsConfig.getAsJsonArray().asList().stream().map((elem) -> elem.getAsString()).toList();
        } else {
            implicitImports = null;
        }

        JsonElement notebookProjectMappingConfig = settings.get(CONFIG_PROJECTS_MAPPING);
        if (notebookProjectMappingConfig != null && notebookProjectMappingConfig.isJsonObject()) {
            notebookProjectMapping = notebookProjectMappingConfig.getAsJsonObject();
        } else {
            notebookProjectMapping = new JsonObject();
        }

        JsonElement notebookVmOptionsConfig = settings.get(CONFIG_VM_OPTIONS);
        if (notebookVmOptionsConfig != null && notebookVmOptionsConfig.isJsonArray()) {
            notebookVmOptions = notebookVmOptionsConfig.getAsJsonArray().asList().stream().map(el -> el.getAsString()).toList();
        } else {
            notebookVmOptions = Collections.emptyList();
        }
    }
}
