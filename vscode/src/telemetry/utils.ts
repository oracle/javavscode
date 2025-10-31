/*
  Copyright (c) 2024-2025, Oracle and/or its affiliates.

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
import * as crypto from 'crypto';
import { Uri, workspace } from 'vscode';
import * as os from 'os';
import { FileUtils, isObject, isString } from '../utils';

export const getCurrentUTCDateInSeconds = () => {
    const date = Date.now();
    return Math.floor(date / 1000);
}

export const getOriginalDateFromSeconds = (seconds: number) => {
    return new Date(seconds * 1000);
}

export const exists = async (pathOrUri: Uri | string): Promise<boolean> => {
    const uri = getUri(pathOrUri);
    try {
        await workspace.fs.stat(uri);
        return true;
    } catch (e) {
        return false;
    }
}

export const writeFile = async (pathOrUri: Uri | string, content: string): Promise<void> => {
    const uri = getUri(pathOrUri);
    const parent = Uri.joinPath(uri, "..");
    if (!(await exists(parent))) {
        await mkdir(parent);
    }
    const res: Uint8Array = new TextEncoder().encode(content);
    return workspace.fs.writeFile(uri, res);
}

export const readFile = async (pathOrUri: Uri | string): Promise<string | undefined> => {
    const uri = getUri(pathOrUri);
    if (!(await exists(uri))) {
        return undefined;
    }
    const read = await workspace.fs.readFile(uri);
    return new TextDecoder().decode(read);
}

export const mkdir = async (pathOrUri: Uri | string): Promise<void> => {
    const uri = getUri(pathOrUri);
    await workspace.fs.createDirectory(uri);
}

export const getHashCode = (value: string, algorithm: string = 'sha256') => {
    const hash: string = crypto.createHash(algorithm).update(value).digest('hex');
    return hash;
}

const getUri = (pathOrUri: Uri | string): Uri => {
    if (pathOrUri instanceof Uri) {
        return pathOrUri;
    }
    return FileUtils.toUri(pathOrUri);
}

export const getValuesToBeTransformed = (): string[] => {
    const MIN_BLOCKED_VAL_LENGTH = 3;
    const IGNORED_VALUES = ['java', 'vscode', 'user', 'oracle'];

    const blockedValues: (string | undefined)[] = [
    process.env?.SUDO_USER,
    process.env?.C9_USER,
    process.env?.LOGNAME,
    process.env?.USER,
    process.env?.LNAME,
    process.env?.USERNAME,
    process.env?.HOSTNAME,
    process.env?.COMPUTERNAME,
    process.env?.NAME,
    os.userInfo().username].map(el => el?.trim());

    return Array.from(new Set(blockedValues.filter((el): el is string => el !== undefined &&
        el.length >= MIN_BLOCKED_VAL_LENGTH &&
        !IGNORED_VALUES.includes(el)
    )));
}


export const isPrimitiveTransformationNotRequired = (value: any) => (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
);


export const transformValue = (key: string | null, blockedValues: string[], propertiesToTransform: string[], replacedValue: string, value: any): any => {
    if (isPrimitiveTransformationNotRequired(value)) {
        return value;
    }

    if (isString(value)) {
        if (!value.trim().length) return value;

        let updatedValue = value;
        if (key == null || !propertiesToTransform.includes(key)) return value;
        blockedValues.forEach(valueToBeReplaced =>
            updatedValue = replaceAllOccurrences(updatedValue, valueToBeReplaced, replacedValue)
        );

        return updatedValue;
    }

    if (Array.isArray(value)) {
        return value.map(el => transformValue(key, blockedValues, propertiesToTransform, replacedValue, el));
    }

    if (isObject(value)) {
        const result: any = {};
        for (const [k, val] of Object.entries(value)) {
            result[k] = transformValue(k, blockedValues, propertiesToTransform, replacedValue, val);
        }
        return result;
    }
    return value;
};

export const replaceAllOccurrences = (str: string, valueString: string, replaceString: string) => {
    if(!valueString.trim().length) return str;
    return str.split(valueString).join(replaceString);
} 