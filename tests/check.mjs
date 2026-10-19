// Quick check of the game's code, without a browser: every module parses, every local import
// points at a file that exports what is imported, every bare import ('three', 'cannon-es') is in
// index.html's import map, and every local file index.html links to exists.
// Run from the repo root: node tests/check.mjs (needs Node 20 or later). Writes reports/check.txt.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const problems = [];
const read = (path) => readFileSync(join(root, path), 'utf8');
const sources = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`);

// 1. Syntax. package.json says "type": "module", so node --check parses these as ES modules.
for (const file of sources) {
  try {
    execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'pipe' });
  } catch (e) {
    problems.push(`${file}: syntax error\n${e.stderr.toString().trim()}`);
  }
}

// 2. Imports.
const html = read('index.html');
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const exportsOf = (file) => {
  const code = read(file);
  const names = new Set();
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([\w$]+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  return names;
};
for (const file of sources) {
  for (const m of read(file).matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, what, spec] = m;
    if (spec.startsWith('.')) {
      const target = relative(root, join(root, dirname(file), spec)).replaceAll('\\', '/');
      if (!existsSync(join(root, target))) {
        problems.push(`${file}: imports ${spec}, which doesn't exist`);
        continue;
      }
      const named = what.match(/\{([^}]*)\}/);
      if (!named) continue;
      const available = exportsOf(target);
      for (const part of named[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0];
        if (name && !available.has(name)) problems.push(`${file}: imports { ${name} } from ${spec}, which doesn't export it`);
      }
    } else if (!(spec in importMap) && !Object.keys(importMap).some((k) => k.endsWith('/') && spec.startsWith(k))) {
      problems.push(`${file}: imports '${spec}', which index.html's import map doesn't list`);
    }
  }
}

// 3. Local files linked from index.html.
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const path = m[1];
  if (/^(?:[a-z]+:|\/\/|#)/i.test(path)) continue;
  if (!existsSync(join(root, path))) problems.push(`index.html: links to ${path}, which doesn't exist`);
}

const report = problems.length
  ? `${problems.length} problem(s):\n\n${problems.join('\n\n')}\n`
  : `All good: ${sources.length} modules checked.\n`;
mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports', 'check.txt'), report);
process.stdout.write(report);
process.exit(problems.length ? 1 : 0);
