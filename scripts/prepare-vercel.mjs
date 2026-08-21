// Packages the independently built lab dist folders into one Vercel static output.
// The Vite apps already use /c/, /b/, /m/, and /p/ as their public bases, so
// their files must be copied into matching folders inside public/.
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT, 'public');
const labs = JSON.parse(await readFile(resolve(ROOT, 'labs.json'), 'utf8'));

await rm(PUBLIC_DIR, { recursive: true, force: true });
await mkdir(PUBLIC_DIR, { recursive: true });

for (const lab of labs) {
  const source = resolve(ROOT, lab.dir, 'dist');
  const route = String(lab.path || '/').replace(/^\/+|\/+$/g, '');
  const destination = resolve(PUBLIC_DIR, route);

  if (!existsSync(source)) {
    throw new Error(`Missing build output for ${lab.name}: ${source}`);
  }

  await cp(source, destination, { recursive: true, force: true });
  console.log(`vercel: copied ${lab.dir}/dist → public/${route}/`);
}

// The Chemistry Lab is the hub and owns the root route. Its HTML already
// references /c/ assets because chem-lab is built with /c/ as its Vite base.
await cp(
  resolve(ROOT, 'chem-lab', 'dist', 'index.html'),
  resolve(PUBLIC_DIR, 'index.html'),
  { force: true }
);
console.log('vercel: copied chem-lab/dist/index.html → public/index.html');
