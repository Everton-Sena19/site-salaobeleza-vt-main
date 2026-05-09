import { confirmarAgendamento } from './agendamento.js';

export function bindUI() {
  const btn = document.getElementById('confirmarBtn');

  btn?.addEventListener('click', async () => {
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;

    try {
      await confirmarAgendamento(data, hora);

      if (typeof window.fecharModal === 'function') {
        window.fecharModal('modal');
      }

      alert('Agendamento realizado com sucesso!');
    } catch (e) {
      alert(e.message);
    }
  });
}