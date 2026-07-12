// Validaciones compartidas: teléfonos, plantillas, CSV y campañas.

const SHORTENERS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'ow.ly', 'buff.ly'];
const NUMEROS_PRUEBA = ['5211111111', '5212222222', '5210000000'];

export function normalizarTelefono(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.startsWith('52') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+52${digits}`;
  return null;
}

export function validarTelefonoMx(raw) {
  const normalizado = normalizarTelefono(raw);
  if (!normalizado) {
    return { valido: false, error: 'Formato inválido. Debe ser +52 seguido de 10 dígitos.' };
  }
  const digitsAfterLada = normalizado.replace('+52', '');
  if (digitsAfterLada.length !== 10) {
    return { valido: false, error: 'El número debe tener 10 dígitos después de +52.' };
  }
  if (/^(\d)\1{4,}$/.test(digitsAfterLada) || NUMEROS_PRUEBA.includes(`52${digitsAfterLada}`)) {
    return { valido: false, error: 'Parece un número de prueba o inválido.' };
  }
  return { valido: true, telefono: normalizado };
}

export function validarNombreContacto(nombre) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return { valido: false, error: 'El nombre no puede estar vacío.' };
  if (/[<>{}$;]/.test(limpio)) return { valido: false, error: 'El nombre contiene caracteres no permitidos.' };
  return { valido: true, nombre: limpio };
}

export function extraerVariables(contenido) {
  const matches = String(contenido || '').matchAll(/{{\s*(\w+)\s*}}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function validarPlantilla({ nombre, contenido, variablesDeclaradas = [] }) {
  const errores = [];

  if (!nombre || !nombre.trim()) errores.push('El nombre de la plantilla es obligatorio.');
  if (!contenido || !contenido.trim()) errores.push('El contenido no puede estar vacío ni ser solo espacios.');

  const variablesUsadas = extraerVariables(contenido);
  const faltantes = variablesUsadas.filter((v) => !variablesDeclaradas.includes(v));
  if (faltantes.length > 0) {
    errores.push(`Variables usadas pero no declaradas: ${faltantes.join(', ')}`);
  }

  const links = (contenido.match(/https?:\/\/[^\s]+/g) || []);
  const advertencias = [];
  if (links.length >= 2) advertencias.push('La plantilla tiene 2+ links, riesgo alto de spam.');
  if (links.some((l) => SHORTENERS.some((s) => l.includes(s)))) {
    advertencias.push('Evita URLs acortadas (bit.ly, tinyurl, etc). Elevan el riesgo de bloqueo.');
  }
  if (contenido.length > 160) advertencias.push(`Excede 160 caracteres recomendados (${contenido.length}).`);

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    variablesUsadas,
  };
}

export function renderPreview(contenido, valores = {}) {
  return String(contenido || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => valores[key] ?? `{{${key}}}`);
}

export function validarFilaCsv(row, index) {
  const errores = [];
  if (!Array.isArray(row) || row.length !== 2) {
    return { valida: false, errores: [`Fila ${index + 1}: debe tener exactamente 2 columnas.`] };
  }
  const [nombreRaw, telRaw] = row;
  const nombreCheck = validarNombreContacto(nombreRaw);
  if (!nombreCheck.valido) errores.push(`Fila ${index + 1}: ${nombreCheck.error}`);

  const telCheck = validarTelefonoMx(telRaw);
  if (!telCheck.valido) errores.push(`Fila ${index + 1}: ${telCheck.error}`);

  return {
    valida: errores.length === 0,
    errores,
    nombre: nombreCheck.nombre,
    telefono: telCheck.telefono,
  };
}

export function validarArchivoCsv(file) {
  const errores = [];
  if (!file) return { valido: false, errores: ['No se seleccionó ningún archivo.'] };
  const nombreLower = file.name.toLowerCase();
  if (!nombreLower.endsWith('.csv') && !nombreLower.endsWith('.xlsx')) {
    errores.push('Solo se aceptan archivos .csv o .xlsx.');
  }
  if (file.size === 0) errores.push('El archivo está vacío.');
  if (file.size > 5 * 1024 * 1024) errores.push('El archivo excede el límite de 5MB.');
  return { valido: errores.length === 0, errores };
}

export function validarCampana({ plantillaId, contactosIds, mensajesHoy = 0 }) {
  const errores = [];
  const advertencias = [];

  if (!plantillaId) errores.push('Debes seleccionar una plantilla.');
  if (!contactosIds || contactosIds.length === 0) errores.push('Debes seleccionar al menos 1 contacto.');

  const totalTrasEnvio = mensajesHoy + (contactosIds?.length || 0);
  if (totalTrasEnvio > 100) {
    errores.push(`Excede el máximo de 100 mensajes/día (llevas ${mensajesHoy}, agregarías ${contactosIds?.length || 0}).`);
  }

  return { valido: errores.length === 0, errores, advertencias };
}
