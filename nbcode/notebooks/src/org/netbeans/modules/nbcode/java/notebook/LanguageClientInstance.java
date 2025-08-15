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

import java.lang.ref.WeakReference;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class LanguageClientInstance {

    private WeakReference<NbCodeLanguageClient> client = null;

    private LanguageClientInstance() {
    }

    public static LanguageClientInstance getInstance() {
        return LanguageClientInstance.Singleton.instance;
    }

    private static class Singleton {

        private static final LanguageClientInstance instance = new LanguageClientInstance();
    }

    public NbCodeLanguageClient getClient() {
        return this.client == null ? null : this.client.get();
    }

    public void setClient(NbCodeLanguageClient client) {
        this.client = new WeakReference<>(client);
    }
}
