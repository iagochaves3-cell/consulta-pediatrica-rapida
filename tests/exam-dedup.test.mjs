import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, 'inline application script not found');

const elements = new Map();
const selectedRadios = new Map();
const clipboardWrites = [];
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
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
      if (!selector.includes(':checked')) return null;
      const name = selector.match(/name="([^"]+)"/)?.[1];
      return { value: selectedRadios.get(name) || 'ni' };
    },
    querySelectorAll() {
      return [];
    },
    execCommand() {
      return true;
    },
  },
  navigator: { clipboard: { writeText: async (text) => clipboardWrites.push(text) } },
  alert() {},
  confirm() {
    return true;
  },
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'index-inline.js' });

function setRadio(name, value) {
  selectedRadios.set(name, value);
}

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

test('identification output contains only requested clinical details', () => {
  element('nomePaciente').value = 'Ana';
  element('idadePaciente').value = '4 anos';
  element('peso').value = '15 kg';
  element('alergias').value = 'nega';
  element('comorbidades').value = 'asma';
  element('medContinuas').value = 'salbutamol';
  element('doencasFamiliares').value = 'diabetes';
  element('doencasHpp').value = 'pneumonia prévia';
  setRadio('historicoFamiliar', 'sim');
  setRadio('historicoPessoal', 'nao');

  const text = vm.runInContext('gerarIdentificacao()', context);

  assert.match(text, /Peso: 15 kg/);
  assert.match(text, /Alergias: nega/);
  assert.match(text, /Na história familiar, há diabetes/);
  assert.match(text, /Na história patológica pregressa, consta pneumonia prévia/);
  assert.doesNotMatch(text, /Ana|4 anos/);
});

test('item 2–12 narrative omits N/I and phrases the separate symptoms naturally', () => {
  element('queixa').value = 'tosse';
  element('diasSintomas').value = '2 dias';
  element('localizaDor').value = 'abdome';
  element('tempoSemEvacuar').value = '3 dias';
  setRadio('febre', 'nao');
  setRadio('dor', 'sim');
  setRadio('gemencia', 'ni');
  setRadio('choroPersistente', 'nao');
  setRadio('constipacao', 'sim');

  const text = vm.runInContext('gerarAnamneseNarrativa()', context);

  assert.match(text, /Acompanhante nega febre/);
  assert.match(text, /Apresenta dor localizada em abdome/);
  assert.match(text, /Acompanhante nega choro persistente/);
  assert.match(text, /sem evacuar há 3 dias/);
  assert.doesNotMatch(text, /N\/I|dor, gemência ou choro persistente|febre:\s*nega/);
});

test('generation fills four independent outputs with replacement exam and spaced conduct', () => {
  element('peso').value = '15 kg';
  element('queixa').value = 'tosse';
  element('alteracoesExame').value = 'SR: sibilos difusos';
  element('hipoteses').value = 'IVAS';
  element('condutas').value = '- Orientações e retorno se sinais de alarme.';

  vm.runInContext('gerarTextoCompleto()', context);

  assert.match(element('textoIdentificacao').value, /Peso: 15 kg/);
  assert.match(element('textoAnamnese').value, /Criança comparece ao PA por tosse/);
  assert.match(element('textoExame').value, /- SR: Sibilos difusos\./);
  assert.doesNotMatch(element('textoExame').value, /Murmúrio vesicular fisiológico/);
  assert.equal(element('textoHipotesesCondutas').value, 'IVAS\n\n\n- Orientações e retorno se sinais de alarme.');
  assert.match(html, /id="textoIdentificacao"/);
  assert.match(html, /id="textoAnamnese"/);
  assert.match(html, /id="textoExame"/);
  assert.match(html, /id="textoHipotesesCondutas"/);
});

test('copy action copies the selected output textarea', async () => {
  element('textoExame').value = 'Exame físico';

  await vm.runInContext("copiarCaixa('textoExame', 'statusExame')", context);

  assert.equal(clipboardWrites.at(-1), 'Exame físico');
  assert.equal(element('statusExame').textContent, 'Texto copiado.');
});

test('compact layout is restricted to the nine requested sections', () => {
  const sections = [...html.matchAll(/<details class="([^"]+)"[^>]*>\s*<summary><span class="num">(\d+)<\/span>/g)];
  assert.equal(sections.length, 14);
  assert.deepEqual(
    sections.filter(([, classes]) => classes.split(' ').includes('compact')).map(([, , number]) => Number(number)),
    [1, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});

test('acceptance renders two independent general-state fields defaulting to N/I', () => {
  const markup = element('aceitacao').innerHTML;
  assert.equal((markup.match(/class="ttl">Estado geral\?/g) || []).length, 2);
  for (const name of ['estadoClinico', 'estadoIrritabilidade']) {
    assert.equal((markup.match(new RegExp(`name="${name}"`, 'g')) || []).length, 3);
    assert.match(markup, new RegExp(`name="${name}" value="ni" checked`));
  }
  assert.match(markup, /name="estadoClinico" value="nao"> Prostração/);
  assert.match(markup, /name="estadoIrritabilidade" value="nao"> Irritabilidade/);
});

test('prostration and irritability are reported independently for every response combination', () => {
  selectedRadios.clear();
  for (const item of elements.values()) item.value = '';
  const cases = [
    ['ni', 'ni', ''],
    ['sim', 'ni', 'Estado geral preservado.'],
    ['nao', 'ni', 'Prostração.'],
    ['ni', 'sim', 'Sem irritabilidade.'],
    ['ni', 'nao', 'Irritabilidade.'],
    ['sim', 'sim', 'Estado geral preservado.'],
    ['sim', 'nao', 'Irritabilidade, sem prostração.'],
    ['nao', 'sim', 'Prostração e sem irritabilidade.'],
    ['nao', 'nao', 'Prostração e irritabilidade.'],
  ];
  for (const [prostration, irritability, expected] of cases) {
    setRadio('estadoClinico', prostration);
    setRadio('estadoIrritabilidade', irritability);
    assert.equal(vm.runInContext('gerarAnamneseNarrativa()', context), expected);
  }
  selectedRadios.clear();
});
