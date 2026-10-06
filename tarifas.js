// ÚNICO módulo con las reglas de cobro (RNF-05). Cambia aquí una tarifa y listo.
export const valorPorInvitado = (n) => (n <= 100 ? 8000 : n <= 500 ? 6000 : 4000);
export const cuotaPorHoras = (h) => (h <= 3 ? 100000 : h <= 6 ? 200000 : 300000);

export function calcular(invitados, horas) {
  const vi = valorPorInvitado(invitados), cuota = cuotaPorHoras(horas);
  return { valorPorInvitado: vi, cuotaHoras: cuota, montoTotal: invitados * vi + cuota };
}

export const hoyCO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const entero = (v) => { const s = String(v ?? '').trim(); return /^\d+$/.test(s) && Number(s) > 0 ? Number(s) : null; };

// Devuelve { errores: {campo: mensaje}, datos }
export function validar(b, campos = ['fecha', 'cedula', 'invitados', 'horas'], fechaOriginal = null) {
  const errores = {}, datos = {};
  if (campos.includes('fecha')) {
    const f = String(b.fecha ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || isNaN(new Date(f))) errores.fecha = 'Ingresa una fecha válida.';
    else if (f < hoyCO() && f !== fechaOriginal) errores.fecha = 'La fecha no puede ser anterior a hoy. Elige hoy o una fecha futura.';
    else datos.fecha = f;
  }
  if (campos.includes('cedula')) {
    const c = String(b.cedula ?? '').trim();
    if (!/^\d{6,10}$/.test(c)) errores.cedula = 'La cédula debe tener entre 6 y 10 dígitos y solo números.';
    else datos.cedula = c;
  }
  if (campos.includes('invitados')) {
    const n = entero(b.invitados);
    if (n === null) errores.invitados = 'Ingresa un número entero mayor que 0.'; else datos.invitados = n;
  }
  if (campos.includes('horas')) {
    const h = entero(b.horas);
    if (h === null) errores.horas = 'Ingresa las horas como número entero mayor que 0.'; else datos.horas = h;
  }
  return { errores, datos };
}
