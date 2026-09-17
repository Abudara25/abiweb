import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ignore from 'ignore';

const excluded = ignore().add([
  '/.assetsignore', '/_headers', '/_redirects',
  ...readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8').split('\n'),
]);

test('seuls les fichiers publics sont inclus, meme avec des secrets locaux', () => {
  for (const file of [
    '.dev.vars', '.dev.vars.preview', '.env', '.env.production', '.git/config',
    '.claude/skills/private/SKILL.md', '.vscode/settings.json', 'CLAUDE.md',
    'client-template/status.json', 'client-template/update-status.yml',
    'functions/api/send-brief.js', '_worker.js', 'scripts/check.mjs',
    'suivi-abiweb/README.md', 'suivi-abiweb/vercel.json', 'new-secret.txt',
    'js/.env', 'images/.private/key', 'js/home.js.map', 'js/example.test.js',
    '_headers', '_redirects',
  ]) assert.equal(excluded.ignores(file), true, file);
  for (const file of [
    'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'llms.txt',
    'devis/index.html', 'cgv/index.html', 'mentions-legales/index.html',
    'politique-de-confidentialite/index.html', 'demos/commerce/index.html', 'demos/shared.css',
    'suivi-abiweb/index.html', 'suivi-abiweb/script.js', 'suivi-abiweb/style.css',
    'js/home.js', 'js/pricing-catalogue.js', 'js/vendor/gsap.min.js',
    'css/shared.css', 'fonts/inter-var.woff2', 'images/logo/abiweb-logo.svg',
  ]) assert.equal(excluded.ignores(file), false, file);
});
