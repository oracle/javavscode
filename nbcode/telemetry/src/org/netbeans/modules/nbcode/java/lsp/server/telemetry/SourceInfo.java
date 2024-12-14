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
import java.lang.ref.WeakReference;
import java.net.URI;
import java.util.Map;
import java.util.function.Function;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import org.eclipse.lsp4j.services.LanguageClient;
import org.netbeans.api.java.platform.JavaPlatform;
import org.netbeans.api.java.project.JavaProjectConstants;
import org.netbeans.api.project.FileOwnerQuery;
import org.netbeans.api.project.Project;
import org.netbeans.api.project.ProjectUtils;
import org.netbeans.api.project.SourceGroup;
import org.netbeans.api.project.Sources;
import org.netbeans.modules.java.lsp.server.protocol.LspServerTelemetryManager;
import org.netbeans.spi.lsp.ErrorProvider;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.Lookup;

class SourceInfo {

    private final FileObject file;
    private final Project owner;
    final JavaFileObject source;
    /**
     * A transient reference cache to the LanguageClient associated with this source.
     * This does not need to be made concurrency-safe since the source is expected
     * to be associated with a single client during its lifetime here. Further, 
     * it can be queried and rewritten again safely, especially across threads.
     * So, there is no need to make this an atomic reference.
     * Finally, it needs to be a weak-reference so that the client resources are
     * released as soon as possible.
     */
    private transient WeakReference<LanguageClient> client;

    public SourceInfo(FileObject file, Project owner, JavaFileObject source) {
        this.file = file;
        this.owner = owner;
        this.source = source;
    }

    public String getSourceName() {
        return source == null ? "" : source.getName();
    }

    public String getProjectName() {
        return owner == null ? "" : ProjectUtils.getInformation(ProjectUtils.rootOf(owner)).getName();
    }

    public String getSourcesPath() {
        if (owner != null) {
            final Sources sources = ProjectUtils.getSources(owner);
            SourceGroup[] sourceGroups = sources.getSourceGroups(JavaProjectConstants.SOURCES_TYPE_JAVA);
            if (sourceGroups.length == 0) {
                sourceGroups = sources.getSourceGroups(Sources.TYPE_GENERIC);
            }
            StringBuilder sb = new StringBuilder();
            for (SourceGroup group : sourceGroups) {
                final File root = FileUtil.toFile(group.getRootFolder());
                if (root != null) {
                    if (!sb.isEmpty()) {
                        sb.append(File.pathSeparatorChar);
                    }
                    sb.append(root.getAbsolutePath());
                }
            }
            return sb.toString();
        } else {
            final File parent = FileUtil.toFile(file.getParent());
            return parent == null ? "." : parent.getAbsolutePath();
        }
    }

    public LanguageClient getLanguageClient() {
        LanguageClient client = this.client == null ? null : this.client.get();
        if (client == null) {
            client = Lookup.getDefault().lookup(LanguageClient.class);
            if (client != null)
                this.client = new WeakReference<>(client);
        }
        return client;
    }

    public String getJavaVersion() {
        final JavaPlatform defaultPlatform = JavaPlatform.getDefault();
        final Map<String, String> systemProperties = defaultPlatform.getSystemProperties();
        Function<String, String> lookupFunction = systemProperties == null ? System::getProperty : systemProperties::get;
        return LspServerTelemetryManager.getJavaRuntimeVersion(lookupFunction);
    }

    public boolean getPreviewEnabled() {
        return LspServerTelemetryManager.getInstance().isPreviewEnabled(file,
                owner == null ? LspServerTelemetryManager.ProjectType.standalone : LspServerTelemetryManager.getInstance().getProjectType(owner),
                getLanguageClient());
    }

    public static SourceInfo getSourceObject(ErrorProvider.Context context) {
        final FileObject file = context.file();
        final Project owner = FileOwnerQuery.getOwner(file);
        JavaFileObject source = null;
        try {
            source = new BasicJavaFileObject(file.toURI(), file.asText());
        } catch (IOException | IllegalArgumentException ignore) {
        }
        return new SourceInfo(file, owner, source);
    }

    static class BasicJavaFileObject extends SimpleJavaFileObject {

        private final String content;

        public BasicJavaFileObject(URI uri, String content) {
            super(uri, Kind.SOURCE);
            this.content = content;
        }

        @Override
        public CharSequence getCharContent(boolean ignoreEncodingErrors) throws IOException {
            return content;
        }
    }
}
