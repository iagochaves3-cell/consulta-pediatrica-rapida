import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const outputs = ['textoIdentificacao', 'textoAnamnese', 'textoExame', 'textoHipotesesCondutas'];

function setup() {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    value: '', innerHTML: '', textContent: '', checked: false,
    select() { selected.push(id); },
  }]));
  const radios = new Map();
  const writes = [];
  const selected = [];
  const dialog = elements.get('demonstracaoHigida');
  Object.assign(dialog, {
    open: false,
    showModal() { assert.equal(this.open, false); this.open = true; },
    close() { this.open = false; },
  });
  elements.get('formulario').reset = () => {
    throw new Error('Opening an example must never reset clinical data');
  };
  const context = vm.createContext({
    document: {
      getElementById: id => elements.get(id),
      querySelector(selector) {
        const name = selector.match(/name="([^"]+)"/)?.[1];
        if (selector.includes(':checked')) return { value: radios.get(name) || 'ni' };
        const value = selector.match(/value="([^"]+)"/)?.[1];
        return { set checked(checked) { if (checked) radios.set(name, value); } };
      },
      querySelectorAll: () => [],
      execCommand(command) { assert.equal(command, 'copy'); return true; },
    },
    navigator: { clipboard: { writeText: async text => writes.push(text) } },
  });
  vm.runInContext(script, context);
  const run = code => vm.runInContext(code, context);
  const snapshot = () => JSON.stringify({
    elements: [...elements].filter(([id]) => id !== 'demonstracaoHigida'),
    radios: [...radios],
  });
  return { elements, radios, writes, selected, dialog, context, run, snapshot };
}

test('demo is explicitly labelled, outside the clinical form and has no export controls', () => {
  assert.match(html, /aria-controls="demonstracaoHigida">Ver demonstração \(dados fictícios\)/);
  const dialog = html.match(/<dialog\b[\s\S]*?<\/dialog>/)[0];
  assert.ok(html.indexOf('</form>') < html.indexOf('<dialog'));
  assert.match(dialog, /aria-labelledby="tituloDemonstracao"/);
  assert.match(dialog, /aria-describedby="avisoDemonstracao"/);
  const examples = [...dialog.matchAll(/<pre>([\s\S]*?)<\/pre>/g)];
  assert.equal(examples.length, 4);
  for (const [, text] of examples) assert.ok(text.startsWith('EXEMPLO FICTÍCIO — NÃO USAR EM PRONTUÁRIO.'));
  assert.doesNotMatch(dialog, /<(?:input|textarea|select|form)\b|copiarCaixa|gerarTextoCompleto/);
  assert.doesNotMatch(html, /teve pneumonia ano passado/);
});

test('opening and closing demo leaves an empty clinical form and outputs untouched', () => {
  const app = setup();
  const before = app.snapshot();
  app.run('preencherHigida()');
  assert.equal(app.dialog.open, true);
  assert.equal(app.snapshot(), before);
  app.run('fecharDemonstracao()');
  assert.equal(app.dialog.open, false);
  assert.equal(app.snapshot(), before);
  assert.equal(app.run('gerarIdentificacao()'), '');
  assert.equal(app.run('gerarAnamneseNarrativa()'), '');
});

test('demo preserves all existing input values, responses, edited outputs and copy status', () => {
  const app = setup();
  for (const [id, element] of app.elements) {
    if (id !== 'demonstracaoHigida') {
      element.value = `Conteúdo informado: ${id}`;
      element.textContent = `Estado anterior: ${id}`;
    }
  }
  app.radios.set('febre', 'sim');
  app.radios.set('historicoPessoal', 'ni');
  app.radios.set('historicoFamiliar', 'nao');
  const before = app.snapshot();
  for (let i = 0; i < 3; i++) {
    app.run('preencherHigida(); preencherHigida(); fecharDemonstracao()');
    assert.equal(app.snapshot(), before);
  }
});

test('generation after demo uses actual entered history and preserves the four output sections', () => {
  const app = setup();
  const values = {
    peso: '21 kg', alergias: 'amoxicilina', comorbidades: 'asma',
    queixa: 'dor no ouvido direito', doencasHpp: 'internação por bronquiolite em 2025',
    alteracoesExame: 'Otoscopia: membrana timpânica direita abaulada',
    hipoteses: 'Otite média aguda', condutas: 'Conduta registrada pelo profissional.',
  };
  for (const [id, value] of Object.entries(values)) app.elements.get(id).value = value;
  app.radios.set('febre', 'sim');
  const original = app.run('gerarTextoCompleto()');
  app.run('preencherHigida(); fecharDemonstracao()');
  const regenerated = app.run('gerarTextoCompleto()');
  assert.equal(regenerated, original);
  assert.match(app.elements.get(outputs[0]).value, /21 kg.*amoxicilina.*asma/);
  assert.match(app.elements.get(outputs[0]).value, /bronquiolite em 2025/);
  assert.match(app.elements.get(outputs[1]).value, /dor no ouvido direito/);
  assert.match(app.elements.get(outputs[2]).value, /Membrana timpânica direita abaulada/);
  assert.doesNotMatch(app.elements.get(outputs[2]).value, /Membranas timpânicas íntegras/);
  assert.equal(app.elements.get(outputs[3]).value, values.hipoteses + '\n\n\n' + values.condutas);
  assert.doesNotMatch(regenerated, /15 kg|pneumonia|consulta de rotina|EXEMPLO FICTÍCIO/);
});

test('demo never changes what each clinical copy button writes to the clipboard', async () => {
  const app = setup();
  app.run('preencherHigida(); fecharDemonstracao()');
  for (const id of outputs) {
    app.elements.get(id).value = `Texto revisado pelo profissional: ${id}`;
    await app.run(`copiarCaixa('${id}', 'statusAnamnese')`);
    assert.equal(app.writes.at(-1), app.elements.get(id).value);
    assert.equal(app.elements.get('statusAnamnese').textContent, 'Texto copiado.');
  }
  assert.equal(app.writes.length, 4);
});

test('empty output stays uncopyable after demo and clipboard fallback selects only clinical output', async () => {
  const app = setup();
  app.run('preencherHigida(); fecharDemonstracao()');
  await app.run("copiarCaixa('textoAnamnese', 'statusAnamnese')");
  assert.equal(app.writes.length, 0);
  assert.equal(app.elements.get('statusAnamnese').textContent, 'Gere ou preencha o texto antes de copiar.');
  app.context.navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable'); };
  app.elements.get('textoAnamnese').value = 'História revisada.';
  await app.run("copiarCaixa('textoAnamnese', 'statusAnamnese')");
  assert.deepEqual(app.selected, ['textoAnamnese']);
  assert.equal(app.elements.get('statusAnamnese').textContent, 'Texto copiado.');
});
