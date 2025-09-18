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

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Handles JShell output and error streams for notebook execution.
 *
 * @author atalati
 */
public class JshellStreamsHandler implements AutoCloseable {

    private static final Logger LOG = Logger.getLogger(JshellStreamsHandler.class.getName());
    private final String notebookId;
    private final StreamingOutputStream outStream;
    private final StreamingOutputStream errStream;
    private final PrintStream printOutStream;
    private final PrintStream printErrStream;
    private final InputStream inputStream;

    public JshellStreamsHandler(String notebookId, BiConsumer<String, byte[]> streamCallback) {
        this(notebookId, streamCallback, streamCallback);
    }

    public JshellStreamsHandler(String notebookId,
            BiConsumer<String, byte[]> outStreamCallback,
            BiConsumer<String, byte[]> errStreamCallback) {
        if (notebookId == null || notebookId.trim().isEmpty()) {
            throw new IllegalArgumentException("Notebook Id cannot be null or empty");
        }

        this.notebookId = notebookId;
        this.outStream = new StreamingOutputStream(createCallback(outStreamCallback));
        this.errStream = new StreamingOutputStream(createCallback(errStreamCallback));
        this.printOutStream = new PrintStream(outStream);
        this.printErrStream = new PrintStream(errStream);
        this.inputStream = new CustomInputStream(LanguageClientInstance.getInstance().getClient());
    }

    private Consumer<byte[]> createCallback(BiConsumer<String, byte[]> callback) {
        return callback != null ? output -> callback.accept(notebookId, output) : null;
    }

    public void setOutStreamCallback(BiConsumer<String, byte[]> callback) {
        outStream.setCallback(createCallback(callback));
    }

    public void setErrStreamCallback(BiConsumer<String, byte[]> callback) {
        errStream.setCallback(createCallback(callback));
    }

    public PrintStream getPrintOutStream() {
        return printOutStream;
    }

    public PrintStream getPrintErrStream() {
        return printErrStream;
    }

    public InputStream getInputStream() {
        return inputStream;
    }

    public String getNotebookId() {
        return notebookId;
    }

    public void flushOutputStreams() {
        try {
            outStream.flush();
            errStream.flush();
        } catch (IOException ignored) {
            // nothing can be done
        }
    }

    @Override
    public void close() {
        try {
            printOutStream.close();
            printErrStream.close();
            outStream.close();
            errStream.close();
            inputStream.close();
        } catch (IOException ex) {
            LOG.log(Level.WARNING, "IOException occurred while closing the streams {0}", ex.getMessage());
        }
    }
}
