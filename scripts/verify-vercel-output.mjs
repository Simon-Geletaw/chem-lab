import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = resolve(ROOT, 'public');
const routes = ['c', 'b', 'm', 'p'];
const failures = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const route of routes) {
  const htmlPath = resolve(publicDir, route, 'index.html');
  if (!(await exists(htmlPath))) {
    failures.push(`missing ${route}/index.html`);
    continue;
  }

  const html = await readFile(htmlPath, 'utf8');
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)]
    .map(([, path]) => path)
    .filter((path) => path.startsWith(`/${route}/`));

  for (const assetPath of assetPaths) {
    const localPath = resolve(publicDir, assetPath.slice(1));
    if (!(await exists(localPath))) failures.push(`missing ${assetPath}`);
  }

  console.log(`verified /${route}/ (${assetPaths.length} route-prefixed assets)`);
}

if (!(await exists(resolve(publicDir, 'index.html')))) {
  failures.push('missing root index.html');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('vercel output verification passed');
