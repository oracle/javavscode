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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import org.openide.util.RequestProcessor;
import org.openide.util.RequestProcessor.Task;

/**
 *
 * @author atalati
 */
public class StreamingOutputStream extends OutputStream {

    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private Consumer<byte[]> callback;
    private static final int MAX_BUFFER_SIZE = 1024;
    private final AtomicBoolean isPeriodicFlushOutputStream;

    static RequestProcessor getRequestProcessor() {
        return RPSingleton.instance;
    }

    private static int getRequestPeriodicTime() {
        return RPSingleton.PERIODIC_TIME;
    }

    private static final class RPSingleton {

        private static final RequestProcessor instance = new RequestProcessor(StreamingOutputStream.class.getName(), 1, true, false);
        private static final int PERIODIC_TIME = 100;
    }

    public StreamingOutputStream(Consumer<byte[]> callback) {
        this.callback = callback;
        this.isPeriodicFlushOutputStream = new AtomicBoolean(true);
        createAndScheduleTask();
    }

    @Override
    public synchronized void write(int b) throws IOException {
        buffer.write(b);
        ifBufferOverflowFlush();
    }

    @Override
    public synchronized void write(byte[] b, int off, int len) throws IOException {
        buffer.write(b, off, len);
        ifBufferOverflowFlush();
    }

    @Override
    public synchronized void flush() throws IOException {
        flushToCallback();
    }

    @Override
    public synchronized void write(byte[] b) throws IOException {
        buffer.write(b);
        ifBufferOverflowFlush();
    }

    @Override
    public synchronized void close() throws IOException {
        flushToCallback();
        isPeriodicFlushOutputStream.set(false);
        super.close();
    }

    public void setCallback(Consumer<byte[]> cb) {
        this.callback = cb;
    }

    private void ifBufferOverflowFlush() {
        if (buffer.size() > MAX_BUFFER_SIZE) {
            flushToCallback();
        }
    }

    private synchronized void flushToCallback() {
        if (buffer.size() > 0) {
            byte[] output = buffer.toByteArray();
            buffer.reset();
            callback.accept(output);
        }
    }

    private void createAndScheduleTask() {
        if (isPeriodicFlushOutputStream.get()) {
            Task task = getRequestProcessor().create(() -> {
                flushToCallback();
                createAndScheduleTask();
            });
            task.schedule(getRequestPeriodicTime());
        }
    }
}
