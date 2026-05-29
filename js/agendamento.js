import { state } from './state.js';
import { db } from './firebase.js';
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const toKey = (ymd, hhmm) => `${ymd}_${hhmm}`;

export async function confirmarAgendamento(data, hora) {
  if (!data) throw new Error("Selecione a data.");
  if (!hora) throw new Error("Selecione o horário.");

  const ctx = state.ctx;
  const ag = state.agendamento;

  if (!ctx.colecao) throw new Error("Profissional não definido.");

  const ref = doc(db, ctx.colecao, toKey(data, hora));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists()) {
      throw new Error("Horário já reservado.");
    }

    const payload = {
      data,
      hora,
      profissional: ctx.profissionalId || null,
      profissionalNome: ctx.profissionalNome || null,

      clienteNome: ag.nomeCliente,
      clienteSobrenome: ag.sobrenomeCliente,
      clienteTelefone: ag.telefoneCliente,

      servicoNome: ag.servico?.nome || null,
      servicoValor: ag.servico?.valor ?? null,
      servicoTempoMin: ag.servico?.tempoMin ?? 30,

      grupoOperacional:
        ag.servico?.grupoOperacional || null,

      raclub: ag.raclub || { status: 'nao' },
      createdAt: serverTimestamp()
    };

    tx.set(ref, payload);
  });
}