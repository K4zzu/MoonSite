// Copies the generated NASA data (ephemerides, LOLA horizons, textures) from ../lunar-data/public into public/,
// so the files live in one place in git. Runs before dev, build and test. Skips quietly when ../lunar-data is absent
// (for example when only this folder is deployed) as long as public/ already has the files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../lunar-data/public'), dst = path.resolve(here, '../public');
let copied = 0, kept = 0;
for (const dir of ['data', 'textures']) {
  const from = path.join(src, dir), to = path.join(dst, dir);
  if (!fs.existsSync(from)) {
    if (!fs.existsSync(to)) { console.error(`sync-data: missing ${from} and ${to}`); process.exit(1); }
    continue;
  }
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f), sa = fs.statSync(a);
    if (!sa.isFile()) continue;
    if (fs.existsSync(b)) { const sb = fs.statSync(b); if (sb.size === sa.size && sb.mtimeMs >= sa.mtimeMs) { kept++; continue; } }
    fs.copyFileSync(a, b); copied++;
  }
}
console.log(`sync-data: ${copied} copied, ${kept} up to date`);
