/*
 * Copyright (c) 2025-2026 Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may 'ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.notebook;

import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.eclipse.lsp4j.ConfigurationItem;
import org.eclipse.lsp4j.ConfigurationParams;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/*  TODO 
    test multiple configuration scenarios
        1.Client sends nulls/empty 
        2.Missing keys 
*/

/**
 *  Mock LSP Client sending sample configurations
 *  Verifies that the NotebookConfigs class 
 *      parses and handles configurations appropriately 
 *
 * @author shimadan
 */
public class NotebookConfigsTest {

    private NotebookConfigs instance;
    private CompletableFuture<Void> initialized;
    private JsonObject configsObj = new JsonObject();
    private static final String CLASSPATH_KEY = "jdk.notebook.classpath";
    private static final String IMPLICIT_IMPORTS_KEY = "jdk.notebook.implicitImports";
    private static final String ADD_MODULES_KEY = "jdk.notebook.addmodules";
    private static final String ENABLE_PREVIEW_KEY = "jdk.notebook.enablePreview";
    private static final String MODULEPATH_KEY = "jdk.notebook.modulepath";
    private static final String VM_OPTIONS_KEY = "jdk.notebook.vmOptions";

    public NotebookConfigsTest() {
    }

    @Before
    public void setUp() {
        setConfigObject();
        LanguageClientInstance.getInstance().
                setClient(new MockNbClientConfigs());
        instance = NotebookConfigs.getInstance();
        instance.initConfigs();
        initialized = instance.getInitialized();
    }

    @After
    public void tearDown() {
    }

    /**
     * Test of getInitialized method, of class NotebookConfigs.
     */
    @Test
    public void testGetInitialized() {
        System.out.println("getInitialized");
        CompletableFuture<Void> result = instance.getInitialized();
        try {
            result.get(5, TimeUnit.SECONDS);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }

    /**
     * Test of getClassPath method, of class NotebookConfigs.
     */
    @Test
    public void testGetClassPath() {
        System.out.println("getClassPath");
        try {
            initialized.get(5, TimeUnit.SECONDS);
            String expResult = String.join(File.pathSeparator, (configsObj.get(CLASSPATH_KEY).getAsJsonArray()).asList().stream().map((elem) -> elem.getAsString()).toList());
            String result = instance.getClassPath();
            assertEquals(expResult, result);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }

    /**
     * Test of getModulePath method, of class NotebookConfigs.
     */
    @Test
    public void testGetModulePath() {
        System.out.println("getModulePath");

        try {
            initialized.get(5, TimeUnit.SECONDS);
            String expResult = String.join(File.pathSeparator, (configsObj.get(MODULEPATH_KEY).getAsJsonArray()).asList().stream().map((elem) -> elem.getAsString()).toList());
            String result = instance.getModulePath();
            assertEquals(expResult, result);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }

    /**
     * Test of getAddModules method, of class NotebookConfigs.
     */
    @Test
    public void testGetAddModules() {
        System.out.println("getAddModules");
        try {
            initialized.get(5, TimeUnit.SECONDS);
            String expResult = String.join(",",(configsObj.get(ADD_MODULES_KEY).getAsJsonArray()).asList().stream().map((elem) -> elem.getAsString()).toList());
            String result = instance.getAddModules();
            assertEquals(expResult, result);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }

    /**
     * Test of isEnablePreview method, of class NotebookConfigs.
     */
    @Test
    public void testIsEnablePreview() {
        System.out.println("getIsEnablePreview");
        try {
            initialized.get(5, TimeUnit.SECONDS);
            boolean expResult = configsObj.get(ENABLE_PREVIEW_KEY).getAsBoolean();
            boolean result = instance.isEnablePreview();
            assertEquals(expResult, result);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }

    /**
     * Test of getImplicitImports method, of class NotebookConfigs.
     */
    @Test
    public void testGetImplicitImports() {
        System.out.println("getImplicitImports");
        try {
            initialized.get(5, TimeUnit.SECONDS);
            List<String> expResult = configsObj.get(IMPLICIT_IMPORTS_KEY).
                    getAsJsonArray().asList().stream().
                    map((elem) -> elem.getAsString()).toList();
            List<String> result = instance.getImplicitImports();
            assertEquals(expResult, result);
        } catch (Exception ex) {
            fail("Configuration initialization failed");
        }
    }
    
    /**
    * Test of getNotebookVmOptions method, of class NotebookConfigs.
    */
   @Test
   public void testGetNotebookVmOptions() {
       System.out.println("getNotebookVmOptions");
       try {
           initialized.get(5, TimeUnit.SECONDS);

           List<String> expResult = configsObj.get(VM_OPTIONS_KEY)
                   .getAsJsonArray()
                   .asList()
                   .stream()
                   .map(elem -> elem.getAsString())
                   .toList();

           List<String> result = instance.getNotebookVmOptions();

           assertEquals(expResult, result);
       } catch (Exception ex) {
           fail("Configuration initialization failed");
       }
   }
   
    /**
     * Test of getNotebookVmOptions method when the configuration key is
     * missing. Verifies that the system handles a null/missing key gracefully
     * (likely returning an empty list).
     */
    @Test
    public void testGetNotebookVmOptionsWhenMissing() {
        try {
            updateConfigValue(VM_OPTIONS_KEY, null);
            List<String> result = instance.getNotebookVmOptions();
            assertNotNull("Result should not be null even if key is missing", result);
            assertTrue("Result should be empty when key is missing", result.isEmpty());

        } catch (Exception ex) {
            fail("Failed to handle missing VM_OPTIONS_KEY: " + ex.getMessage());
        }
    }
    
    /**
     * Test of getNotebookVmOptions with quoted spaces.
     * Verifies that options containing spaces (like directory paths) are preserved.
     */
    @Test
    public void testGetNotebookVmOptionsWithQuotedSpaces() {
        try {
            String quotedOption = "\"-Djava.io.tmpdir=C:\\Temp Folder\\java\"";

            JsonArray vmOptions = new JsonArray();
            vmOptions.add(new JsonPrimitive(quotedOption));
            updateConfigValue(VM_OPTIONS_KEY, vmOptions);
            List<String> result = instance.getNotebookVmOptions();
            
            assertTrue("Result should contain the quoted option", result.contains(quotedOption));
            assertEquals("Should have exactly 1 option", 1, result.size());
            
        } catch (Exception ex) {
            fail("Configuration with quoted spaces failed");
        }
    }
    
    private void setConfigObject() {
        JsonArray imports = new JsonArray();
        imports.add(new JsonPrimitive("java.math.*"));
        imports.add(new JsonPrimitive("javafx.scene.control.*"));
        configsObj.add(IMPLICIT_IMPORTS_KEY, imports);
        
        JsonArray classpath = new JsonArray();
        classpath.add(new JsonPrimitive(
                "path/to/javafx-sdk-24.0.1/lib/javafx.base.jar"));
        configsObj.add(CLASSPATH_KEY, classpath);
        
        JsonArray modulepath = new JsonArray();
        modulepath.add(new JsonPrimitive("/path/to/javafx-sdk/lib"));
        configsObj.add(MODULEPATH_KEY, modulepath);
        configsObj.add(ENABLE_PREVIEW_KEY, new JsonPrimitive(false));
        
        JsonArray addModules = new JsonArray();
        addModules.add(new JsonPrimitive("javafx.controls"));
        addModules.add(new JsonPrimitive("javafx.graphics"));
        configsObj.add(ADD_MODULES_KEY, addModules);
        
        JsonArray vmOptions = new JsonArray();
        vmOptions.add(new JsonPrimitive("--add-opens=java.base/java.lang=ALL-UNNAMED"));
        vmOptions.add(new JsonPrimitive("--add-opens=java.base/java.util=ALL-UNNAMED"));
        vmOptions.add(new JsonPrimitive("-Xmx2G"));
        configsObj.add(VM_OPTIONS_KEY, vmOptions);

    }
    
    private void updateConfigValue(String key, JsonElement value){
        configsObj.add(key, value);
        instance.initConfigs(); 
        instance.getInitialized();
    }

    private class MockNbClientConfigs extends MockNbClient {

        @Override
        public CompletableFuture<List<Object>> configuration(ConfigurationParams configurationParams) {
            List<ConfigurationItem> items = configurationParams.getItems();
            List<Object> configs = new ArrayList<>();
            for (ConfigurationItem item : items) {
                configs.add(configsObj.get(item.getSection()));
            }
            return CompletableFuture.completedFuture(configs);
        }
    }
}
