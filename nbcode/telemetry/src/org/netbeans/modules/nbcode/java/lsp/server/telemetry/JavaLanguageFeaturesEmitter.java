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

import com.sun.source.util.JavacTask;
import com.sun.tools.javac.api.ClientCodeWrapper.DiagnosticSourceUnwrapper;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.util.JCDiagnostic;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.tools.DiagnosticListener;
import javax.tools.JavaFileObject;
import javax.tools.ToolProvider;
import org.eclipse.lsp4j.services.LanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.LspServerTelemetryManager;

class JavaLanguageFeaturesEmitter implements Runnable {
    private static final Logger LOG = Logger.getLogger(JavaLanguageFeaturesEmitter.class.getName());

    private final SourceInfo sourceInfo;

    JavaLanguageFeaturesEmitter(SourceInfo sourceInfo) {
        this.sourceInfo = sourceInfo;
    }

    @Override
    public void run() {
        Set<String> featuresUsed = checkJavaFeatures();
        if (!featuresUsed.isEmpty() && SourceFeatureCache.add(sourceInfo.getProjectName(), featuresUsed)) {
            final LanguageClient client = sourceInfo.getLanguageClient();
            final SourceFeatureCache.SourceFeatureCacheEntry cached = SourceFeatureCache.get(sourceInfo.getProjectName());
            final boolean previewEnabled = cached == null ? sourceInfo.getPreviewEnabled() : cached.isPreviewEnabled(sourceInfo);
            final JdkFeatureEvent event = new JdkFeatureEvent.Builder()
                    .setJavaVersion(sourceInfo.getJavaVersion())
                    .setIsPreviewEnabled(previewEnabled)
                    .setNames(featuresUsed)
                    .build();
            if (client == null) {
                LspServerTelemetryManager.getInstance().sendTelemetry(event);
            } else {
                LspServerTelemetryManager.getInstance().sendTelemetry(client, event);
            }
        }
    }

    Set<String> checkJavaFeatures() {
        Set<String> featuresUsed = new HashSet<>();
        DiagnosticListener<? super JavaFileObject> dl = d -> {
            //this is not an API, requires access to internals:
            addNewJavaFeaturesUsed(featuresUsed,
                    d instanceof DiagnosticSourceUnwrapper ? ((DiagnosticSourceUnwrapper) d).d
                            : d instanceof JCDiagnostic ? (JCDiagnostic) d
                                    : null);
        };
        JavacTask task;
        try {
            task = (JavacTask) ToolProvider.getSystemJavaCompiler().getTask(null, null, dl, List.of("--source", "8", "--source-path", sourceInfo.getSourcesPath()), null, List.of(sourceInfo.source));
            task.analyze();
        } catch (IOException e) {
            LOG.log(Level.FINE, "IO error while scanning Java Language features: {0}", (Object) e);
        } catch (IllegalArgumentException e) {
            LOG.log(Level.CONFIG, "Invalid parsing parameters for scanning Java Language features: {0}", (Object) e);
        } catch (RuntimeException ignored) {
        }
        return featuresUsed;
    }

    void addNewJavaFeaturesUsed(Set<String> featuresUsed, JCDiagnostic jcDiag) {
        if (jcDiag == null)
            return;
        if (JavaLangFeatures.isDiagnosticForUnsupportedFeatures(jcDiag.getCode())) {
            if (jcDiag.getArgs().length > 0) {
                if (jcDiag.getArgs()[0] instanceof JCDiagnostic) {
                    featuresUsed.add(JavaLangFeatures.getFeatureName(((JCDiagnostic) jcDiag.getArgs()[0]).getCode()));
                } else if (jcDiag.getArgs()[0] instanceof JCDiagnostic.DiagnosticInfo) {
                    featuresUsed.add(JavaLangFeatures.getFeatureName(((JCDiagnostic.DiagnosticInfo) jcDiag.getArgs()[0]).getCode()));
                } else if (jcDiag.getArgs()[0] instanceof Symbol) {
                    featuresUsed.add(JavaLangFeatures.getFeatureName(((Symbol) jcDiag.getArgs()[0]).getSimpleName().toString()));
                }
            }
            return;
        }
        for (Object arg : jcDiag.getArgs()) {
            if (arg instanceof JCDiagnostic)
                addNewJavaFeaturesUsed(featuresUsed, (JCDiagnostic) arg);
        }
    }
}
