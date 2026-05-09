// ===============================
// 📁 state.js
// ===============================
export const state = {
  ctx: {
    profissionalNome: null,
    profissionalId: null,
    profissionalDocId: null,
    wa: null,
    colecao: null,
    profKey: null,
    fimExpediente: null,
    diasFolga: null
  },

  agendamento: {
    nomeCliente: '',
    sobrenomeCliente: '',
    telefoneCliente: '',
    raclub: { status: 'nao' },
    servico: null
  },

  horarioFuncionamento: {
    inicio: '09:00',
    fim: '18:30'
  },

  stepMin: 30,

  setCtx(data) {
    this.ctx = { ...this.ctx, ...data };
  },

  setAgendamento(data) {
    this.agendamento = { ...this.agendamento, ...data };
  },

  setHorarioFuncionamento(data) {
    this.horarioFuncionamento = { ...this.horarioFuncionamento, ...data };
  }
};
