import { randomUUID } from 'node:crypto';
/**
 * File system cross-platform tests.
 * Verifies that file operations using Node's fs APIs work correctly on both platforms.
 * Uses os.tmpdir() for temp paths — never hardcodes /tmp.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

const tmpDir = os.tmpdir();

describe('file creation and deletion', () => {
  const created: string[] = [];

  afterEach(async () => {
    for (const p of created) {
      await fs.rm(p, { recursive: true, force: true });
    }
    created.length = 0;
  });

  it('creates and reads a file using os.tmpdir()', async () => {
    const filePath = path.join(tmpDir, `cross-platform-test-${randomUUID()}.txt`);
    created.push(filePath);

    await fs.writeFile(filePath, 'hello cross-platform', 'utf8');
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe('hello cross-platform');
  });

  it('creates a nested directory using path.join', async () => {
    const dirPath = path.join(tmpDir, `cross-platform-dir-${randomUUID()}`, 'sub', 'nested');
    created.push(path.join(tmpDir, dirPath.split(path.sep)[tmpDir.split(path.sep).length]!));

    await fs.mkdir(dirPath, { recursive: true });
    const stat = await fs.stat(dirPath);
    expect(stat.isDirectory()).toBe(true);

    // Cleanup root of the created tree
    const root = path.join(tmpDir, path.relative(tmpDir, dirPath).split(path.sep)[0]!);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('file names with dots and underscores work on all platforms', async () => {
    const filePath = path.join(tmpDir, `test.file_name-${randomUUID()}.json`);
    created.push(filePath);

    await fs.writeFile(filePath, '{}', 'utf8');
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('deletes a file with fs.rm', async () => {
    const filePath = path.join(tmpDir, `delete-me-${randomUUID()}.txt`);
    await fs.writeFile(filePath, 'to be deleted');
    await fs.rm(filePath);

    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

describe('path operations on platform paths', () => {
  it('path.basename extracts filename correctly', () => {
    const posixPath = 'parent/child/file.ts';
    expect(path.posix.basename(posixPath)).toBe('file.ts');
    expect(path.posix.basename(posixPath, '.ts')).toBe('file');
  });

  it('path.dirname extracts parent correctly', () => {
    expect(path.posix.dirname('a/b/c.ts')).toBe('a/b');
    expect(path.posix.dirname('a/b/')).toBe('a');
  });
});
