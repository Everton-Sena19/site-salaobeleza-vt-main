const state = {
  tenant: {
    tenantId: null,
    unidadeId: null
  },

  fluxo: {
    etapaAtual: 'inicio',
    carregando: false,
    erro: null
  },

  cliente: {
    nome: '',
    telefone: ''
  },

  selecao: {
    profissionalId: null,
    servicoId: null,
    dataBR: '',
    dataISO: '',
    hora: ''
  },

  contexto: {
    reagendamento: false,
    agendamentoId: null,
    assinaturaAtiva: false
  },

  dados: {
    profissionais: [],
    servicos: [],
    horariosDisponiveis: []
  },

  ui: {
    modalAtivo: null
  }
};

const listeners = [];

export function getState() {
  return structuredClone(state);
}

export function setState(partial) {
  mergeDeep(state, partial);
  listeners.forEach(listener => listener(getState()));
}

export function subscribe(listener) {
  listeners.push(listener);

  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

function mergeDeep(target, source) {
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue)
    ) {
      if (!targetValue || typeof targetValue !== 'object') {
        target[key] = {};
      }

      mergeDeep(target[key], sourceValue);
    } else {
      target[key] = sourceValue;
    }
  }
}