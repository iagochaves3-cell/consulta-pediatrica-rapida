import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const publicFiles = [
  '.nojekyll', 'index.html', 'app.js', 'styles.css',
  'pedwb/index.html', 'pedwb/PedWB_Consolidado.md',
];

function runBlock(workflow, name) {
  const step = workflow.split(`- name: ${name}\n`)[1]?.split(/\n\s*- name:/)[0];
  const block = step?.split('run: |\n')[1];
  assert.ok(block, `${name} script not found`);
  return block.replace(/^          /gm, '');
}

for (const name of ['pages.yml', 'publicar-pages-manualmente.yml']) {
  const workflow = fs.readFileSync(new URL(`.github/workflows/${name}`, root), 'utf8');

  test(`${name} configures GitHub Actions as the Pages build source`, () => {
    const stepName = name === 'pages.yml' ? 'Configure Pages source' : 'Configurar origem do GitHub Pages';
    const configure = runBlock(workflow, stepName);
    assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.ok(workflow.indexOf('actions/configure-pages@v5') < workflow.indexOf(stepName));
    assert.ok(workflow.indexOf(stepName) < workflow.indexOf('Build site'));
    const result = spawnSync('bash', ['-e', '-c', `
      gh() { printf '%s\\n' "$*"; }
      ${configure}
    `], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_REPOSITORY: 'owner/site' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'api --method PUT repos/owner/site/pages -f build_type=workflow\n');
  });

  test(`${name} builds only public files and removes stale dist content`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-build-'));
    try {
      for (const file of publicFiles) {
        const destination = path.join(directory, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(new URL(file, root), destination);
      }
      fs.mkdirSync(path.join(directory, 'dist'));
      fs.writeFileSync(path.join(directory, 'dist', 'stale.txt'), 'old build');
      fs.writeFileSync(path.join(directory, 'private.docx'), 'not public');
      const result = spawnSync('bash', ['-e', '-c', runBlock(workflow, 'Build site')], {
        cwd: directory, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      const files = fs.readdirSync(path.join(directory, 'dist'), { recursive: true })
        .filter(file => fs.statSync(path.join(directory, 'dist', file)).isFile());
      assert.deepEqual(files.sort(), [...publicFiles].sort());
      for (const file of publicFiles) {
        assert.deepEqual(fs.readFileSync(path.join(directory, 'dist', file)), fs.readFileSync(new URL(file, root)));
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test(`${name} cleans only Pages artifacts from the current run before upload`, () => {
    const cleanup = runBlock(workflow, 'Clean previous Pages artifacts');
    assert.match(workflow, /actions: write/);
    assert.match(workflow, /GH_TOKEN: \$\{\{ github.token \}\}/);
    assert.match(cleanup, /--paginate/);
    assert.match(cleanup, /select\(\.name == "github-pages"\)/);
    assert.match(cleanup, /actions\/runs\/\$GITHUB_RUN_ID\/artifacts/);
    assert.ok(workflow.indexOf('Clean previous Pages artifacts') < workflow.indexOf('uses: actions/upload-pages-artifact'));
    assert.match(workflow, /uses: actions\/upload-pages-artifact@v3\n\s+with:\n\s+path: dist\n\s+retention-days: 1/);
    for (const ids of ['', '101\n102\n103\n104']) {
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `
        gh() {
          if [ "$2" = "--paginate" ]; then
            printf '%s' "$ARTIFACT_IDS"
          else
            printf '%s\\n' "$*"
          fi
        }
        ${cleanup}
      `], {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_REPOSITORY: 'owner/site', GITHUB_RUN_ID: '42', ARTIFACT_IDS: ids },
      });
      assert.equal(result.status, 0, result.stderr);
      const expected = ids ? ids.split('\n').map(id => `api --method DELETE repos/owner/site/actions/artifacts/${id}\n`).join('') : '';
      assert.equal(result.stdout, expected);
    }
    const failedListing = spawnSync('bash', ['-e', '-c', `
      gh() { return 1; }
      ${cleanup}
    `], { encoding: 'utf8' });
    assert.notEqual(failedListing.status, 0, 'failed cleanup must stop the upload');
  });
}

test('automatic publication still runs on pushes to principal', () => {
  const workflow = fs.readFileSync(new URL('.github/workflows/pages.yml', root), 'utf8');
  assert.match(workflow, /push:\n\s+branches: \["principal"\]/);
});
