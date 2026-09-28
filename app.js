const form = document.querySelector("#exam-form");
const report = document.querySelector("#report");
const copyStatus = document.querySelector("#copy-status");

const fields = [
  ["patient-name", "Nome"],
  ["patient-age", "Idade"],
  ["exam-date", "Data do atendimento", formatDate],
  ["temperature", "Temperatura", (value) => `${value} °C`],
  ["heart-rate", "Frequência cardíaca", (value) => `${value} bpm`],
  ["respiratory-rate", "Frequência respiratória", (value) => `${value} irpm`],
  ["oxygen-saturation", "Saturação de O₂", (value) => `${value}%`],
  ["weight", "Peso", (value) => `${value} kg`],
  ["height", "Estatura", (value) => `${value} cm`],
];

const examinationFields = [
  ["general", "Estado geral"],
  ["skin", "Pele e mucosas"],
  ["cardiovascular", "Cardiovascular"],
  ["respiratory", "Respiratório"],
  ["abdomen", "Abdome"],
  ["neurological", "Neurológico"],
  ["other-findings", "Outros achados"],
];

const normalTemplate = {
  general: "Bom estado geral, alerta, ativo e reativo.",
  skin: "Corado, hidratado, acianótico e anictérico.",
  cardiovascular: "Ritmo regular, bulhas normofonéticas, sem sopros.",
  respiratory: "Eupneico, murmúrio vesicular presente bilateralmente, sem ruídos adventícios.",
  abdomen: "Plano, flácido, indolor à palpação, sem visceromegalias.",
  neurological: "Alerta, interativo, sem déficits focais aparentes.",
};

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function generateReport() {
  const identity = fields
    .slice(0, 3)
    .map(([id, label, format]) => {
      const value = getValue(id);
      return value ? `${label}: ${format ? format(value) : value}` : "";
    })
    .filter(Boolean);

  const vitals = fields
    .slice(3)
    .map(([id, label, format]) => {
      const value = getValue(id);
      return value ? `${label}: ${format(value)}` : "";
    })
    .filter(Boolean);

  const examination = examinationFields
    .map(([id, label]) => {
      const value = getValue(id);
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);

  const sections = [];
  if (identity.length) sections.push(identity.join(" · "));
  if (vitals.length) sections.push(`Sinais vitais: ${vitals.join(" | ")}`);
  if (examination.length) sections.push(`Exame físico\n${examination.join("\n")}`);

  if (!sections.length) {
    report.innerHTML = '<p class="empty-state">Preencha os campos ao lado para começar a montar o texto do exame.</p>';
    return "";
  }

  const text = sections.join("\n\n");
  report.textContent = text;
  return text;
}

form.addEventListener("input", () => {
  copyStatus.textContent = "";
  generateReport();
});

document.querySelector("#normal-template").addEventListener("click", () => {
  for (const [id, value] of Object.entries(normalTemplate)) {
    document.getElementById(id).value = value;
  }
  copyStatus.textContent = "";
  generateReport();
});

document.querySelector("#copy-report").addEventListener("click", async () => {
  const text = generateReport();
  if (!text) {
    copyStatus.textContent = "Preencha ao menos um campo para copiar.";
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = "Texto copiado.";
  } catch {
    copyStatus.textContent = "Não foi possível copiar automaticamente. Selecione e copie o texto.";
  }
});

document.querySelector("#print-report").addEventListener("click", () => {
  if (!generateReport()) {
    copyStatus.textContent = "Preencha ao menos um campo para imprimir.";
    return;
  }
  window.print();
});

document.querySelector("#clear-form").addEventListener("click", () => {
  form.reset();
  copyStatus.textContent = "";
  generateReport();
});
