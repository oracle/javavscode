/*
  Copyright (c) 2023, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export const MAIN_TEST_JAVA = `/*
* Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
*/
package pkg;

import static org.junit.jupiter.api.Assertions.*;

/**
*
* @author atalati
*/
class MainTest {
    @org.junit.jupiter.api.Test
    public void testGetName() {
        assertEquals("John", new Main().getName());
    }
    @org.junit.jupiter.api.Nested
    class NestedTest {
        @org.junit.jupiter.api.Test
        public void testTrue() {
            assertTrue(true);
        }
    }
}`;

export const MAIN_JAVA = `/*
* Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
*/
package pkg;

/**
*
* @author atalati
*/
public class Main {
    public static void main(String... args) throws Exception {
        System.out.println("Endless wait...");
        while (true) {
            Thread.sleep(1000);
        }
    }
    public String getName() {
        return "John";
    }
}`;

export const EXAMPLE_POM = `<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
<modelVersion>4.0.0</modelVersion>
<groupId>org.netbeans.demo.vscode.t1</groupId>
<artifactId>basicapp</artifactId>
<version>1.0</version>
<properties>
    <maven.compiler.source>1.8</maven.compiler.source>
    <maven.compiler.target>1.8</maven.compiler.target>
    <exec.mainClass>pkg.Main</exec.mainClass>
</properties>
<build>
<plugins>
    <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>2.22.0</version>
    </plugin>
</plugins>
</build>
<dependencies>
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter-api</artifactId>
    <version>5.3.1</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter-params</artifactId>
    <version>5.3.1</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter-engine</artifactId>
    <version>5.3.1</version>
    <scope>test</scope>
</dependency>
</dependencies>
</project>`;

export const SAMPLE_CODE_FORMAT_DOCUMENT: string = `/** Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license*/    
package pkg;/** * * @author atalati*/
public class FormatDocument {public static void main(String[] args) {System.out.println("Hello World!");}}`;

export const SAMPLE_CODE_UNUSED_IMPORTS: string = `/*
* Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
*/
package pkg;

import java.lang.Float;
import java.lang.Integer;

/**
*
* @author atalati
*/
public class UnusedImports {

   public static void main(String[] args) {
       System.out.println("Test 1 func called");
   }
}
`;

export const SAMPLE_CODE_SORT_IMPORTS: string = `/** Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license */
package pkg;

import java.util.Date;
import java.util.ArrayList;

/**
 * ** @author atalati
 */
public class SortImports {

    public static void main(String[] args) {
    }

    public void testImports() {
        Date d = new Date();
        ArrayList b = new ArrayList<>();
    }
}
`;

export const SAMPLE_CODE_REFACTOR: string = `/*
* Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
*/
package pkg;

/**
*
* @author atalati
*/
public class RefactorActions {

   public static void main(String[] args) {
       System.out.println("Test 1 func called");
   }
}
`;

export const SAMPLE_BUILD_GRADLE = 
`
plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

application {
    mainClassName = 'org.yourCompany.yourProject.App'
}
`;

export const SAMPLE_SETTINGS_GRADLE = 
`
rootProject.name = 'yourProject'

include ':yourProject'
`;

export const SAMPLE_APP_JAVA = 
`
package org.yourCompany.yourProject;

public class App {
    public static void main(String[] args) {
        System.out.println("Hello, yourProject!");
    }
}
`