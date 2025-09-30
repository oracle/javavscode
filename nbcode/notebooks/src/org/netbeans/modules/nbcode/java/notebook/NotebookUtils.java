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

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import jdk.jshell.SourceCodeAnalysis;
import org.eclipse.lsp4j.Position;
import org.netbeans.api.annotations.common.NonNull;

/**
 *
 * @author atalati
 */
public class NotebookUtils {
    private static final Pattern LINE_ENDINGS = Pattern.compile("\\R");

    public static String normalizeLineEndings(String text) {
        return text == null ? null : LINE_ENDINGS.matcher(text).replaceAll("\n");
    }

    public static int getOffset(String content, Position position) {
        if (content == null || position == null) {
            return 0;
        }

        int targetLine = position.getLine();
        if (targetLine < 0) {
            return 0;
        }
        int targetChar = Math.max(0, position.getCharacter());

        int lineStartIndex = -1;
        int lineEndIndex = -1;
        int line = -1;

        // find the start line in content
        do {
            lineStartIndex = lineEndIndex + 1;
            lineEndIndex = content.indexOf('\n', lineStartIndex);
            line++;
        } while (line < targetLine && lineEndIndex >= 0);

        return line < targetLine ? content.length() : Math.min(lineStartIndex + targetChar, lineEndIndex < 0 ? content.length() : lineEndIndex);
    }

    public static Position getPosition(String text, int offset) {
        if (text == null || offset < 0) {
            return new Position(0, 0);
        }

        offset = Math.min(offset, text.length());
        int lineStartIndex = -1;
        int lineEndIndex = -1;
        int line = -1;

        // count line endings in content upto offset
        do {
            lineStartIndex = lineEndIndex + 1;
            lineEndIndex = text.indexOf('\n', lineStartIndex);
            line++;
        } while (lineEndIndex >= 0 && offset > lineEndIndex);
        
        if (offset == lineEndIndex) {
            return new Position(line + 1, 0);
        } else {
            return new Position(line, offset - lineStartIndex);
        }
    }

    public static boolean checkEmptyString(String input) {
        return (input == null || input.trim().isEmpty());
    }

    @SuppressWarnings("unchecked")
    public static <T> T getArgument(List<Object> arguments, int index, Class<T> type) {
        if (arguments != null && arguments.size() > index && arguments.get(index) != null) {
            Object arg = arguments.get(index);

            if (arg instanceof JsonElement) {
                JsonElement jsonElement = (JsonElement) arg;
                if (jsonElement.isJsonNull()) {
                    return null;
                }

                if (type == String.class && jsonElement.isJsonPrimitive() && jsonElement.getAsJsonPrimitive().isString()) {
                    return (T) jsonElement.getAsString();
                } else if (type == Number.class && jsonElement.isJsonPrimitive() && jsonElement.getAsJsonPrimitive().isNumber()) {
                    return (T) jsonElement.getAsNumber();
                } else if (type == Boolean.class && jsonElement.isJsonPrimitive() && jsonElement.getAsJsonPrimitive().isBoolean()) {
                    return (T) Boolean.valueOf(jsonElement.getAsBoolean());
                } else if (type == JsonObject.class && jsonElement.isJsonObject()) {
                    return (T) jsonElement.getAsJsonObject();
                } else if (type == JsonArray.class && jsonElement.isJsonArray()) {
                    return (T) jsonElement.getAsJsonArray();
                } else if (type == JsonPrimitive.class && jsonElement.isJsonPrimitive()) {
                    return (T) jsonElement.getAsJsonPrimitive();
                } else if (type == JsonNull.class && jsonElement.isJsonNull()) {
                    return (T) JsonNull.INSTANCE;
                }
            }

            if (type.isInstance(arg)) {
                return type.cast(arg);
            }
        }
        return null;
    }

    public static List<String> getCodeSnippets(SourceCodeAnalysis analysis, String code) {
        String codeRemaining = code.trim();

        List<String> codeSnippets = new ArrayList<>();
        while (!codeRemaining.isEmpty()) {
            SourceCodeAnalysis.CompletionInfo info = analysis.analyzeCompletion(codeRemaining);
            if (info.completeness().isComplete()) {
                codeSnippets.add(info.source());
            } else {
                codeSnippets.add(codeRemaining);
                break;
            }
            codeRemaining = info.remaining().trim();
        }

        return codeSnippets;
    }

    /**
     * Applies the supplied change, that is encoded as a diff
     * i.e. `{range-start, range-end, text-replacement}`, to the supplied text.
     *
     * This diff format can encode additions, deletions and modifications at a
     * single range in the text.
     *
     * The supplied text is expected to contain normalized line endings, and, the
     * new text adheres to the line ending normalization.
     *
     * @param  text         existing text
     * @param  start        start of the range of replaced text
     * @param  end          end of the range of replaced text
     * @param  replacement  text to be added at the supplied position in text
     * @throws IllegalArgumentException - when the supplied diff range is invalid
     */
    public static String applyChange(@NonNull String text, @NonNull Position start, @NonNull Position end, @NonNull String replacement) throws IllegalArgumentException {
        int startLine = start.getLine();
        int startLineOffset = start.getCharacter();
        int endLine = end.getLine();
        int endLineOffset = end.getCharacter();

        if (startLine < 0 || endLine < startLine || (endLine == startLine && endLineOffset < startLineOffset)) {
            throw new IllegalArgumentException("Invalid range positions");
        }
        
        if (replacement.length() == 0 && startLine == endLine && startLineOffset == endLineOffset) {
            return text; // Nothing to be done; no addition nor deletion
        }

        final int textLength = text.length();

        int lineStartIndex = -1;
        int lineEndIndex = -1;
        int line = -1;

        // find the start line in content
        do {
            lineStartIndex = lineEndIndex + 1;
            lineEndIndex = text.indexOf('\n', lineStartIndex);
            line++;
        } while (line < startLine && lineEndIndex >= 0);

        if (line < startLine) {
            throw new IllegalArgumentException("Invalid range start out of bounds");
        }

        StringBuilder result = new StringBuilder(textLength + replacement.length());

        // append content before the change
        result.append(text, 0, Math.min(lineStartIndex + startLineOffset, lineEndIndex < 0 ? textLength : lineEndIndex));
        // append added text, with line ending normalization
        result.append(LINE_ENDINGS.matcher(replacement).replaceAll("\n"));

        // find the end line in content
        while (line < endLine && lineEndIndex >= 0) {
            lineStartIndex = lineEndIndex + 1;
            lineEndIndex = text.indexOf('\n', lineStartIndex);
            line++;
        }

        if (line < endLine) {
            throw new IllegalArgumentException("Invalid range end out of bounds");
        }

        if (lineStartIndex >= 0) {
            // append content after the change
            result.append(text, Math.min(lineStartIndex + endLineOffset, lineEndIndex < 0 ? textLength : lineEndIndex), textLength);
        }
        return result.toString();
    }
}
