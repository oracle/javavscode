/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.notebook;

import org.junit.Test;
import org.junit.Before;
import org.junit.After;
import static org.junit.Assert.*;

import jdk.jshell.JShell;
import jdk.jshell.Snippet;
import jdk.jshell.SnippetEvent;

import java.util.List;

public class CodeEvalTest {

    private JShell jshell;
    private CodeEval instance;

    @Before
    public void setUp() {
        jshell = JShell.create();
        instance = CodeEval.getInstance();
    }

    @After
    public void tearDown() {
        if (jshell != null) {
            jshell.close();
        }
    }

    @Test
    public void testGetCompilationErrors_WithSyntaxError() {
        List<SnippetEvent> events = jshell.eval("int x = ;");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertFalse("Should have compilation errors", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_WithValidCode() {
        List<SnippetEvent> events = jshell.eval("int x = 5;");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Should not have compilation errors for valid code", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_WithUnresolvedDependency() {
        List<SnippetEvent> events = jshell.eval("void testMethod() { System.out.println(undefinedVar); }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertFalse("Should have unresolved dependency error", errors.isEmpty());
        boolean hasCannotBeMessage = false;
        for (String error : errors) {
            if (error.contains("cannot be")) {
                hasCannotBeMessage = true;
                break;
            }
        }
        assertTrue("Error message should mention that it cannot be invoked/used", hasCannotBeMessage);
    }

    @Test
    public void testGetCompilationErrors_MethodWithUnresolvedDependency() {
        List<SnippetEvent> events = jshell.eval("int calculate() { return undefinedMethod(); }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertFalse("Should have errors for undefined method", errors.isEmpty());
        boolean hasMethodReference = false;
        for (String error : errors) {
            if (error.contains("method") || error.contains("calculate")) {
                hasMethodReference = true;
                break;
            }
        }
        assertTrue("Error should reference the method", hasMethodReference);
    }

    @Test
    public void testGetCompilationErrors_ClassWithUnresolvedDependency() {
        List<SnippetEvent> events = jshell.eval("class MyClass { UndefinedType field; }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertFalse("Should have errors for undefined type", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_VariableDeclaration() {
        List<SnippetEvent> events = jshell.eval("String name = \"test\";");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Valid variable declaration should have no errors", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_MultipleErrors() {
        List<SnippetEvent> events = jshell.eval("int x = ; int y = ;");
        
        for (SnippetEvent event : events) {
            List<String> errors = instance.getCompilationErrors(jshell, event);
            if (event.snippet().kind() == Snippet.Kind.VAR) {
                assertFalse("Should have compilation errors", errors.isEmpty());
            }
        }
    }

    @Test
    public void testGetCompilationErrors_InterfaceDeclaration() {
        List<SnippetEvent> events = jshell.eval("interface MyInterface { void method(); }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Valid interface should have no errors", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_EnumDeclaration() {
        List<SnippetEvent> events = jshell.eval("enum Color { RED, GREEN, BLUE }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Valid enum should have no errors", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_MultipleUnresolvedDependencies() {
        List<SnippetEvent> events = jshell.eval(
            "void process() { undefinedVar1.toString(); undefinedVar2.toString(); }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertFalse("Should have errors for multiple dependencies", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_MethodDeclaration() {
        List<SnippetEvent> events = jshell.eval("int add(int a, int b) { return a + b; }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Valid method declaration should have no errors", errors.isEmpty());
    }

    @Test
    public void testGetCompilationErrors_ClassDeclaration() {
        List<SnippetEvent> events = jshell.eval("class Person { String name; int age; }");
        SnippetEvent event = events.get(0);

        List<String> errors = instance.getCompilationErrors(jshell, event);

        assertTrue("Valid class declaration should have no errors", errors.isEmpty());
    }
}