import { setState } from '../core/store.js';

export function setProfissional(ctxData) {
  setState({
    selecao: {
      profissionalId: ctxData.profissionalId
    },
    dados: {
      profissionalAtual: ctxData
    }
  });
}

export function setCliente({ nome, sobrenome, telefone }) {
  setState({
    cliente: {
      nome,
      sobrenome,
      telefone
    }
  });
}

export function setAgendamento({ dataBR, dataISO, hora }) {
  setState({
    selecao: {
      dataBR,
      dataISO,
      hora
    }
  });
}
