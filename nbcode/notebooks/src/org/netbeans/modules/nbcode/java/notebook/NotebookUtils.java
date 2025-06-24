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

import org.eclipse.lsp4j.Position;

/**
 *
 * @author atalati
 */
public class NotebookUtils {

    public static String normalizeLineEndings(String text) {
        if (text == null) {
            return null;
        }

        if (text.indexOf('\r') == -1) {
            return text;
        }

        StringBuilder normalized = new StringBuilder(text.length());
        int len = text.length();

        for (int i = 0; i < len; i++) {
            char c = text.charAt(i);
            if (c == '\r') {
                if (i + 1 < len && text.charAt(i + 1) == '\n') {
                    i++;
                }
                normalized.append('\n');
            } else {
                normalized.append(c);
            }
        }

        return normalized.toString();
    }

    public static int getOffset(String content, Position position) {
        if (content == null || position == null) {
            return 0;
        }

        String[] lines = content.split("\n", -1);
        int offset = 0;
        int targetLine = position.getLine();
        int targetChar = position.getCharacter();

        if (targetLine < 0) {
            return 0;
        }
        if (targetLine >= lines.length) {
            return content.length();
        }

        for (int i = 0; i < targetLine; i++) {
            offset += lines[i].length() + 1;
        }

        String currentLine = lines[targetLine];
        int charPosition = Math.min(Math.max(targetChar, 0), currentLine.length());
        offset += charPosition;

        return Math.min(offset, content.length());
    }

    public static Position getPosition(String content, int offset) {
        if (content == null || offset <= 0) {
            return new Position(0, 0);
        }

        int clampedOffset = Math.min(offset, content.length());

        String textUpToOffset = content.substring(0, clampedOffset);
        String[] lines = textUpToOffset.split("\n", -1);

        int line = lines.length - 1;
        int character = lines[line].length();

        return new Position(line, character);
    }
    
    public static boolean checkEmptyString(String input) {
        return (input == null || input.trim().isEmpty());
    }
}
