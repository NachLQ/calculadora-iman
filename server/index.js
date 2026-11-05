const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { calcular } = require('./precio');

// Primera ejecución: si no hay ninguna calculadora, cargar la demo automáticamente
// (así el pack muestra los datos de ejemplo sin `npm run seed` manual).
if (db.prepare('SELECT COUNT(*) AS c FROM calculadoras').get().c === 0) {
  require('./seed');
}

const app = express();
const PORT = process.env.PORT || 8765;

// Este producto es distinto a los demás del lote: el widget (/api/calculadora/:slug,
// /c/:slug, /widget/*) tiene que ser accesible desde la web real del cliente (otro
// dominio), así que el CORS abierto ahí es correcto, no un fallo. Lo que NO debería
// estar abierto a cualquier origen es la gestión (crear/borrar calculadoras, ver leads
// con datos reales de contacto): esas rutas van detrás de un origen restringido.
// Aviso real, sin resolver en este lote: no hay ningún token/contraseña delante de la
// gestión — si este servidor llega a exponerse a internet para que el widget funcione
// en la web pública del cliente, cualquiera que encuentre el puerto puede leer/borrar
// los leads. Necesita autenticación de verdad (ver server/auth.js de Cierre de Mes),
// no solo restringir el origen.
const ORIGEN_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const corsAdmin = cors({ origin: (origin, cb) => cb(null, !origin || ORIGEN_LOCAL.test(origin)) });
// Restringido primero (rutas de gestión), abierto después (rutas del widget) —
// deben ir separados: un `cors()` global sin restricción antes de este ya dejaría
// pasar cualquier origen a todo, incluida la gestión.
app.use(['/api/calculadoras', '/api/leads', '/api/estadisticas'], corsAdmin);
app.use(['/api/calculadora', '/c', '/widget', '/demo.html'], cors());
app.use(express.json());

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- helpers ----------
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'calc';
}

function ensureUniqueSlug(base, ignoreId) {
  let slug = base, i = 1;
  const q = db.prepare('SELECT id FROM calculadoras WHERE slug = ? AND id != ?');
  while (q.get(slug, ignoreId || 0)) slug = `${base}-${++i}`;
  return slug;
}

// Devuelve la calculadora completa (pasos + opciones + reglas)
function getCalculadoraCompleta(idOrSlug, bySlug = false) {
  const calc = bySlug
    ? db.prepare('SELECT * FROM calculadoras WHERE slug = ?').get(idOrSlug)
    : db.prepare('SELECT * FROM calculadoras WHERE id = ?').get(idOrSlug);
  if (!calc) return null;
  calc.activa = !!calc.activa;
  calc.pasos = db.prepare('SELECT * FROM pasos WHERE calculadora_id = ? ORDER BY orden, id').all(calc.id);
  for (const paso of calc.pasos) {
    paso.opciones = db.prepare('SELECT * FROM opciones WHERE paso_id = ? ORDER BY orden, id').all(paso.id);
  }
  calc.reglas = db.prepare('SELECT * FROM reglas_precio WHERE calculadora_id = ?').all(calc.id);
  return calc;
}

function respuestasLegibles(calc, cfg) {
  const out = [];
  for (const paso of (calc && calc.pasos) || []) {
    const v = cfg[paso.id];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const etiqueta = (id) => {
      const op = (paso.opciones || []).find((o) => Number(o.id) === Number(id));
      return op ? op.etiqueta : String(id);
    };
    const respuesta = Array.isArray(v) ? v.map(etiqueta).join(', ') : paso.tipo === 'seleccion_unica' ? etiqueta(v) : String(v);
    out.push({ pregunta: paso.titulo, respuesta });
  }
  return out;
}

function statsDe(calcId) {
  const visitas = db.prepare('SELECT COUNT(*) n FROM visitas WHERE calculadora_id = ?').get(calcId).n;
  const leads = db.prepare('SELECT COUNT(*) n FROM leads WHERE calculadora_id = ?').get(calcId).n;
  const valorMes = db.prepare(
    `SELECT COALESCE(SUM((precio_min+precio_max)/2),0) v FROM leads
     WHERE calculadora_id = ? AND created_at >= datetime('now','-30 days')`).get(calcId).v;
  return {
    visitas,
    leads,
    conversion: visitas ? Math.round((leads / visitas) * 1000) / 10 : 0,
    valor_estimado_mes: Math.round(valorMes)
  };
}

// ---------- API: CRUD calculadoras ----------
app.get('/api/calculadoras', (req, res) => {
  const rows = db.prepare('SELECT * FROM calculadoras ORDER BY created_at DESC').all();
  res.json(rows.map(c => ({ ...c, activa: !!c.activa, stats: statsDe(c.id) })));
});

app.get('/api/calculadoras/:id', (req, res) => {
  const calc = getCalculadoraCompleta(Number(req.params.id));
  if (!calc) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ...calc, stats: statsDe(calc.id) });
});

app.post('/api/calculadoras', (req, res) => {
  const b = req.body || {};
  const slug = ensureUniqueSlug(slugify(b.slug || b.nombre || 'calculadora'));
  const info = db.prepare(`INSERT INTO calculadoras
    (nombre, slug, descripcion, activa, color_primario, color_fondo, border_radius, logo_url, texto_confirmacion, margen_rango_porcentaje, precio_base)
    VALUES (@nombre,@slug,@descripcion,@activa,@color_primario,@color_fondo,@border_radius,@logo_url,@texto_confirmacion,@margen,@precio_base)`)
    .run({
      nombre: b.nombre || 'Nueva calculadora',
      slug,
      descripcion: b.descripcion || '',
      activa: b.activa === false ? 0 : 1,
      color_primario: b.color_primario || '#2563eb',
      color_fondo: b.color_fondo || '#ffffff',
      border_radius: b.border_radius ?? 12,
      logo_url: b.logo_url || null,
      texto_confirmacion: b.texto_confirmacion || '¡Gracias! Aquí tienes tu presupuesto estimado.',
      margen: b.margen_rango_porcentaje ?? 15,
      precio_base: b.precio_base ?? 0
    });
  res.json(getCalculadoraCompleta(info.lastInsertRowid));
});

app.put('/api/calculadoras/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM calculadoras WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'No encontrada' });
  const b = req.body || {};
  let slug = cur.slug;
  if (b.slug && b.slug !== cur.slug) slug = ensureUniqueSlug(slugify(b.slug), id);
  db.prepare(`UPDATE calculadoras SET
    nombre=@nombre, slug=@slug, descripcion=@descripcion, activa=@activa,
    color_primario=@color_primario, color_fondo=@color_fondo, border_radius=@border_radius,
    logo_url=@logo_url, texto_confirmacion=@texto_confirmacion,
    margen_rango_porcentaje=@margen, precio_base=@precio_base WHERE id=@id`)
    .run({
      id,
      nombre: b.nombre ?? cur.nombre,
      slug,
      descripcion: b.descripcion ?? cur.descripcion,
      activa: (b.activa ?? !!cur.activa) ? 1 : 0,
      color_primario: b.color_primario ?? cur.color_primario,
      color_fondo: b.color_fondo ?? cur.color_fondo,
      border_radius: b.border_radius ?? cur.border_radius,
      logo_url: b.logo_url ?? cur.logo_url,
      texto_confirmacion: b.texto_confirmacion ?? cur.texto_confirmacion,
      margen: b.margen_rango_porcentaje ?? cur.margen_rango_porcentaje,
      precio_base: b.precio_base ?? cur.precio_base
    });
  res.json(getCalculadoraCompleta(id));
});

app.delete('/api/calculadoras/:id', (req, res) => {
  db.prepare('DELETE FROM calculadoras WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- API: pasos ----------
app.get('/api/calculadoras/:id/pasos', (req, res) => {
  const calc = getCalculadoraCompleta(Number(req.params.id));
  res.json(calc ? calc.pasos : []);
});

app.post('/api/calculadoras/:id/pasos', (req, res) => {
  const calcId = Number(req.params.id);
  const b = req.body || {};
  const maxOrden = db.prepare('SELECT COALESCE(MAX(orden),-1) m FROM pasos WHERE calculadora_id=?').get(calcId).m;
  const info = db.prepare(`INSERT INTO pasos (calculadora_id, orden, titulo, descripcion, tipo, num_min, num_max, num_paso)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    calcId, b.orden ?? maxOrden + 1, b.titulo || 'Paso', b.descripcion || '',
    b.tipo || 'seleccion_unica', b.num_min ?? null, b.num_max ?? null, b.num_paso ?? null
  );
  const pasoId = info.lastInsertRowid;
  for (const op of b.opciones || []) {
    db.prepare('INSERT INTO opciones (paso_id, etiqueta, valor_numerico, imagen_url, orden) VALUES (?,?,?,?,?)')
      .run(pasoId, op.etiqueta || '', op.valor_numerico || 0, op.imagen_url || null, op.orden || 0);
  }
  const paso = db.prepare('SELECT * FROM pasos WHERE id = ?').get(pasoId);
  paso.opciones = db.prepare('SELECT * FROM opciones WHERE paso_id = ? ORDER BY orden, id').all(pasoId);
  res.json(paso);
});

app.put('/api/calculadoras/:id/pasos/:pasoId', (req, res) => {
  const pasoId = Number(req.params.pasoId);
  const cur = db.prepare('SELECT * FROM pasos WHERE id = ?').get(pasoId);
  if (!cur) return res.status(404).json({ error: 'Paso no encontrado' });
  const b = req.body || {};
  db.prepare(`UPDATE pasos SET orden=?, titulo=?, descripcion=?, tipo=?, num_min=?, num_max=?, num_paso=? WHERE id=?`)
    .run(b.orden ?? cur.orden, b.titulo ?? cur.titulo, b.descripcion ?? cur.descripcion,
      b.tipo ?? cur.tipo, b.num_min ?? cur.num_min, b.num_max ?? cur.num_max, b.num_paso ?? cur.num_paso, pasoId);
  if (Array.isArray(b.opciones)) {
    db.prepare('DELETE FROM opciones WHERE paso_id = ?').run(pasoId);
    for (const op of b.opciones) {
      db.prepare('INSERT INTO opciones (paso_id, etiqueta, valor_numerico, imagen_url, orden) VALUES (?,?,?,?,?)')
        .run(pasoId, op.etiqueta || '', op.valor_numerico || 0, op.imagen_url || null, op.orden || 0);
    }
  }
  const paso = db.prepare('SELECT * FROM pasos WHERE id = ?').get(pasoId);
  paso.opciones = db.prepare('SELECT * FROM opciones WHERE paso_id = ? ORDER BY orden, id').all(pasoId);
  res.json(paso);
});

app.delete('/api/calculadoras/:id/pasos/:pasoId', (req, res) => {
  db.prepare('DELETE FROM pasos WHERE id = ?').run(Number(req.params.pasoId));
  res.json({ ok: true });
});

// ---------- API: reglas ----------
app.post('/api/calculadoras/:id/reglas', (req, res) => {
  const calcId = Number(req.params.id);
  const b = req.body || {};
  // Si llega un array, reemplaza todas las reglas de la calculadora.
  if (Array.isArray(b.reglas)) {
    db.prepare('DELETE FROM reglas_precio WHERE calculadora_id = ?').run(calcId);
    const ins = db.prepare('INSERT INTO reglas_precio (calculadora_id, tipo, paso_id, opcion_id, importe) VALUES (?,?,?,?,?)');
    for (const r of b.reglas) ins.run(calcId, r.tipo, r.paso_id || null, r.opcion_id || null, r.importe || 0);
    return res.json(db.prepare('SELECT * FROM reglas_precio WHERE calculadora_id = ?').all(calcId));
  }
  const info = db.prepare('INSERT INTO reglas_precio (calculadora_id, tipo, paso_id, opcion_id, importe) VALUES (?,?,?,?,?)')
    .run(calcId, b.tipo, b.paso_id || null, b.opcion_id || null, b.importe || 0);
  res.json(db.prepare('SELECT * FROM reglas_precio WHERE id = ?').get(info.lastInsertRowid));
});

// ---------- API pública (widget) ----------
function calcPublica(calc) {
  // No exponemos las reglas internas al widget público; el cálculo se hace en el servidor.
  return {
    id: calc.id, nombre: calc.nombre, slug: calc.slug, descripcion: calc.descripcion,
    activa: calc.activa, color_primario: calc.color_primario, color_fondo: calc.color_fondo,
    border_radius: calc.border_radius, logo_url: calc.logo_url,
    texto_confirmacion: calc.texto_confirmacion,
    pasos: calc.pasos.map(p => ({
      id: p.id, orden: p.orden, titulo: p.titulo, descripcion: p.descripcion, tipo: p.tipo,
      num_min: p.num_min, num_max: p.num_max, num_paso: p.num_paso,
      opciones: p.opciones.map(o => ({ id: o.id, etiqueta: o.etiqueta, imagen_url: o.imagen_url }))
    }))
  };
}

app.get('/api/calculadora/:slug', (req, res) => {
  const calc = getCalculadoraCompleta(req.params.slug, true);
  if (!calc || !calc.activa) return res.status(404).json({ error: 'Calculadora no disponible' });
  res.json(calcPublica(calc));
});

app.post('/api/calculadora/:slug/visita', (req, res) => {
  const calc = db.prepare('SELECT id FROM calculadoras WHERE slug = ?').get(req.params.slug);
  if (!calc) return res.status(404).json({ error: 'No encontrada' });
  const info = db.prepare('INSERT INTO visitas (calculadora_id, completada, convertida) VALUES (?,?,?)')
    .run(calc.id, req.body && req.body.completada ? 1 : 0, 0);
  res.json({ visita_id: info.lastInsertRowid });
});

app.post('/api/calculadora/:slug/calcular', (req, res) => {
  const calc = getCalculadoraCompleta(req.params.slug, true);
  if (!calc) return res.status(404).json({ error: 'No encontrada' });
  res.json(calcular(calc, (req.body || {}).configuracion));
});

app.post('/api/calculadora/:slug/lead', (req, res) => {
  const calc = getCalculadoraCompleta(req.params.slug, true);
  if (!calc) return res.status(404).json({ error: 'No encontrada' });
  const b = req.body || {};
  if (!b.nombre || (!b.email && !b.telefono)) {
    return res.status(400).json({ error: 'Nombre y al menos un contacto (email o teléfono) son obligatorios' });
  }
  const precio = calcular(calc, b.configuracion);
  const info = db.prepare(`INSERT INTO leads
    (calculadora_id, nombre, email, telefono, urgencia, precio_min, precio_max, configuracion_json, estado)
    VALUES (?,?,?,?,?,?,?,?, 'nuevo')`).run(
    calc.id, b.nombre, b.email || null, b.telefono || null, b.urgencia || null,
    precio.precio_min, precio.precio_max, JSON.stringify(b.configuracion || {})
  );
  // Marca la última visita como convertida si llega visita_id
  if (b.visita_id) db.prepare('UPDATE visitas SET convertida=1, completada=1 WHERE id=?').run(b.visita_id);
  res.json({ lead_id: info.lastInsertRowid, ...precio, texto_confirmacion: calc.texto_confirmacion });
});

// ---------- API: leads ----------
app.get('/api/leads', (req, res) => {
  const { calculadora_id, urgencia, estado } = req.query;
  let sql = `SELECT l.*, c.nombre AS calculadora_nombre FROM leads l
             JOIN calculadoras c ON c.id = l.calculadora_id WHERE 1=1`;
  const params = [];
  if (calculadora_id) { sql += ' AND l.calculadora_id = ?'; params.push(Number(calculadora_id)); }
  if (urgencia) { sql += ' AND l.urgencia = ?'; params.push(urgencia); }
  if (estado) { sql += ' AND l.estado = ?'; params.push(estado); }
  sql += ' ORDER BY l.created_at DESC';
  const calcs = {};
  const rows = db.prepare(sql).all(...params).map(l => {
    const configuracion = l.configuracion_json ? JSON.parse(l.configuracion_json) : {};
    if (!calcs[l.calculadora_id]) calcs[l.calculadora_id] = getCalculadoraCompleta(l.calculadora_id);
    return { ...l, configuracion, respuestas: respuestasLegibles(calcs[l.calculadora_id], configuracion) };
  });
  res.json(rows);
});

app.put('/api/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Lead no encontrado' });
  const b = req.body || {};
  db.prepare('UPDATE leads SET estado=? WHERE id=?').run(b.estado ?? cur.estado, id);
  res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
});

// ---------- API: estadísticas ----------
app.get('/api/estadisticas', (req, res) => {
  const calcs = db.prepare('SELECT id, nombre, slug FROM calculadoras ORDER BY nombre').all();
  const porCalculadora = calcs.map(c => ({ ...c, ...statsDe(c.id) }));
  // Serie semanal (últimos 7 días) de leads totales.
  const serie = [];
  for (let i = 6; i >= 0; i--) {
    const dia = db.prepare(`SELECT date('now', ?) d`).get(`-${i} days`).d;
    const n = db.prepare(`SELECT COUNT(*) n FROM leads WHERE date(created_at) = ?`).get(dia).n;
    serie.push({ fecha: dia, leads: n });
  }
  const totales = {
    visitas: db.prepare('SELECT COUNT(*) n FROM visitas').get().n,
    leads: db.prepare('SELECT COUNT(*) n FROM leads').get().n
  };
  totales.conversion = totales.visitas ? Math.round((totales.leads / totales.visitas) * 1000) / 10 : 0;
  res.json({ totales, por_calculadora: porCalculadora, serie_semanal: serie });
});

// ---------- Widget + páginas públicas ----------
app.use('/widget', express.static(path.join(__dirname, 'public', 'widget')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('/demo.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'demo.html')));

// Página standalone de una calculadora
app.get('/c/:slug', (req, res) => {
  const calc = db.prepare('SELECT nombre FROM calculadoras WHERE slug = ?').get(req.params.slug);
  // El nombre lo pone el admin y esta página la ve cualquier visitante de la
  // web del cliente — sin escapar, un nombre con "</title><script>" se
  // ejecutaría en el navegador de cada visitante (XSS almacenado).
  const titulo = escapeHtml(calc ? calc.nombre : 'Calculadora Imán');
  res.send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — Calculadora Imán</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
  #calculadora-iman{width:100%;max-width:480px}
</style></head><body>
<div id="calculadora-iman"></div>
<script src="/widget/calculadora-iman.js" data-slug="${req.params.slug}"></script>
</body></html>`);
});

app.get('/', (req, res) => res.json({ ok: true, producto: 'Calculadora Imán', api: '/api', demo: '/demo.html' }));

app.listen(PORT, () => {
  console.log(`Calculadora Imán · servidor en http://localhost:${PORT}`);
  console.log(`  Demo:    http://localhost:${PORT}/demo.html`);
  console.log(`  Widget:  http://localhost:${PORT}/widget/calculadora-iman.js`);
});
