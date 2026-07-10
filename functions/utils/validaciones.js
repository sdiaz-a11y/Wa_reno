function normalizarTelefono(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.startsWith('52') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+52${digits}`;
  return null;
}

function esTelefonoValido(raw) {
  const normalizado = normalizarTelefono(raw);
  if (!normalizado) return false;
  const digits = normalizado.replace('+52', '');
  return digits.length === 10 && !/^(\d)\1{4,}$/.test(digits);
}

module.exports = { normalizarTelefono, esTelefonoValido };
