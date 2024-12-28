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

import java.util.Set;
import org.eclipse.lsp4j.MessageType;
import org.netbeans.modules.java.lsp.server.protocol.TelemetryEvent;

public class JdkFeatureEvent extends TelemetryEvent {
    
    public static final String JDK_FEATURES_EVT = "jdkFeature";

    public JdkFeatureEvent(String jsonString) {
        super(MessageType.Info.toString(), JDK_FEATURES_EVT, jsonString);
    }

    public JdkFeatureEvent(JdkFeatures features) {
        super(MessageType.Info.toString(), JDK_FEATURES_EVT, features);
    }

    public static class JdkFeatures {
        private String javaVersion;
        private Boolean isPreviewEnabled;
        private Set<String> names;
        private Set<Integer> jeps;

        public String getJavaVersion() {
            return javaVersion;
        }

        public void setJavaVersion(String javaVersion) {
            this.javaVersion = javaVersion;
        }

        public Boolean getIsPreviewEnabled() {
            return isPreviewEnabled;
        }

        public void setIsPreviewEnabled(Boolean isPreviewEnabled) {
            this.isPreviewEnabled = isPreviewEnabled;
        }

        public Set<String> getNames() {
            return names;
        }

        public void setNames(Set<String> names) {
            this.names = names;
        }

        public Set<Integer> getJeps() {
            return jeps;
        }

        public void setJeps(Set<Integer> jeps) {
            this.jeps = jeps;
        }

    }

    public static class Builder {
        private final JdkFeatures properties = new JdkFeatures();

        public Builder setJavaVersion(String javaVersion) {
            properties.setJavaVersion(javaVersion);
            return this;
        }

        public Builder setNames(Set<String> names) {
            properties.setNames(names);
            return this;
        }

        public Builder setJeps(Set<Integer> jeps) {
            properties.setJeps(jeps);
            return this;
        }

        public Builder setIsPreviewEnabled(boolean previewEnabled) {
            properties.setIsPreviewEnabled(previewEnabled);
            return this;
        }

        public JdkFeatureEvent build() {
            return new JdkFeatureEvent(properties);
        }
    }
    
}
