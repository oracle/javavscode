import { Buffer } from 'buffer';
import * as vscode from 'vscode';

/**
 * Convert a Base64 string to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(base64, 'base64');
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to Base64 string.
 */
export function uint8ArrayToBase64(data: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(data).toString('base64');
  }
  let binary = '';
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

/**
 * Create a NotebookCellOutputItem from data and mimeType.
 */
export function createOutputItem(data: string | Uint8Array, mimeType: string): vscode.NotebookCellOutputItem {
  if (mimeType.startsWith('image/')) {
    const bytes = typeof data === 'string' ? base64ToUint8Array(data) : data;
    return new vscode.NotebookCellOutputItem(bytes, mimeType);
  }
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return vscode.NotebookCellOutputItem.text(text, mimeType);
}
