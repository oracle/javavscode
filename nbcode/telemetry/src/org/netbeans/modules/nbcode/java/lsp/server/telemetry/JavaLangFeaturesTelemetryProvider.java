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

import java.lang.ref.WeakReference;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.netbeans.api.editor.mimelookup.MimeRegistration;
import org.netbeans.api.lsp.Diagnostic;
import org.netbeans.modules.java.lsp.server.protocol.LspServerTelemetryManager;
import org.netbeans.spi.lsp.ErrorProvider;
import org.openide.util.NbPreferences;
import org.openide.util.RequestProcessor;
import org.openide.util.RequestProcessor.Task;

@MimeRegistration(mimeType="text/x-java", service=ErrorProvider.class)
public class JavaLangFeaturesTelemetryProvider implements ErrorProvider {

    static final String PREFERENCES_NODE = "jdk.telemetry";
    static final String PREFERENCES_KEY_DEBOUNCE_TIME = "java-lang-features-debounce";
    static final String PREFERENCES_KEY_CACHE_EXPIRY = "java-lang-features-cache-expiry";

    static RequestProcessor getRequestProcessor() {
        return RPSingleton.instance;
    }

    private static int getRequestDebounceTime() {
        return RPSingleton.DEBOUNCE_TIME;
    }

    private static final class RPSingleton {
        private static final RequestProcessor instance = new RequestProcessor(JavaLangFeaturesTelemetryProvider.class.getName(), 10, true, false);
        private static final int DEBOUNCE_TIME = Math.max(0, NbPreferences.forModule(JavaLangFeaturesTelemetryProvider.class).node(PREFERENCES_NODE).getInt(PREFERENCES_KEY_DEBOUNCE_TIME, 1000)); // 1 sec
    }

    private static final ConcurrentHashMap<String, WeakReference<Task>> sourceAnalysisTasks = new ConcurrentHashMap<>();

    @Override
    public List<? extends Diagnostic> computeErrors(Context context) {
        if (context.errorKind() == ErrorProvider.Kind.HINTS && LspServerTelemetryManager.getInstance().isTelemetryEnabled()) {
            final SourceInfo sourceInfo = SourceInfo.getSourceObject(context);
            if (sourceInfo.source != null) {
                scheduleTask(sourceInfo, JavaLanguageFeaturesEmitter::new);
            }
        }
        return Collections.emptyList();
    }

    private WeakReference<Task> scheduleTask(SourceInfo sourceInfo, Function<SourceInfo, Runnable> runner) {
        String sourceFileName = sourceInfo.getSourceName();
        return sourceAnalysisTasks.compute(sourceFileName, (file, existingTaskRef) -> {
            Task existingTask = existingTaskRef == null ? null : existingTaskRef.get();
            final Task task;
            final WeakReference<Task> taskRef;
            if (existingTask == null) {
                task = getRequestProcessor().create(runner.apply(sourceInfo));
                taskRef = new WeakReference<>(existingTask);
                task.addTaskListener(t -> sourceAnalysisTasks.remove(sourceFileName, taskRef));
            } else {
                task = existingTask;
                taskRef = existingTaskRef;
            }
            task.schedule(getRequestDebounceTime());
            return taskRef;
        });
    }
    
    static ConcurrentHashMap<String, WeakReference<Task>> getSourceAnalysisTasks() {
        return sourceAnalysisTasks;
    }
}
