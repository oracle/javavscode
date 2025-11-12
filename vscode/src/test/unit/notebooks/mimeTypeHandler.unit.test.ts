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
import { Buffer } from 'buffer';
import { NotebookCellOutputItem } from 'vscode';
import { MimeTypeHandler } from '../../../notebooks/mimeTypeHandler';
import { mimeTypes } from '../../../notebooks/constants';
import { IMimeBundle } from '../../../notebooks/types';
import { describe, it } from 'mocha';

describe('MimeTypeHandler', () => {

  function decodeData(item: NotebookCellOutputItem): string {
    const bytes: Uint8Array = (item as any).data;
    return new TextDecoder().decode(bytes);
  }

  describe('getters isText / isImage', () => {
    it('isText ⇢ true only for mimeTypes.TEXT', () => {
      expect(new MimeTypeHandler(mimeTypes.TEXT).isText).to.be.true;
      expect(new MimeTypeHandler('image/jpeg').isText).to.be.false;
    });

    it('isImage ⇢ true only for image/*', () => {
      expect(new MimeTypeHandler('image/png').isImage).to.be.true;
      expect(new MimeTypeHandler(mimeTypes.TEXT).isImage).to.be.false;
    });
      
  });

  describe('static toBytes()', () => {
    it('decodes a base64 string into the original Uint8Array', () => {
      const text = 'Hello, 世界!';
      const b64  = Buffer.from(text).toString('base64');
      const out  = MimeTypeHandler.toBytes(b64);
      expect(out).to.be.instanceOf(Uint8Array);
      expect(Buffer.from(out).toString()).to.equal(text);
    });

    it('returns the same Uint8Array when passed through', () => {
      const arr = new Uint8Array([1, 2, 3]);
      expect(MimeTypeHandler.toBytes(arr)).to.equal(arr);
    });

    it('decodes empty string to empty Uint8Array', () => {
      const out = MimeTypeHandler.toBytes('');
      expect(out).to.be.instanceOf(Uint8Array);
      expect(out.length).to.equal(0);
    });
  });

  describe('static toString()', () => {
    it('returns the same string if input is already string', () => {
      const s = 'just a test';
      expect(MimeTypeHandler.toString(s)).to.equal(s);
    });

    it('decodes a Uint8Array into a string via TextDecoder', () => {
      const text    = '¡Hola!';
      const encoder = new TextEncoder();
      const arr     = encoder.encode(text);
      expect(MimeTypeHandler.toString(arr)).to.equal(text);
    });

    it('decodes empty Uint8Array to empty string', () => {
      const arr = new Uint8Array([]);
      expect(MimeTypeHandler.toString(arr)).to.equal('');
    });
  });

  describe('makeOutputItem()', () => {
    it('for TEXT builds a NotebookCellOutputItem containing the UTF-8 bytes of the string', () => {
      const handler = new MimeTypeHandler(mimeTypes.TEXT);
      const item    = handler.makeOutputItem('plain text');
      expect(item).to.be.instanceOf(NotebookCellOutputItem);
      expect((item as any).mime).to.equal(mimeTypes.TEXT);
      expect(decodeData(item)).to.equal('plain text');
    });

    it('handles empty text payload correctly', () => {
      const handler = new MimeTypeHandler(mimeTypes.TEXT);
      const item    = handler.makeOutputItem('');
      expect(decodeData(item)).to.equal('');
      expect((item as any).data.length).to.equal(0);
    });

    it('for image/* with a base64 string decodes back to the original bytes', () => {
      const raw  = new Uint8Array([10, 20, 30]);
      const b64  = Buffer.from(raw).toString('base64');
      const handler = new MimeTypeHandler('image/png');
      const item    = handler.makeOutputItem(b64);
      expect((item as any).mime).to.equal('image/png');
      const got = (item as any).data as Uint8Array;
      expect(Array.from(got)).to.deep.equal(Array.from(raw));
    });

    it('for image/* with a Uint8Array leaves the bytes untouched', () => {
      const raw = new Uint8Array([5, 6, 7]);
      const handler = new MimeTypeHandler('image/gif');
      const item    = handler.makeOutputItem(raw);
      expect((item as any).mime).to.equal('image/gif');
      expect((item as any).data).to.equal(raw);
    });

    it('unknown mime routes through text branch', () => {
      const handler = new MimeTypeHandler('application/xml');
      const payload = '<note/>';
      const item    = handler.makeOutputItem(payload);
      expect((item as any).mime).to.equal('application/xml');
      expect(decodeData(item)).to.equal(payload);
    });
  });

  describe('static itemsFromBundle()', () => {
    it('filters to only text & image entries and decodes each correctly', () => {
      const rawImg = new Uint8Array([1, 2, 3]);
      const b64img = Buffer.from(rawImg).toString('base64');
      const bundle: IMimeBundle = {
        [mimeTypes.TEXT]: 'foo',
        'image/png': b64img,
        'application/json': '{"x":1}',
      };

      const items = MimeTypeHandler.itemsFromBundle(bundle);
      expect(items).to.have.length(3);

      const textItem = items.find(i => (i as any).mime === mimeTypes.TEXT)!;
      expect(decodeData(textItem)).to.equal('foo');

      const imgItem = items.find(i => (i as any).mime === 'image/png')!;
      const gotBytes = (imgItem as any).data as Uint8Array;
      expect(Array.from(gotBytes)).to.deep.equal(Array.from(rawImg));

      const jsonItem = items.find(i => (i as any).mime === undefined)!;
      expect(decodeData(jsonItem)).to.equal('jdk.notebook.mime_type.not.found.cell.output');
    });

    it('joins string-array values before creating the output item', () => {
      const bundle: IMimeBundle = {
        [mimeTypes.TEXT]: ['a', 'b', 'c'],
      };
      const items = MimeTypeHandler.itemsFromBundle(bundle);
      expect(items).to.have.length(1);
      const only = items[0];
      expect(decodeData(only)).to.equal('abc');
      expect((only as any).mime).to.equal(mimeTypes.TEXT);
    });

    it('joins base64-string-array for image payload', () => {
      // "SGVs" + "bG8=" => "SGVsbG8=" which decodes to "Hello"
      const segs = ['SGVs', 'bG8='];
      const bundle: IMimeBundle = {
        'image/png': segs,
      };
      const items = MimeTypeHandler.itemsFromBundle(bundle);
      expect(items).to.have.length(1);
      const only = items[0];
      expect((only as any).mime).to.equal('image/png');
      expect(decodeData(only)).to.equal('Hello');
    });

    it('empty bundle yields no items', () => {
      const items = MimeTypeHandler.itemsFromBundle({});
      expect(items).to.be.empty;
    });

    it('unsupported mime types are dropped', () => {
      const bundle: IMimeBundle = {
        'application/json': '[1,2,3]',
        'video/mp4': 'abcd',
      };
      const items = MimeTypeHandler.itemsFromBundle(bundle);
      expect(items).to.have.length(2);
      expect(items.filter(i => (i as any).mime === undefined)).to.have.length(2);
    });
  });
});
