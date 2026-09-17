import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const workflow = readFileSync(new URL('../client-template/update-status.yml', import.meta.url), 'utf8').replaceAll('\r', '');
const windowsBash = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe');
const bash = process.platform === 'win32' ? windowsBash : 'bash';

test('le workflow accepte preview, exclut les branches sans transition et sérialise les écritures', () => {
  const branches = workflow.match(/    branches:\n([\s\S]*?)  workflow_dispatch:/)?.[1];
  assert.ok(branches);
  const patterns = [...branches.matchAll(/- '([^']+)'/g)].map((match) => match[1]);
  function accepts(branch) {
    let matched = false;
    for (const pattern of patterns) {
      const name = pattern.replace(/^!/, '');
      if (name === '**' || name === branch) matched = !pattern.startsWith('!');
    }
    return matched;
  }
  assert.equal(accepts('preview'), true);
  assert.equal(accepts('feature/site'), true);
  assert.equal(accepts('main'), false);
  assert.equal(accepts('project-status'), false);
  assert.match(workflow, /permissions:\n  contents: write\n/);
  assert.match(workflow, /concurrency:\n  group: abiweb-project-status\n  cancel-in-progress: false/);
  assert.match(workflow, /site_en_ligne:[\s\S]*?type: boolean\n        default: false/);
});

test('le workflow réel publie une branche de données commune et préserve les états avancés', {
  skip: process.platform === 'win32' && !existsSync(windowsBash) ? 'Git Bash nécessaire pour exécuter les étapes Linux du workflow' : false,
  timeout: 60000,
}, () => {
  const temporaryParent = path.resolve(tmpdir());
  const fixture = mkdtempSync(path.join(temporaryParent, 'abiweb-suivi-'));
  const gitEnvironment = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(fixture, 'empty-gitconfig') };
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: gitEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // Exécuter les commandes réellement livrées, pas une réécriture du workflow.
  const blocks = [...workflow.matchAll(/^        run: \|\n((?: {10}[^\n]*\n?)+)/gm)]
    .map((match) => match[1].split('\n').filter(Boolean).map((line) => line.slice(10)).join('\n'));
  const calculate = workflow.match(/^        run: (node [^\n]+)$/m)?.[1];
  assert.equal(blocks.length, 2);
  assert.ok(calculate);

  try {
    const remote = path.join(fixture, 'remote.git');
    const seed = path.join(fixture, 'seed');
    mkdirSync(seed);
    writeFileSync(gitEnvironment.GIT_CONFIG_GLOBAL, '');
    git(fixture, 'init', '--bare', '--initial-branch=main', remote);
    git(seed, 'init', '--initial-branch=main');
    git(seed, 'config', 'user.name', 'Test');
    git(seed, 'config', 'user.email', 'test@example.invalid');
    mkdirSync(path.join(seed, '.github', 'scripts'), { recursive: true });
    copyFileSync(new URL('../client-template/update-status.mjs', import.meta.url), path.join(seed, '.github', 'scripts', 'update-status.mjs'));
    const initial = { client: 'Client de test', etape: 'paiement_recu', avancement: 5, message: 'Acompte reçu.', derniere_maj: '2026-09-01' };
    writeFileSync(path.join(seed, 'status.json'), JSON.stringify(initial));
    writeFileSync(path.join(seed, 'index.html'), '<!doctype html><title>Site client</title>');
    git(seed, 'add', '.');
    git(seed, 'commit', '-m', 'Initialisation');
    git(seed, 'remote', 'add', 'origin', remote);
    git(seed, 'push', 'origin', 'main');
    const initialMain = git(remote, 'rev-parse', 'main');
    const published = () => JSON.parse(git(remote, 'show', 'project-status:status.json'));
    let runNumber = 0;

    function run(event, extra = {}) {
      const checkout = path.join(fixture, 'checkout-' + runNumber++);
      const runnerTemporary = path.join(fixture, 'runner-' + runNumber);
      mkdirSync(runnerTemporary);
      git(fixture, 'clone', '--branch', 'main', remote, checkout);
      const env = {
        ...gitEnvironment, RUNNER_TEMP: runnerTemporary.replaceAll('\\', '/'),
        STATUS_EVENT_NAME: event, STATUS_EVENT_REF: 'refs/heads/main',
        STATUS_REQUESTED_STEP: '', STATUS_SITE_IS_LIVE: 'false', STATUS_MESSAGE: '', ...extra,
      };
      for (const script of [blocks[0], calculate, blocks[1]]) {
        execFileSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
          cwd: checkout, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        });
      }
    }

    run('push', { STATUS_EVENT_REF: 'refs/heads/feature/home' });
    assert.equal(published().etape, 'developpement');
    assert.equal(published().avancement, 30);
    assert.equal(git(remote, 'ls-tree', '--name-only', 'project-status'), 'status.json');
    assert.equal(git(remote, 'rev-parse', 'main'), initialMain);
    assert.deepEqual(JSON.parse(git(remote, 'show', 'main:status.json')), initial);

    run('push', { STATUS_EVENT_REF: 'refs/heads/preview' });
    assert.equal(published().etape, 'preview');
    const message = 'Texte public littéral : $(touch unexpected-file) `whoami`';
    run('workflow_dispatch', { STATUS_REQUESTED_STEP: 'corrections', STATUS_MESSAGE: message });
    assert.equal(published().message, message);
    const correctionsCommit = git(remote, 'rev-parse', 'project-status');
    run('push', { STATUS_EVENT_REF: 'refs/heads/feature/footer' });
    assert.equal(git(remote, 'rev-parse', 'project-status'), correctionsCommit);

    assert.throws(() => run('workflow_dispatch', { STATUS_REQUESTED_STEP: 'mise_en_ligne' }), /Confirmer le déploiement/);
    assert.equal(git(remote, 'rev-parse', 'project-status'), correctionsCommit);
    run('workflow_dispatch', { STATUS_REQUESTED_STEP: 'mise_en_ligne', STATUS_SITE_IS_LIVE: 'true' });
    assert.equal(published().etape, 'mise_en_ligne');
    run('workflow_dispatch', { STATUS_REQUESTED_STEP: 'garantie_retouches', STATUS_SITE_IS_LIVE: 'true' });
    const guaranteeCommit = git(remote, 'rev-parse', 'project-status');
    run('workflow_dispatch', { STATUS_REQUESTED_STEP: 'mise_en_ligne', STATUS_SITE_IS_LIVE: 'true' });
    assert.equal(git(remote, 'rev-parse', 'project-status'), guaranteeCommit);
    assert.equal(published().etape, 'garantie_retouches');
    assert.equal(published().avancement, 100);
    assert.equal(git(remote, 'rev-parse', 'main'), initialMain);
  } finally {
    // Ne supprimer récursivement que le dossier temporaire créé par ce test.
    const resolved = path.resolve(fixture);
    if (path.dirname(resolved) !== temporaryParent || !path.basename(resolved).startsWith('abiweb-suivi-')) {
      throw new Error('Chemin de nettoyage inattendu : ' + resolved);
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});
