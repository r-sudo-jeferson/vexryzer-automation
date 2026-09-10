import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_SESSION_FILES = 64;
const MAX_SESSION_BYTES = 5_000_000;

export interface PersistenceEvidence {
  jsonlFileCount: number;
  scannedBytes: number;
  markerFileCount: number;
  containsMarker: boolean;
}

async function collectJsonlFiles(root: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (files.length >= MAX_SESSION_FILES) {
      throw new Error(`Session persistence evidence exceeded ${MAX_SESSION_FILES} JSONL files`);
    }
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlFiles(path, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
  }
}

export async function inspectSessionPersistence(root: string, marker: string): Promise<PersistenceEvidence> {
  if (!root.trim()) throw new TypeError('Persistence root must not be empty');
  if (!marker.trim()) throw new TypeError('Persistence marker must not be empty');

  const files: string[] = [];
  await collectJsonlFiles(root, files);
  let scannedBytes = 0;
  let markerFileCount = 0;

  for (const file of files) {
    const data = await readFile(file);
    scannedBytes += data.byteLength;
    if (scannedBytes > MAX_SESSION_BYTES) {
      throw new Error(`Session persistence evidence exceeded ${MAX_SESSION_BYTES} bytes`);
    }
    if (data.includes(marker)) markerFileCount += 1;
  }

  return {
    jsonlFileCount: files.length,
    scannedBytes,
    markerFileCount,
    containsMarker: markerFileCount > 0,
  };
}
