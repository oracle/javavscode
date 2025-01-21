/*
 * Copyright (c) 2024-2025, Oracle and/or its affiliates.
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
package org.netbeans.modules.nbcode.java.lsp.server.telemetry;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.Test;
import org.netbeans.junit.NbTestCase;
import org.openide.filesystems.FileUtil;

public class JavaLanguageFeaturesEmitterTest extends NbTestCase {

    public JavaLanguageFeaturesEmitterTest(String name) {
        super(name);
    }

    @Test
    public void testDiagToFeatureName() {
        List<String> diagCodes = Arrays.asList("feature.records", "feature.switch.rules", "feature.diamond.and.anon.class", "feature.pattern.switch", "feature.switch.expressions", "feature.xyz");
        List<String> featNames = Arrays.asList("RECORDS", "SWITCH_RULE", "DIAMOND_WITH_ANONYMOUS_CLASS_CREATION", "PATTERN_SWITCH", "SWITCH_EXPRESSION", "feature.xyz");
        for (int i = 0; i < diagCodes.size() ; i++) {
            String code = diagCodes.get(i);
            String name = JavaLangFeatures.getFeatureName(code);
            assertEquals(featNames.get(i), name);
        }
    }
    
    @Test
    public void testCheckJavaFeatures() {
        SourceInfo sourceInfo;
        try {
            sourceInfo = new SourceInfo(FileUtil.toFileObject(File.createTempFile("test", ".java")), null, new SourceInfo.BasicJavaFileObject(new URI("mem://test.java"), getTestCode1()));
        } catch (IOException | URISyntaxException ex) {
            fail(ex.toString());
            return;
        }
        JavaLanguageFeaturesEmitter instance = new JavaLanguageFeaturesEmitter(sourceInfo);
        Set<String> expResult = new HashSet<>(Arrays.asList("RECORDS", "DIAMOND_WITH_ANONYMOUS_CLASS_CREATION", "SWITCH_EXPRESSION", "SWITCH_RULE", "PATTERN_SWITCH"));
        Set<String> result = instance.checkJavaFeatures();
        assertEquals(expResult, result);
    }

    private String getTestCode1() {
        return "                             import java.util.*;\n"
                + "                               public record R(int i) {\n"
                + "                                   private int t(Object o) {\n"
                + "                                       List<String> l = new ArrayList<>() {};\n"
                + "                                       return switch (o) { default -> 0; }\n"
                + "                                   }\n"
                + "                               }";
    }
}
