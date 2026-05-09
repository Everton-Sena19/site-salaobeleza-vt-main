export function formatarDataParaISO(dataBR) {
  if (!dataBR || typeof dataBR !== 'string') return '';

  const partes = dataBR.split('/');
  if (partes.length !== 3) return '';

  const [dia, mes, ano] = partes.map(item => item.trim());

  if (!/^\d{2}$/.test(dia)) return '';
  if (!/^\d{2}$/.test(mes)) return '';
  if (!/^\d{4}$/.test(ano)) return '';

  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '';

  const diaValido = String(data.getDate()).padStart(2, '0');
  const mesValido = String(data.getMonth() + 1).padStart(2, '0');
  const anoValido = String(data.getFullYear());

  if (dia !== diaValido || mes !== mesValido || ano !== anoValido) {
    return '';
  }

  return `${ano}-${mes}-${dia}`;
}

export function formatarISOParaBR(dataISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return '';

  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}