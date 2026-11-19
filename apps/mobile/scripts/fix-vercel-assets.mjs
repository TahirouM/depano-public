// Vercel n'envoie jamais les dossiers `node_modules` ni les dossiers cachés (`.pnpm`) au déploiement : les assets qu'Expo exporte sous
// assets/__node_modules/.pnpm/…/node_modules/… (icône retour de React Navigation, polices Inter…)
// tombent alors sur la rewrite SPA et reçoivent index.html → boutons retour invisibles, police de secours.
// On renomme ces segments (`_nm`, `.pnpm` → `_pnpm`) dans l'arborescence et dans les URL du bundle.
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist-vercel';
const rename = (name) => (name === 'node_modules' || name === '__node_modules' ? '_nm' : name.startsWith('.') ? `_${name.slice(1)}` : name);

function renameDirs(dir) {
  for (const name of readdirSync(dir)) {
    let path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (rename(name) !== name) {
      const next = join(dir, rename(name));
      renameSync(path, next);
      path = next;
    }
    renameDirs(path);
  }
}

function rewriteUrls(dir) {
  let count = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) count += rewriteUrls(path);
    else if (/\.(js|html|css|json|map)$/.test(name)) {
      const src = readFileSync(path, 'utf8');
      // Uniquement les URL d'assets (/assets/… ), pas le reste du code.
      const out = src.replace(/\/assets\/[^"'`)\s]*/g, (url) => url.replace(/\/(?:__)?node_modules\//g, '/_nm/').replace(/\/\.(?=[^/.])/g, '/_'));
      if (out !== src) { writeFileSync(path, out); count++; }
    }
  }
  return count;
}

renameDirs(join(root, 'assets'));
console.log(`fix-vercel-assets: ${rewriteUrls(root)} fichier(s) réécrit(s)`);
