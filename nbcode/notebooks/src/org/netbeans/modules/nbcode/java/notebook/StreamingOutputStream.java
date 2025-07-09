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
import java.util.function.Consumer;

/**
 *
 * @author atalati
 */
public class StreamingOutputStream extends OutputStream {
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private Consumer<byte[]> callback;
    // What if line endings are not there then how to flush Systen.out.print()?
    private static final char NEW_LINE_ENDING = '\n';
    private static final char NEW_LINE_ENDING_DOS = '\r';

    public StreamingOutputStream(Consumer<byte[]> callback) {
        this.callback = callback;
    }

    @Override
    public void write(int b) throws IOException {
        buffer.write(b);
        checkNewlineEndings((byte) b);
    }

    @Override
    public void write(byte[] b, int off, int len) throws IOException {
        buffer.write(b, off, len);
        checkForNewlineAndFlush(b, off, len);
    }

    @Override
    public void flush() throws IOException {
        super.flush();
        flushToCallback();
    }

    @Override
    public void write(byte[] b) throws IOException {
        buffer.write(b);
        checkForNewlineAndFlush(b, 0, b.length);
    }
    
    @Override
    public void close() throws IOException {
        flushToCallback();
        super.close();
    }
    
    public void setCallback(Consumer<byte[]> cb){
        this.callback = cb;
    }
    
    public ByteArrayOutputStream getOutputStream(){
        return buffer;
    }

    private void checkForNewlineAndFlush(byte[] b, int offset, int length) {
        for (int i = offset; i < offset + length; i++) {
            boolean isNew = checkNewlineEndings(b[i]);
            if (isNew) {
                break;
            }
        }
    }

    private boolean checkNewlineEndings(byte b) {
        if (b == NEW_LINE_ENDING || b == NEW_LINE_ENDING_DOS) {
            flushToCallback();
            return true;
        }
        return false;
    }

    private void flushToCallback() {
        if (buffer.size() > 0) {
            byte[] output = buffer.toByteArray();
            buffer.reset();
            callback.accept(output);
        }
    }
}
