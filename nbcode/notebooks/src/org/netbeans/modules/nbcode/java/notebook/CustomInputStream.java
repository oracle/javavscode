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

import java.io.ByteArrayInputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.netbeans.modules.java.lsp.server.input.ShowInputBoxParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.openide.util.NbBundle;

/**
 *
 * @author atalati
 */
@NbBundle.Messages({
    "PROMPT_GetUserInput=Please provide scanner input here"
})
public class CustomInputStream extends InputStream {

    private static final Logger LOG = Logger.getLogger(CustomInputStream.class.getName());
    private ByteArrayInputStream currentStream;
    private final WeakReference<NbCodeLanguageClient> client;
    private static final String USER_PROMPT_REQUEST = Bundle.PROMPT_GetUserInput();

    public CustomInputStream(NbCodeLanguageClient client) {
        this.client = new WeakReference<>(client);
    }

    @Override
    public synchronized int read(byte[] b, int off, int len) throws IOException {
        try {
            if (currentStream == null || currentStream.available() == 0) {
                NbCodeLanguageClient client = this.client.get();
                if (client == null) {
                    LOG.log(Level.WARNING, "client is null");
                    throw new EOFException("User input dismissed");
                }
                CompletableFuture<String> future = client.showInputBox(new ShowInputBoxParams(USER_PROMPT_REQUEST, "", true));
                String userInput = future.get();

                if (userInput == null) {
                    LOG.log(Level.WARNING, "User input is null");
                    // Workaround: jshell closes the input stream when -1 is returned and provides no way to reset it.
                    // This hack bypasses that behavior to prevent the stream from being closed.
                    throw new EOFException("User input dismissed");
                }

                byte[] inputBytes = (userInput + System.lineSeparator()).getBytes(StandardCharsets.UTF_8);
                currentStream = new ByteArrayInputStream(inputBytes);
            }

            return currentStream.read(b, off, len);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while waiting for user input", ex);
        } catch (ExecutionException ex) {
            throw new IOException("Failed to get user input", ex.getCause());
        }
    }

    @Override
    public int read() throws IOException {
        byte[] oneByte = new byte[1];
        int n = read(oneByte, 0, 1);
        if (n == -1) {
            throw new EOFException("User input dismissed");
        }
        return oneByte[0] & 0xFF;
    }
}
