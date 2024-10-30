/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

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
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { env } from 'process';
import { ChildProcessByStdio, spawn } from 'child_process';
import { Readable } from 'stream';

const findNbcode = (extensionPath: string): string => {
    let nbcode = os.platform() === 'win32' ?
        os.arch() === 'x64' ? 'nbcode64.exe' : 'nbcode.exe'
        : 'nbcode.sh';
    let nbcodePath = path.join(extensionPath, "nbcode", "bin", nbcode);

    let nbcodePerm = fs.statSync(nbcodePath);
    if (!nbcodePerm.isFile()) {
        throw `Cannot execute ${nbcodePath}`;
    }
    if (os.platform() !== 'win32') {
        fs.chmodSync(path.join(extensionPath, "nbcode", "bin", nbcode), "744");
        fs.chmodSync(path.join(extensionPath, "nbcode", "platform", "lib", "nbexec.sh"), "744");
        fs.chmodSync(path.join(extensionPath, "nbcode", "java", "maven", "bin", "mvn.sh"), "744");
    }
    return nbcodePath;
}

if (typeof process === 'object' && process.argv0 === 'node') {
    let extension = path.join(process.argv[1], '..', '..', '..');
    let nbcode = path.join(extension, 'nbcode');
    if (!fs.existsSync(nbcode)) {
        throw `Cannot find ${nbcode}. Try npm run compile first!`;
    }
    let clusters = fs.readdirSync(nbcode).filter(c => c !== 'bin' && c !== 'etc').map(c => path.join(nbcode, c));
    let args = process.argv.slice(2);
    let json = JSON.parse("" + fs.readFileSync(path.join(extension, 'package.json')));
    let storage;

    if (!env.nbcode_userdir || env.nbcode_userdir == 'global') {
        storage = path.join(os.platform() === 'darwin' ?
            path.join(os.homedir(), 'Library', 'Application Support') :
            path.join(os.homedir(), '.config'),
            'Code', 'User', 'globalStorage', json.publisher + '.' + json.name);
    } else {
        storage = env.nbcode_userdir;
    }
    const userdir = path.join(storage, "userdir");

    if (!fs.existsSync(userdir)) {
        fs.mkdirSync(userdir, { recursive: true });
        const stats = fs.statSync(userdir);
        if (!stats.isDirectory()) {
            throw `${userdir} is not a directory`;
        }
    }

    console.log('Launching NBLS with user directory: ' + userdir);
    const ideArgs = [];
    ideArgs.push(`-J-Dnetbeans.extra.dirs="${clusters.join(path.delimiter)}"`, ...args);
    const nbcodeBinPath = findNbcode(extension);
    const nbProcess: ChildProcessByStdio<any, Readable, Readable> = spawn(nbcodeBinPath, ideArgs, {
        cwd: userdir,
        stdio: ["ignore", "pipe", "pipe"],
    });

    nbProcess.stdout.on('data', function (data) {
        console.log(data.toString());
    });
    nbProcess.stderr.on('data', function (data) {
        console.log(data.toString());
    });
    nbProcess.on('close', (code) => {
        console.log(`nbcode finished with status ${code}`);
    });
}
