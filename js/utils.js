// ===============================
// 📁 utils.js
// ===============================
export const hhmmToMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
};

export const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function gerarSlotsDoDia(inicioHHMM, fimHHMM, passoMin, duracaoMin) {
  const ini = hhmmToMin(inicioHHMM);
  const fim = hhmmToMin(fimHHMM);
  const ultimoInicio = fim - duracaoMin;
  const out = [];

  for (let t = ini; t <= ultimoInicio; t += passoMin) {
    out.push(minToHHMM(t));
  }

  return out;
}

export function intervalosConflitam(aIni, aFim, bIni, bFim) {
  return aIni < bFim && bIni < aFim;
}
