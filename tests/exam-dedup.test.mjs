import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, 'inline application script not found');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: '',
      innerHTML: '',
      checked: false,
      reset() {
        for (const item of elements.values()) item.value = '';
      },
      select() {},
    });
  }
  return elements.get(id);
}

const context = {
  console,
  document: {
    getElementById: element,
    querySelector(selector) {
      return selector.includes(':checked') ? { value: 'ni' } : null;
    },
    querySelectorAll() {
      return [];
    },
    execCommand() {
      return true;
    },
  },
  navigator: { clipboard: { writeText: async () => {} } },
  alert() {},
  confirm() {
    return true;
  },
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'index-inline.js' });

test('deduplicates repeated findings and preserves canonical system order', () => {
  element('alteracoesExame').value = [
    'SCV: sopro sistólico',
    'SR: sibilos difusos',
    'SCV: SOPRO   SISTÓLICO.;',
    'SCV: ritmo irregular',
    'achado inespecífico',
    'ACHADO   INESPECÍFICO.',
  ].join('\n');

  const report = vm.runInContext('gerarTextoCompleto()', context);

  assert.equal((report.match(/Sopro\s+sistólico/gi) || []).length, 1);
  assert.equal((report.match(/Achado\s+inespecífico/gi) || []).length, 1);
  assert.match(report, /- SCV: Sopro sistólico\. Ritmo irregular\./);
  assert.ok(report.indexOf('- SR:') < report.indexOf('- SCV:'));
  assert.doesNotMatch(report, /Ritmo cardíaco regular, em dois tempos/);
  assert.doesNotMatch(report, /Tórax simétrico, com boa expansibilidade bilateral/);
});
