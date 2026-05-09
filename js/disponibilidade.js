// ===============================
// 📁 disponibilidade.js
// ===============================
import { db } from './firebase.js';
import { state } from './state.js';
import { hhmmToMin, gerarSlotsDoDia, intervalosConflitam } from './utils.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getReservasIntervalosByDate(colecao, ymd) {
  const col = (colecao || '').trim();
  if (!col) return [];

  const q = query(collection(db, col), where("data", "==", ymd));
  const snap = await getDocs(q);
  const items = [];

  snap.forEach((d) => {
    const row = d.data() || {};
    const h = row.hora;
    if (!h) return;

    const tempo = Number(row.servicoTempoMin ?? row.tempoMin ?? row.duracaoMin);
    const dur = Number.isFinite(tempo) && tempo > 0 ? tempo : 30;
    const ini = hhmmToMin(h);

    items.push({
      ini,
      fim: ini + dur
    });
  });

  return items;
}

export async function preencherHorasDisponiveis() {

  const dataInput = document.getElementById('data');
  const horaSelect = document.getElementById('hora');

  if (!dataInput || !horaSelect) return;

  const ymd = dataInput.value;
  const col = state.ctx?.colecao;
  const dur = Number(state.agendamento?.servico?.tempoMin) || 30;
  const passo = state.stepMin || 30;

  horaSelect.innerHTML = `<option value="">Selecione um horário</option>`;

  if (!ymd) {
    horaSelect.disabled = true;
    horaSelect.innerHTML = `<option value="">Selecione a data primeiro</option>`;
    return;
  }

  if (!col) {
    horaSelect.disabled = true;
    horaSelect.innerHTML = `<option value="">Profissional não definido</option>`;
    return;
  }

  if (!state.agendamento?.servico) {
    horaSelect.disabled = true;
    horaSelect.innerHTML = `<option value="">Selecione o serviço para ver os horários</option>`;
    return;
  }

  const inicio = state.horarioFuncionamento?.inicio || '09:00';
  const fim = state.ctx?.fimExpediente || state.horarioFuncionamento?.fim || '18:30';

  const lista = gerarSlotsDoDia(inicio, fim, passo, dur);

  horaSelect.innerHTML = `
  <option value="">Carregando horários...</option>`;

  horaSelect.disabled = true;

  horaSelect.disabled = false;

  horaSelect.innerHTML =
    `<option value="">Selecione um horário</option>` +
    lista.map(h => `<option value="${h}">${h}</option>`).join('');

  try {
    const reservas = await getReservasIntervalosByDate(col, ymd);

    for (const opt of horaSelect.options) {
      const val = opt.value;
      if (!val) continue;

      const ini = hhmmToMin(val);
      const fimSlot = ini + dur;

      const ocupado = reservas.some(r => intervalosConflitam(ini, fimSlot, r.ini, r.fim));
      opt.disabled = ocupado;

      if (ocupado) {
        opt.classList.add('reservado');
      } else {
        opt.classList.remove('reservado');
      }
    }
  } catch (e) {
    console.error('[DISPONIBILIDADE]', e);
    alert('Não foi possível consultar os horários.');
  }
}
