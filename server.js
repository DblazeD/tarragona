import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { calcular, validar } from './tarifas.js';

dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(cors());
app.use(express.json());

const rechazo = (res, errores) => {
  const campo = Object.keys(errores)[0];
  return res.status(400).json({ error: errores[campo], campo, errores });
};
const rangoMes = (mes) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) return null;
  const [a, m] = mes.split('-').map(Number);
  const sig = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  return [`${mes}-01`, sig];
};
const ruta = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'No se pudo completar la operación. Intenta de nuevo.' });
});

// Vista previa (sin guardar)
app.post('/api/calculo', ruta(async (req, res) => {
  const { errores, datos } = validar(req.body, ['invitados', 'horas']);
  if (Object.keys(errores).length) return rechazo(res, errores);
  res.json(calcular(datos.invitados, datos.horas));
}));

// Registrar
app.post('/api/fiestas', ruta(async (req, res) => {
  const { errores, datos: d } = validar(req.body);
  if (Object.keys(errores).length) return rechazo(res, errores);
  const c = calcular(d.invitados, d.horas);
  const { rows } = await pool.query(
    `INSERT INTO fiesta (fecha_evento,cedula_contratante,cantidad_invitados,horas,valor_por_invitado,cuota_horas,monto_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [d.fecha, d.cedula, d.invitados, d.horas, c.valorPorInvitado, c.cuotaHoras, c.montoTotal]);
  res.status(201).json({ id: rows[0].id, fecha: d.fecha, cedula: d.cedula, invitados: d.invitados, horas: d.horas, ...c });
}));

// Editar (la fecha no puede pasar a un día anterior a hoy; si ya era pasada, puede conservarse)
app.put('/api/fiestas/:id', ruta(async (req, res) => {
  const id = Number(req.params.id) || 0;
  const ex = await pool.query(`SELECT to_char(fecha_evento,'YYYY-MM-DD') AS fecha FROM fiesta WHERE id = $1`, [id]);
  if (!ex.rowCount) return res.status(404).json({ error: 'Esa fiesta ya no existe.' });
  const { errores, datos: d } = validar(req.body, undefined, ex.rows[0].fecha);
  if (Object.keys(errores).length) return rechazo(res, errores);
  const c = calcular(d.invitados, d.horas);
  await pool.query(
    `UPDATE fiesta SET fecha_evento=$1, cedula_contratante=$2, cantidad_invitados=$3, horas=$4,
       valor_por_invitado=$5, cuota_horas=$6, monto_total=$7 WHERE id=$8`,
    [d.fecha, d.cedula, d.invitados, d.horas, c.valorPorInvitado, c.cuotaHoras, c.montoTotal, id]);
  res.json({ id, fecha: d.fecha, cedula: d.cedula, invitados: d.invitados, horas: d.horas, ...c });
}));

// Listar por mes
app.get('/api/fiestas', ruta(async (req, res) => {
  const r = rangoMes(req.query.mes);
  if (!r) return res.status(400).json({ error: 'Elige un mes válido.', campo: 'mes' });
  const { rows } = await pool.query(
    `SELECT id, to_char(fecha_evento,'YYYY-MM-DD') AS fecha, cedula_contratante AS cedula,
            cantidad_invitados AS invitados, horas, valor_por_invitado AS "valorPorInvitado",
            cuota_horas AS "cuotaHoras", monto_total AS "montoTotal"
     FROM fiesta WHERE fecha_evento >= $1 AND fecha_evento < $2 ORDER BY fecha_evento, id`, r);
  res.json(rows);
}));

// Eliminar
app.delete('/api/fiestas/:id', ruta(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM fiesta WHERE id = $1', [Number(req.params.id) || 0]);
  if (!rowCount) return res.status(404).json({ error: 'Esa fiesta ya no existe.' });
  res.json({ ok: true });
}));

// Resumen mensual
app.get('/api/resumen', ruta(async (req, res) => {
  const r = rangoMes(req.query.mes);
  if (!r) return res.status(400).json({ error: 'Elige un mes válido.', campo: 'mes' });
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS fiestas,
            COALESCE(SUM(cantidad_invitados),0)::int AS "totalInvitados",
            COALESCE(SUM(horas),0)::int AS "totalHoras",
            COALESCE(SUM(monto_total),0)::bigint AS "montoTotal",
            COUNT(*) FILTER (WHERE horas <= 3)::int AS r1,
            COUNT(*) FILTER (WHERE horas BETWEEN 4 AND 6)::int AS r2,
            COUNT(*) FILTER (WHERE horas > 6)::int AS r3
     FROM fiesta WHERE fecha_evento >= $1 AND fecha_evento < $2`, r);
  const x = rows[0];
  res.json({ fiestas: x.fiestas, totalInvitados: x.totalInvitados, totalHoras: x.totalHoras,
    montoTotal: Number(x.montoTotal), rangos: { r1: x.r1, r2: x.r2, r3: x.r3 } });
}));

const puerto = process.env.PORT || 3001;
try {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  app.listen(puerto, () => console.log(`API de Tarragona lista en http://localhost:${puerto}`));
} catch (e) {
  console.error('No se pudo conectar a PostgreSQL. Revisa DATABASE_URL en backend/.env\n', e.message);
  process.exit(1);
}
