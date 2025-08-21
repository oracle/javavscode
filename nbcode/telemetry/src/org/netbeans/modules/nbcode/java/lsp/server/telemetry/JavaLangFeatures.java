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
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

class JavaLangFeatures {
    private static final Logger LOG = Logger.getLogger(JavaLangFeatures.class.getName());

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
            String prefix = null;
            try {
                for (Source.Feature f : Source.Feature.values()) {
                    try {
                        JCDiagnostic.Fragment nameFragment = f.nameFragment();
                        featureFragments.put(nameFragment.getCode(), f);

                        if (prefix == null) {
                            final String fragmentKey = nameFragment.key();
                            final String fragmentCode = nameFragment.getCode();
                            if (fragmentCode.length() > 0 && fragmentKey.endsWith(fragmentCode)) {
                                prefix = fragmentKey.substring(0, fragmentKey.length() - fragmentCode.length());
                            }
                        }
                    } catch (AssertionError | NullPointerException e) {
                        // In case no error message code has been registered; for example: LOCAL_VARIABLE_TYPE_INFERENCE
                        featureFragments.put(f.name(), f);
                    }
                }

                Set<String> diagnosticMethodNames = new HashSet<>(Arrays.asList(
                        "FeatureNotSupportedInSource",
                        "FeatureNotSupportedInSourcePlural",
                        "PreviewFeatureDisabled",
                        "PreviewFeatureDisabledPlural",
                        "PreviewFeatureUse",
                        "PreviewFeatureUsePlural",
                        "IsPreview",
                        "IsPreviewReflective"
                ));
                supplyKeyForEachDiagnosticName(diagnosticMethodNames, parentDiagnosticKeys::add);
            } catch (VirtualMachineError e) {
                throw e;
            } catch (Throwable e) {
                try {
                    LOG.log(Level.CONFIG, "Unexpected error initialising Java Language features and parent diagnostic codes: {0}", (Object) e);
                } catch (Throwable ignore) {
                }
            }
            javacFragmentCodePrefix = prefix == null ? "compiler.misc." : prefix;
            javacParentDiagnosticKeys = parentDiagnosticKeys.isEmpty() ? Collections.emptySet() : Collections.unmodifiableSet(parentDiagnosticKeys);
            fragmentCodeToFeature = featureFragments.isEmpty() ? Collections.emptyMap() : Collections.unmodifiableMap(featureFragments);
        }

        private static void supplyKeyForEachDiagnosticName(Set<String> methodNames, Consumer<String> action) {
            if (methodNames == null || methodNames.isEmpty()) return;
            final Object[][] emptyArgs = new Object[6][];
            for (int i = 0; i < emptyArgs.length; i++) {
                emptyArgs[i] = new Object[i];
            }
            int numInitErrors = 0;
            Class<?>[] classes = CompilerProperties.class.getClasses();
            for (Class<?> nestedClass : classes) {
                Method[] methods = Modifier.isStatic(nestedClass.getModifiers()) ? nestedClass.getMethods() : null;
                if (methods == null || methods.length == 0) {
                    continue;
                }
                for (Method m : methods) {
                    try {
                        if (Modifier.isStatic(m.getModifiers())
                                && JCDiagnostic.DiagnosticInfo.class.isAssignableFrom(m.getReturnType())
                                && methodNames.contains(m.getName())) {
                            int numParams = m.getParameterCount();
                            JCDiagnostic.DiagnosticInfo diag = (JCDiagnostic.DiagnosticInfo) m.invoke(null, numParams < emptyArgs.length ? emptyArgs[numParams] : Arrays.copyOf(emptyArgs[0], numParams));
                            if (diag != null) {
                                action.accept(diag.key());
                            }
                        }
                    } catch (VirtualMachineError e) {
                        throw e;
                    } catch (Throwable e) {
                        numInitErrors++;
                        try {
                            String name = null;
                            try {
                                name = m.getName();
                            } catch (Throwable ignore) {
                            }
                            LOG.log(Level.FINE, "Unexpected error initialising diagnostic key for method \"{1}\", related to Java Language features: {0}", 
                                    name == null ? new Object[]{e, m} : new Object[]{e, name});
                        } catch (Throwable ignore) {
                        }
                    }
                }
            }
            if (numInitErrors > 0 && !LOG.isLoggable(Level.FINE)) {
                try {
                    LOG.log(Level.CONFIG, "Unexpected {0} error(s) initialising diagnostic keys for methods related to Java Language features.", numInitErrors);
                } catch (Throwable ignore) {
                }
            }
        }
    }

}
