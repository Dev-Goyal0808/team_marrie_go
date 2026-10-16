import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['apps', 'packages', 'scripts', 'workers'];
const ignoredDirectories = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

for (const sourceRoot of sourceRoots) {
  const sourcePath = path.join(root, sourceRoot);
  try {
    const files = await walk(sourcePath);
    for (const file of files) {
      const relative = path.relative(root, file);
      if (/\.(ts|tsx)$/.test(file)) {
        errors.push(`${relative}: TypeScript source is not allowed; use JavaScript.`);
        continue;
      }
      if (file.endsWith('.mjs')) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (result.status !== 0) {
          errors.push(`${relative}: ${result.stderr.trim()}`);
        }
      }
      if (file.endsWith('.json')) {
        try {
          JSON.parse(await readFile(file, 'utf8'));
        } catch (error) {
          errors.push(`${relative}: invalid JSON (${error.message})`);
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('JavaScript syntax and JSON structure checks passed.\n');
}
