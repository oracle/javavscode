/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//above is the original license from the original source files.
import * as ee from 'events';
import * as stream from 'stream';
import * as vscode from 'vscode';


//copied and adjusted from:
//https://github.com/microsoft/vscode/blob/6c683c327ca8656de700552a519927d9c7316226/src/vs/workbench/contrib/debug/node/debugAdapter.ts#L22
//license: MIT
//original license:
 /*
 MIT License

Copyright (c) 2015 - present Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
export class StreamDebugAdapter implements vscode.DebugAdapter {

	private static readonly TWO_CRLF = '\r\n\r\n';
	private static readonly HEADER_LINESEPARATOR = /\r?\n/;	// allow for non-RFC 2822 conforming line separators
	private static readonly HEADER_FIELDSEPARATOR = /: */;

	private _sendMessage = new Emitter<vscode.DebugProtocolMessage>();
	private outputStream!: stream.Writable;
	private rawData = Buffer.allocUnsafe(0);
	private contentLength = -1;
        
        onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this._sendMessage.event;

	constructor() {
	}

        dispose() {
            this.outputStream.destroy();
        }

        handleMessage(message: vscode.DebugProtocolMessage): void {
            this.sendMessage(message);
        }


	connect(readable: stream.Readable, writable: stream.Writable): void {

		this.outputStream = writable;
		this.rawData = Buffer.allocUnsafe(0);
		this.contentLength = -1;

		readable.on('data', (data: Buffer) => this.handleData(data));
	}

	sendMessage(message: vscode.DebugProtocolMessage): void {

		if (this.outputStream) {
			const json = JSON.stringify(message);
			this.outputStream.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}${StreamDebugAdapter.TWO_CRLF}${json}`, 'utf8');
		}
	}

	private handleData(data: Buffer): void {

		this.rawData = Buffer.concat([this.rawData, data]);

		while (true) {
			if (this.contentLength >= 0) {
				if (this.rawData.length >= this.contentLength) {
					const message = this.rawData.toString('utf8', 0, this.contentLength);
					this.rawData = this.rawData.slice(this.contentLength);
					this.contentLength = -1;
					if (message.length > 0) {
						try {
							this._sendMessage.fire(<vscode.DebugProtocolMessage>JSON.parse(message));
						} catch (e) {
                                                    //TODO:
//							this._onError.fire(new Error((e.message || e) + '\n' + message));
						}
					}
					continue;	// there may be more complete messages to process
				}
			} else {
				const idx = this.rawData.indexOf(StreamDebugAdapter.TWO_CRLF);
				if (idx !== -1) {
					const header = this.rawData.toString('utf8', 0, idx);
					const lines = header.split(StreamDebugAdapter.HEADER_LINESEPARATOR);
					for (const h of lines) {
						const kvPair = h.split(StreamDebugAdapter.HEADER_FIELDSEPARATOR);
						if (kvPair[0] === 'Content-Length') {
							this.contentLength = Number(kvPair[1]);
						}
					}
					this.rawData = this.rawData.slice(idx + StreamDebugAdapter.TWO_CRLF.length);
					continue;
				}
			}
			break;
		}
	}
}

//copied from:
//https://github.com/microsoft/vscode-debugadapter-node/blob/9c591bc34956554f3f9736884dc35ea1e82e8192/adapter/src/protocol.ts
//original license: MIT
//original license:
/*

Copyright (c) Microsoft Corporation

All rights reserved. 

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation 
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software 
is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS 
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT 
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
interface IDisposable {
	dispose(): void;
}

class Disposable0 implements IDisposable {
	dispose(): any {
	}
}

interface Event0<T> {
	(listener: (e: T) => any, thisArg?: any): Disposable0;
}

class Emitter<T> {

	private _event?: Event0<T>;
	private _listener?: (e: T) => void;
	private _this?: any;

	get event(): Event0<T> {
		if (!this._event) {
			this._event = (listener: (e: T) => any, thisArg?: any) => {

				this._listener = listener;
				this._this = thisArg;

				let result: IDisposable;
				result = {
					dispose: () => {
						this._listener = undefined;
						this._this = undefined;
					}
				};
				return result;
			};
		}
		return this._event;
	}

	fire(event: T): void {
		if (this._listener) {
			try {
				this._listener.call(this._this, event);
			} catch (e) {
			}
		}
	}

	hasListener() : boolean {
		return !!this._listener;
	}

	dispose() {
		this._listener = undefined;
		this._this = undefined;
	}
}