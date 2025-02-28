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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLConnection;

/**
 *
 * @author atalati
 */
public class ResultEval {

    private final String data;
    private final String mimeType;

    public ResultEval(String rawData, String mimeType) {
        this.data = rawData;
        this.mimeType = mimeType;
    }

    public String getData() {
        return data;
    }

    public String getMimeType() {
        return mimeType;
    }

    public static ResultEval text(String data) {
        return new ResultEval(data, "text/plain");
    }

    private String detectMime(byte[] data) {
        try (ByteArrayInputStream in = new ByteArrayInputStream(data)) {
            String detected = URLConnection.guessContentTypeFromStream(in);
            return detected != null ? detected : "text/plain";
        } catch (IOException ex) {
            return "text/plain";
        }
    }

    private String detectMime(ByteArrayOutputStream data) {
        return detectMime(data.toByteArray());
    }
}
