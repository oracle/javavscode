/*
  Copyright (c) 2025, Oracle and/or its affiliates.

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
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from "mocha";
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FileUtils } from '../../../utils';
import { LOGGER } from '../../../logger';
import * as path from 'path';

describe('FileUtils.toUri', () => {
	let loggerLogStub: sinon.SinonStub;
	const URI_SCHEME_FILE = "file";

	beforeEach(() => {
		loggerLogStub = sinon.stub(LOGGER, 'log');
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('treatAsUriIfPossible = true', () => {
		describe('successful URI parsing', () => {
			it('should parse a valid file URI using vscode.Uri.parse', () => {
				const filePath = '/path/to/file.java';
				const uriString = `file://${filePath}`;
				
				const result = FileUtils.toUri(uriString, true);
				
				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				expect(result.path).to.equal(filePath);
				expect(result.toString()).to.equal(uriString);
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse a valid file URI with triple slash', () => {
				const uriString = 'file:///path/to/file.java';
				
				const result = FileUtils.toUri(uriString, true);
				
				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				expect(result.path).to.equal('/path/to/file.java');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse a valid file URI with Windows-like path', () => {
				const uriString = 'file:///c:/username/home/file.java';
				
				const result = FileUtils.toUri(uriString, true);

				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				expect(result.path).to.include('/c:');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse file URI with query and fragment', () => {
				const uriString = 'file:///path/to/file.java?query=1#fragment';
				
				const result = FileUtils.toUri(uriString, true);
				
				expect(result.scheme).to.equal('file');
				expect(result.path).to.equal('/path/to/file.java');
				expect(result.query).to.equal('query=1');
				expect(result.fragment).to.equal('fragment');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse file URI with special characters', () => {
				const uriString = 'file:///path/with%20spaces/and-special%21chars.java';
				
				const result = FileUtils.toUri(uriString, true);

				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				expect(result.path).to.include('path');
				expect(result.path).to.include('chars.java');
				expect(loggerLogStub.called).to.be.false;
			});
		});

		describe('non-file URI strings with treatAsUriIfPossible = true', () => {
			it('should treat non-file URI as file path', () => {
				const uriString = 'https://example.com/file.java';
				
				const result = FileUtils.toUri(uriString, true);
				
				expect(result.scheme).to.equal('file');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should treat regular path as file path even with treatAsUriIfPossible', () => {
				const filePath = '/absolute/path/to/file.java';
				
				const result = FileUtils.toUri(filePath, true);
				
				expect(result.scheme).to.equal('file');
				expect(result.path).to.equal(filePath);
				expect(loggerLogStub.called).to.be.false;
			});
		});
	});

	describe('treatAsUriIfPossible = false (default)', () => {
		describe('file path parsing', () => {
			it('should parse absolute Unix path as file URI', () => {
				const filePath = '/absolute/path/to/file.java';
				
				const result = FileUtils.toUri(filePath);
				
				expect(result.scheme).to.equal('file');
				expect(result.path).to.equal(filePath);
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse file path with query and fragment ', () => {
				const pathString = '/path/to/file.java?query=1#fragment';
				
				const result = FileUtils.toUri(pathString);
				
				expect(result.path).to.equal(pathString);
				expect(result.query).to.equal('');
				expect(result.fragment).to.equal('');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse Windows file paths', () => {
				const filePath = 'C:\\Users\\path\\to\\file.java';
				
				const result = FileUtils.toUri(filePath);
				
				expect(result.scheme).to.equal('file');
				expect(path.normalize(result.fsPath).toLowerCase()).to.equal(path.normalize(filePath).toLowerCase());
				expect(loggerLogStub.called).to.be.false;
			});

			it('should parse Windows file paths with lowercase drive', () => {
				const filePath = 'c:\\Users\\path\\to\\file.java';
				
				const result = FileUtils.toUri(filePath);

				expect(result.scheme).to.equal('file');
				expect(path.normalize(result.fsPath).toLowerCase()).to.equal(path.normalize(filePath).toLowerCase());
				expect(loggerLogStub.called).to.be.false;
			});

			it('should handle relative paths', () => {
				const relativePath = './src/main/java/Main.java';
				
				const result = FileUtils.toUri(relativePath);
				
				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				const normalizedPath = result.path.replace(/\\/g, '/');
				expect(normalizedPath).to.include('src/main/java/Main.java');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should handle UNC paths', () => {
				const uncPath = '\\\\server\\share\\file.java';
				
				const result = FileUtils.toUri(uncPath);
				
				expect(result.scheme).to.equal(URI_SCHEME_FILE);
				expect(result.fsPath).to.include('server');
				expect(result.fsPath).to.include('share');
				expect(result.fsPath).to.include('file.java');
				expect(loggerLogStub.called).to.be.false;
			});

			it('should treat file:// strings as regular paths when treatAsUriIfPossible is false', () => {
				const uriString = 'file:///path/to/file.java';
				
				const result = FileUtils.toUri(uriString, false);
				
				expect(result.scheme).to.equal('file');
				expect(loggerLogStub.called).to.be.false;
			});
		});
	});

	describe('error handling', () => {
		it('should throw and log error when URI parsing fails', () => {
			const invalidUri = 'file://::invalid::';
			sinon.stub(vscode.Uri, 'parse').throws(new Error('Invalid URI format'));
			
			expect(() => FileUtils.toUri(invalidUri, true)).to.throw('Error while parsing URI');
			expect(loggerLogStub.calledOnce).to.be.true;
			expect(loggerLogStub.firstCall.args[0]).to.include('Error while parsing uri');
			expect(loggerLogStub.firstCall.args[0]).to.include('Invalid URI format');
		});

		it('should throw and log error when file path parsing fails', () => {
			const invalidPath = 'some/path';
			const errorMessage = 'File parse failed';
			sinon.stub(vscode.Uri, 'file').throws(new Error(errorMessage));
			
			expect(() => FileUtils.toUri(invalidPath)).to.throw('Error while parsing URI');
			expect(loggerLogStub.calledOnce).to.be.true;
			expect(loggerLogStub.firstCall.args[0]).to.contain(errorMessage);
		});

		it('should handle non-Error objects in catch block', () => {
			const path = '/some/path';
			sinon.stub(vscode.Uri, 'file').throws('string error');
			
			expect(() => FileUtils.toUri(path)).to.throw('Error while parsing URI');
			expect(loggerLogStub.calledOnce).to.be.true;
			expect(loggerLogStub.firstCall.args[0]).to.include('string error');
		});
	});

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const emptyPath = '';
			
			const result = FileUtils.toUri(emptyPath);

			expect(result.scheme).to.equal(URI_SCHEME_FILE);
			expect(result.path).to.satisfy((p: string) => p === '/' || p.match(/^\/[a-z]:/i));
			expect(loggerLogStub.called).to.be.false;
		});

		it('should handle paths with spaces and special characters', () => {
			const filePath = '/path/with spaces/and-special!chars.java';
			
			const result = FileUtils.toUri(filePath);

			expect(result.scheme).to.equal(URI_SCHEME_FILE);
			expect(result.fsPath).to.include('special');
			expect(loggerLogStub.called).to.be.false;
		});

		it('should differentiate between file: prefix with and without treatAsUriIfPossible', () => {
			const uriString = 'file:///path/to/file.java';
			
			const resultAsUri = FileUtils.toUri(uriString, true);
			const resultAsPath = FileUtils.toUri(uriString, false);
			
			expect(resultAsUri.scheme).to.equal('file');
			expect(resultAsPath.scheme).to.equal('file');
			expect(resultAsUri.path).to.equal('/path/to/file.java');
			expect(loggerLogStub.called).to.be.false;
		});

		it('should handle file: scheme with single slash', () => {
			const uriString = 'file:/path/to/file.java';
			
			const result = FileUtils.toUri(uriString, true);
			
			expect(result.scheme).to.equal('file');
			expect(loggerLogStub.called).to.be.false;
		});
	});

	describe('parameter validation', () => {
		it('should default treatAsUriIfPossible to false', () => {
			const filePath = '/some/path/file.txt';
			
			const resultDefault = FileUtils.toUri(filePath);
			const resultExplicit = FileUtils.toUri(filePath, false);
			
			expect(resultDefault.toString()).to.equal(resultExplicit.toString());
			expect(loggerLogStub.called).to.be.false;
		});

		it('should only parse as URI when both treatAsUriIfPossible is true AND path starts with file:', () => {
			const regularPath = '/regular/path.txt';
			const fileUriPath = 'file:///uri/path.txt';
			
			const result1 = FileUtils.toUri(regularPath, true);
			const result2 = FileUtils.toUri(fileUriPath, true);
			const result3 = FileUtils.toUri(fileUriPath, false);
			
			expect(result1.path).to.equal(regularPath);
			expect(result2.path).to.equal('/uri/path.txt');
			expect(result3.scheme).to.equal('file');
			expect(loggerLogStub.called).to.be.false;
		});
	});
});