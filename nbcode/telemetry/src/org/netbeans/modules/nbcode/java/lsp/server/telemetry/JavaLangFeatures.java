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

import com.sun.tools.javac.code.Source;
import com.sun.tools.javac.resources.CompilerProperties;
import com.sun.tools.javac.util.JCDiagnostic;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

class JavaLangFeatures {

    public static boolean isDiagnosticForUnsupportedFeatures(String diagnosticCode) {
        return Singleton.javacParentDiagnosticKeys.contains(diagnosticCode);
    }

    public static String getFeatureName(String featureCode) {
        Source.Feature feature = Singleton.fragmentCodeToFeature.get(featureCode);
        if (feature == null && featureCode.startsWith(Singleton.javacFragmentCodePrefix)) {
            feature = Singleton.fragmentCodeToFeature.get(featureCode.substring(Singleton.javacFragmentCodePrefix.length()));
        }
        return feature == null ? featureCode : feature.name();
    }

    private static class Singleton {

        private static final Map<String, Source.Feature> fragmentCodeToFeature;
        private static final Set<String> javacParentDiagnosticKeys;
        private static final String javacFragmentCodePrefix;

        static {
            Map<String, Source.Feature> featureFragments = new HashMap<>();
            Set<String> parentDiagnosticKeys = new HashSet<>();
            String prefix = "compiler.misc.";
            try {
                final JCDiagnostic.Fragment fragment = CompilerProperties.Fragments.FeatureNotSupportedInSource((JCDiagnostic) null, null, null);
                final String fragmentKey = fragment.key();
                final String fragmentCode = fragment.getCode();
                if (fragmentKey.startsWith(fragmentCode)) {
                    prefix = fragmentKey.substring(fragmentCode.length());
                }

                parentDiagnosticKeys.add(fragmentKey);
                parentDiagnosticKeys.add(CompilerProperties.Fragments.FeatureNotSupportedInSourcePlural((JCDiagnostic) null, null, null).key());
                parentDiagnosticKeys.add(CompilerProperties.Errors.FeatureNotSupportedInSource((JCDiagnostic) null, null, null).key());
                parentDiagnosticKeys.add(CompilerProperties.Errors.FeatureNotSupportedInSourcePlural((JCDiagnostic) null, null, null).key());
                
                parentDiagnosticKeys.add(CompilerProperties.Errors.PreviewFeatureDisabled((JCDiagnostic) null).key());
                parentDiagnosticKeys.add(CompilerProperties.Errors.PreviewFeatureDisabledPlural((JCDiagnostic) null).key());
                parentDiagnosticKeys.add(CompilerProperties.Warnings.PreviewFeatureUse((JCDiagnostic) null).key());
                parentDiagnosticKeys.add(CompilerProperties.Warnings.PreviewFeatureUsePlural((JCDiagnostic) null).key());

                parentDiagnosticKeys.add(CompilerProperties.Errors.IsPreview(null).key());
                parentDiagnosticKeys.add(CompilerProperties.Warnings.IsPreview(null).key());
                parentDiagnosticKeys.add(CompilerProperties.Warnings.IsPreviewReflective(null).key());
                
                for (Source.Feature f : Source.Feature.values()) {
                    try {
                        featureFragments.put(f.nameFragment().getCode(), f);
                    } catch (AssertionError | NullPointerException e) {
                        // In case no error message code has been registered; for example: LOCAL_VARIABLE_TYPE_INFERENCE
                        featureFragments.put(f.name(), f);
                    }
                }
            } catch (VirtualMachineError e) {
                throw e;
            } catch (Throwable ignore) {
            }
            javacFragmentCodePrefix = prefix;
            javacParentDiagnosticKeys = parentDiagnosticKeys.isEmpty() ? Collections.emptySet() : Collections.unmodifiableSet(parentDiagnosticKeys);
            fragmentCodeToFeature = featureFragments.isEmpty() ? Collections.emptyMap() : Collections.unmodifiableMap(featureFragments);
        }
    }

}
