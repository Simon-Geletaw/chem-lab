// dev.mjs — run every subject lab on its own port with one command.
//
// Reads labs.json: each entry is a standalone Vite app folder. This script
// spawns `npm run dev` in each existing folder and prefixes every line of
// output with the lab name, so one terminal shows all the ports at once.
//
//   node dev.mjs            → run all labs that exist
//   node dev.mjs chem bio   → run only the named ones
//   node dev.mjs --build    → build all labs instead of dev-serving
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const buildMode = args.includes('--build');
const wanted = new Set(args.filter((a) => a !== '--build'));

const labs = JSON.parse((await import('node:fs')).readFileSync(resolve(ROOT, 'labs.json'), 'utf8'));

const pad = (s, n) => String(s).padEnd(n);

for (const lab of labs) {
  if (wanted.size > 0 && !wanted.has(lab.name)) continue;
  const dir = resolve(ROOT, lab.dir);
  if (!existsSync(dir)) {
    console.log(`${pad(lab.name, 6)} skipped (${lab.dir} not created yet)`);
    continue;
  }
  const script = buildMode ? 'build' : 'dev';
  console.log(`${pad(lab.name, 6)} starting npm run ${script} → http://localhost:${lab.port}${lab.path || '/'}`);
  const cliArgs = buildMode
    ? []
    : ['--', '--port', String(lab.port), '--strictPort'];
  const child = spawn('npm', ['run', script, ...cliArgs], {
    cwd: dir,
    shell: process.platform === 'win32'
  });
  child.stdout.on('data', (d) => {
    for (const line of String(d).trimEnd().split('\n')) {
      console.log(`\x1b[36m${pad(lab.name, 6)}\x1b[0m ${line}`);
    }
  });
  child.stderr.on('data', (d) => {
    for (const line of String(d).trimEnd().split('\n')) {
      console.error(`\x1b[33m${pad(lab.name, 6)}\x1b[0m ${line}`);
    }
  });
  child.on('exit', (code) => {
    console.log(`${pad(lab.name, 6)} exited (code ${code})`);
  });
}