const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ageContext = $('#age-context');
const rangeTitle = $('#range-title');
const rangeCopy = $('#range-copy');

const ageGroups = [
  { max: 1, title: 'Lactente jovem', copy: 'Observe alimentação, diurese, fontanela, tônus e sinais de desconforto respiratório.', months: true },
  { max: 24, title: 'Lactente', copy: 'Inclua marcos do desenvolvimento, aleitamento/alimentação, sono e vacinação.', months: true },
  { max: 60, title: 'Pré-escolar', copy: 'Considere desenvolvimento, comportamento, frequência escolar e contexto familiar.', months: true },
  { max: 144, title: 'Escolar', copy: 'Investigue desempenho escolar, hábitos, sono, atividade física e queixas específicas.', months: false },
  { max: Infinity, title: 'Adolescente', copy: 'Garanta privacidade progressiva e aborde saúde mental, hábitos e sexualidade com acolhimento.', months: false }
];

function getAgeInMonths() {
  const value = Number($('#patient-age').value);
  if (!Number.isFinite(value) || value < 0) return null;
  return $('#age-unit').value === 'years' ? value * 12 : value;
}

function updateAgeContext() {
  const months = getAgeInMonths();
  if (months === null) {
    ageContext.lastElementChild.textContent = 'Informe a idade para adaptar o roteiro.';
    rangeTitle.textContent = 'Idade não informada';
    rangeCopy.textContent = 'Preencha a idade para visualizar lembretes de faixas etárias.';
    return;
  }
  const group = ageGroups.find((item) => months <= item.max);
  ageContext.lastElementChild.textContent = `${group.title}: ${group.copy}`;
  rangeTitle.textContent = group.title;
  rangeCopy.textContent = group.copy;
}

function updateProgress() {
  const historyFields = ['#chief-complaint', '#illness-history', '#background', '#medications'];
  const filled = historyFields.filter((id) => $(id).value.trim()).length;
  $('#history-progress').textContent = `${filled} de 4 preenchidos`;
  const checked = $$('#exam-checklist input:checked').length;
  $('#exam-progress').textContent = `${checked} de 6 itens`;
}

function updateHematocrit() {
  const hb = Number($('#hemoglobin').value);
  $('#hematocrit-result').textContent = hb > 0 ? `Ht estimado: ${(hb * 3).toFixed(1)}%` : 'Informe a Hb para estimar.';
}

function selected(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || 'Não informado';
}

function makeSummary() {
  const name = $('#patient-name').value.trim() || 'Paciente não identificado';
  const age = $('#patient-age').value ? `${$('#patient-age').value} ${$('#age-unit').value === 'years' ? 'ano(s)' : 'mês(es)'}` : 'idade não informada';
  const vitals = [
    ['T', $('#temperature').value && `${$('#temperature').value} °C`],
    ['FC', $('#heart-rate').value && `${$('#heart-rate').value} bpm`],
    ['FR', $('#respiratory-rate').value && `${$('#respiratory-rate').value} irpm`],
    ['SpO₂', $('#oxygen').value && `${$('#oxygen').value}%`],
    ['Peso', $('#weight').value && `${$('#weight').value} kg`],
    ['HGT', $('#glucose').value && `${$('#glucose').value} mg/dL`]
  ].filter((item) => item[1]).map((item) => `${item[0]} ${item[1]}`).join(' · ') || 'não registrados';
  const assessed = $$('#exam-checklist input:checked').map((input) => input.dataset.label).join(', ') || 'nenhum item marcado';
  const summary = [
    `CONSULTA PEDIÁTRICA — ${name}`,
    `Idade: ${age}`,
    '',
    `QUEIXA PRINCIPAL: ${$('#chief-complaint').value.trim() || 'não registrada'}`,
    `HDA: ${$('#illness-history').value.trim() || 'não registrada'}`,
    `ANTECEDENTES: ${$('#background').value.trim() || 'não registrados'}`,
    `MEDICAMENTOS/ALERGIAS: ${$('#medications').value.trim() || 'não registrados'}`,
    `VACINAÇÃO: ${selected('vaccination')} · LÍQUIDOS: ${selected('hydration')}`,
    '',
    `SINAIS VITAIS: ${vitals}`,
    `ITENS AVALIADOS: ${assessed}`,
    `ACHADOS: ${$('#exam-notes').value.trim() || 'não registrados'}`
  ].join('\n');
  $('#summary-output').textContent = summary;
  $('#copy-button').disabled = false;
}

$('#patient-age').addEventListener('input', updateAgeContext);
$('#age-unit').addEventListener('change', updateAgeContext);
$$('textarea, input[type="number"], input[type="text"], input[type="radio"], input[type="checkbox"]').forEach((element) => {
  element.addEventListener('input', updateProgress);
  element.addEventListener('change', updateProgress);
});
$('#hemoglobin').addEventListener('input', updateHematocrit);
$('#summary-button').addEventListener('click', makeSummary);
$('#copy-button').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#summary-output').textContent);
  $('#copy-button').textContent = 'Resumo copiado ✓';
  setTimeout(() => { $('#copy-button').textContent = 'Copiar resumo'; }, 1800);
});
$('#clear-button').addEventListener('click', () => {
  if (!window.confirm('Limpar todos os dados desta consulta?')) return;
  $$('input, textarea').forEach((input) => {
    if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
    else input.value = '';
  });
  $('#age-unit').value = 'months';
  $('#copy-button').disabled = true;
  $('#summary-output').textContent = 'O resumo aparecerá aqui.';
  updateAgeContext();
  updateProgress();
  updateHematocrit();
});
updateAgeContext();
updateProgress();
