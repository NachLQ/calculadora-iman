// Seed con datos demo realistas en español de España.
// Ejecuta:  npm run seed   (borra y recrea todo)
const db = require('./db');
const { calcular } = require('./precio');

// Limpieza total.
db.exec(`DELETE FROM visitas; DELETE FROM leads; DELETE FROM reglas_precio;
         DELETE FROM opciones; DELETE FROM pasos; DELETE FROM calculadoras;
         DELETE FROM sqlite_sequence;`);

const insCalc = db.prepare(`INSERT INTO calculadoras
  (nombre, slug, descripcion, activa, color_primario, color_fondo, border_radius, logo_url, texto_confirmacion, margen_rango_porcentaje, precio_base)
  VALUES (@nombre,@slug,@descripcion,1,@color_primario,@color_fondo,@border_radius,@logo_url,@texto_confirmacion,@margen,@precio_base)`);
const insPaso = db.prepare(`INSERT INTO pasos (calculadora_id, orden, titulo, descripcion, tipo, num_min, num_max, num_paso)
  VALUES (?,?,?,?,?,?,?,?)`);
const insOp = db.prepare(`INSERT INTO opciones (paso_id, etiqueta, valor_numerico, imagen_url, orden) VALUES (?,?,?,?,?)`);
const insRegla = db.prepare(`INSERT INTO reglas_precio (calculadora_id, tipo, paso_id, opcion_id, importe) VALUES (?,?,?,?,?)`);

// Crea una calculadora completa a partir de una spec con claves simbólicas.
function crear(spec) {
  const calcId = insCalc.run({
    nombre: spec.nombre, slug: spec.slug, descripcion: spec.descripcion,
    color_primario: spec.color_primario, color_fondo: spec.color_fondo || '#ffffff',
    border_radius: spec.border_radius != null ? spec.border_radius : 12,
    logo_url: spec.logo_url || null, texto_confirmacion: spec.texto_confirmacion,
    margen: spec.margen, precio_base: spec.precio_base
  }).lastInsertRowid;

  const pasoIdByKey = {}, opcionIdByKey = {};
  spec.pasos.forEach((p, i) => {
    const pasoId = insPaso.run(calcId, i, p.titulo, p.descripcion || '', p.tipo,
      p.num_min ?? null, p.num_max ?? null, p.num_paso ?? null).lastInsertRowid;
    pasoIdByKey[p.key] = pasoId;
    (p.opciones || []).forEach((o, j) => {
      const opId = insOp.run(pasoId, o.etiqueta, o.valor_numerico || 0, o.imagen_url || null, j).lastInsertRowid;
      opcionIdByKey[p.key + ':' + o.key] = opId;
    });
  });

  (spec.reglas || []).forEach(r => {
    insRegla.run(calcId, r.tipo,
      r.pasoKey ? pasoIdByKey[r.pasoKey] : null,
      r.opcionKey ? opcionIdByKey[r.opcionKey] : null,
      r.importe || 0);
  });

  return { calcId, pasoIdByKey, opcionIdByKey };
}

// ---------------- Calculadora 1: Reforma de baño ----------------
const c1 = crear({
  nombre: 'Reforma de baño', slug: 'reforma-bano',
  descripcion: 'Calcula el coste estimado de tu reforma en 30 segundos.',
  color_primario: '#0ea5e9', border_radius: 14,
  texto_confirmacion: 'Un técnico revisará tu configuración y te llamará para concretar la visita gratuita.',
  margen: 15, precio_base: 800,
  pasos: [
    { key: 'm2', titulo: '¿Cuántos metros cuadrados tiene tu baño?', descripcion: 'Indica la superficie aproximada.',
      tipo: 'numero', num_min: 3, num_max: 20, num_paso: 1 },
    { key: 'serv', titulo: '¿Qué incluye la reforma?', descripcion: 'Marca todo lo que necesites.',
      tipo: 'seleccion_multiple', opciones: [
        { key: 'font', etiqueta: 'Fontanería' }, { key: 'alic', etiqueta: 'Alicatado' },
        { key: 'elec', etiqueta: 'Instalación eléctrica' }, { key: 'mueb', etiqueta: 'Muebles de baño' },
        { key: 'pint', etiqueta: 'Pintura' }
      ] },
    { key: 'cal', titulo: 'Calidad de materiales', tipo: 'seleccion_unica', opciones: [
        { key: 'basica', etiqueta: 'Básica', valor_numerico: 1 },
        { key: 'media', etiqueta: 'Media', valor_numerico: 1.3 },
        { key: 'premium', etiqueta: 'Premium', valor_numerico: 1.7 }
      ] },
    { key: 'cuando', titulo: '¿Cuándo necesitas empezar?', tipo: 'seleccion_unica', opciones: [
        { key: 'urg', etiqueta: 'Urgente (menos de 2 semanas)' },
        { key: 'm13', etiqueta: 'En 1-3 meses' }, { key: 'expl', etiqueta: 'Todavía explorando' }
      ] }
  ],
  reglas: [
    { tipo: 'por_unidad', pasoKey: 'm2', importe: 150 },
    { tipo: 'suma_fija', opcionKey: 'serv:font', importe: 600 },
    { tipo: 'suma_fija', opcionKey: 'serv:alic', importe: 450 },
    { tipo: 'suma_fija', opcionKey: 'serv:elec', importe: 350 },
    { tipo: 'suma_fija', opcionKey: 'serv:mueb', importe: 700 },
    { tipo: 'suma_fija', opcionKey: 'serv:pint', importe: 200 },
    { tipo: 'multiplicador', opcionKey: 'cal:basica' },
    { tipo: 'multiplicador', opcionKey: 'cal:media' },
    { tipo: 'multiplicador', opcionKey: 'cal:premium' }
  ]
});

// ---------------- Calculadora 2: Coaching de negocio ----------------
const c2 = crear({
  nombre: 'Programa de coaching de negocio', slug: 'coaching-negocio',
  descripcion: 'Descubre la inversión estimada para tu programa a medida.',
  color_primario: '#7c3aed', border_radius: 18,
  texto_confirmacion: 'Te enviaré un email para agendar una llamada de diagnóstico gratuita de 20 minutos.',
  margen: 20, precio_base: 500,
  pasos: [
    { key: 'sit', titulo: '¿Cuál es tu situación actual?', tipo: 'seleccion_unica', opciones: [
        { key: 'emp', etiqueta: 'Empezando', valor_numerico: 1 },
        { key: 'act50', etiqueta: 'En activo (menos de 50k€/año)', valor_numerico: 1.4 },
        { key: 'act50m', etiqueta: 'En activo (más de 50k€/año)', valor_numerico: 1.8 },
        { key: 'esc', etiqueta: 'Quiero escalar', valor_numerico: 2.2 }
      ] },
    { key: 'nec', titulo: '¿Qué necesitas principalmente?', tipo: 'seleccion_unica', opciones: [
        { key: 'clar', etiqueta: 'Claridad de negocio' }, { key: 'cli', etiqueta: 'Conseguir clientes' },
        { key: 'proc', etiqueta: 'Optimizar procesos' }, { key: 'lanz', etiqueta: 'Lanzar producto' }
      ] },
    { key: 'ded', titulo: '¿Cuánto tiempo puedes dedicar por semana?', tipo: 'seleccion_unica', opciones: [
        { key: 'd23', etiqueta: '2-3 horas', valor_numerico: 1 },
        { key: 'd46', etiqueta: '4-6 horas', valor_numerico: 1.25 },
        { key: 'd7', etiqueta: '7 horas o más', valor_numerico: 1.5 }
      ] },
    { key: 'mod', titulo: '¿Individual o en grupo?', tipo: 'seleccion_unica', opciones: [
        { key: 'ind', etiqueta: 'Sesiones individuales' }, { key: 'grp', etiqueta: 'Grupo reducido' },
        { key: 'ig', etiqueta: 'Me da igual' }
      ] }
  ],
  reglas: [
    { tipo: 'multiplicador', opcionKey: 'sit:emp' }, { tipo: 'multiplicador', opcionKey: 'sit:act50' },
    { tipo: 'multiplicador', opcionKey: 'sit:act50m' }, { tipo: 'multiplicador', opcionKey: 'sit:esc' },
    { tipo: 'multiplicador', opcionKey: 'ded:d23' }, { tipo: 'multiplicador', opcionKey: 'ded:d46' },
    { tipo: 'multiplicador', opcionKey: 'ded:d7' }
  ]
});

// ---------------- Calculadora 3: Mantenimiento de climatización ----------------
const c3 = crear({
  nombre: 'Mantenimiento de climatización', slug: 'mantenimiento-clima',
  descripcion: 'Presupuesto orientativo del mantenimiento de tus equipos.',
  color_primario: '#059669', border_radius: 10,
  texto_confirmacion: 'Recibirás el presupuesto detallado por email en menos de 24 horas laborables.',
  margen: 10, precio_base: 60,
  pasos: [
    { key: 'uni', titulo: 'Número de unidades a mantener', tipo: 'numero', num_min: 1, num_max: 20, num_paso: 1 },
    { key: 'tipo', titulo: 'Tipo de equipo', tipo: 'seleccion_unica', opciones: [
        { key: 'dom', etiqueta: 'Split doméstico' }, { key: 'inv', etiqueta: 'Split inverter' },
        { key: 'vrf', etiqueta: 'VRF industrial' }, { key: 'cas', etiqueta: 'Cassette' }
      ] },
    { key: 'gas', titulo: '¿Incluye revisión de gas?', tipo: 'seleccion_unica', opciones: [
        { key: 'si', etiqueta: 'Sí' }, { key: 'no', etiqueta: 'No' }
      ] },
    { key: 'per', titulo: 'Periodicidad', tipo: 'seleccion_unica', opciones: [
        { key: 'unica', etiqueta: 'Revisión única', valor_numerico: 1 },
        { key: 'anual', etiqueta: 'Contrato anual', valor_numerico: 4 }
      ] }
  ],
  reglas: [
    { tipo: 'por_unidad', pasoKey: 'uni', importe: 45 },
    { tipo: 'suma_fija', opcionKey: 'tipo:dom', importe: 20 },
    { tipo: 'suma_fija', opcionKey: 'tipo:inv', importe: 40 },
    { tipo: 'suma_fija', opcionKey: 'tipo:vrf', importe: 150 },
    { tipo: 'suma_fija', opcionKey: 'tipo:cas', importe: 70 },
    { tipo: 'suma_fija', opcionKey: 'gas:si', importe: 35 },
    { tipo: 'multiplicador', opcionKey: 'per:unica' },
    { tipo: 'multiplicador', opcionKey: 'per:anual' }
  ]
});

// ---------------- Leads ----------------
function assemble(calcId) {
  const calc = db.prepare('SELECT * FROM calculadoras WHERE id = ?').get(calcId);
  calc.pasos = db.prepare('SELECT * FROM pasos WHERE calculadora_id = ? ORDER BY orden').all(calcId);
  for (const p of calc.pasos) p.opciones = db.prepare('SELECT * FROM opciones WHERE paso_id = ?').all(p.id);
  calc.reglas = db.prepare('SELECT * FROM reglas_precio WHERE calculadora_id = ?').all(calcId);
  return calc;
}
const calc1 = assemble(c1.calcId), calc2 = assemble(c2.calcId), calc3 = assemble(c3.calcId);
const op = (c, k) => c.opcionIdByKey[k];
const ps = (c, k) => c.pasoIdByKey[k];

const insLead = db.prepare(`INSERT INTO leads
  (calculadora_id, nombre, email, telefono, urgencia, precio_min, precio_max, configuracion_json, estado, created_at)
  VALUES (?,?,?,?,?,?,?,?,?, datetime('now', ?))`);

function lead(calc, calcRefs, datos) {
  const config = datos.config;
  const p = calcular(calc, config);
  insLead.run(calc.id, datos.nombre, datos.email || null, datos.telefono || null, datos.urgencia || null,
    p.precio_min, p.precio_max, JSON.stringify(config), datos.estado, datos.hace);
}

// --- Reforma baño (3 leads) ---
lead(calc1, c1, {
  nombre: 'Marta Giménez', email: 'marta.gimenez@gmail.com', telefono: '655 213 884',
  urgencia: 'proximo_mes', estado: 'cerrado', hace: '-6 days',
  config: { [ps(c1, 'm2')]: 8, [ps(c1, 'serv')]: [op(c1, 'serv:font'), op(c1, 'serv:alic'), op(c1, 'serv:mueb')],
    [ps(c1, 'cal')]: op(c1, 'cal:media'), [ps(c1, 'cuando')]: op(c1, 'cuando:m13') }
});
lead(calc1, c1, {
  nombre: 'Javier Ortega', telefono: '610 998 002', urgencia: 'urgente', estado: 'contactado', hace: '-3 days',
  config: { [ps(c1, 'm2')]: 5, [ps(c1, 'serv')]: [op(c1, 'serv:alic'), op(c1, 'serv:pint')],
    [ps(c1, 'cal')]: op(c1, 'cal:basica'), [ps(c1, 'cuando')]: op(c1, 'cuando:urg') }
});
lead(calc1, c1, {
  nombre: 'Lucía Fernández', email: 'lucia.fdez@hotmail.com', urgencia: 'urgente', estado: 'nuevo', hace: '-1 days',
  config: { [ps(c1, 'm2')]: 12, [ps(c1, 'serv')]: [op(c1, 'serv:font'), op(c1, 'serv:alic'),
    op(c1, 'serv:elec'), op(c1, 'serv:mueb'), op(c1, 'serv:pint')],
    [ps(c1, 'cal')]: op(c1, 'cal:premium'), [ps(c1, 'cuando')]: op(c1, 'cuando:urg') }
});

// --- Coaching (3 leads) ---
lead(calc2, c2, {
  nombre: 'Carlos Ibáñez', email: 'carlos@estudioibanez.es', urgencia: 'urgente', estado: 'presupuesto', hace: '-5 days',
  config: { [ps(c2, 'sit')]: op(c2, 'sit:act50m'), [ps(c2, 'nec')]: op(c2, 'nec:proc'),
    [ps(c2, 'ded')]: op(c2, 'ded:d46'), [ps(c2, 'mod')]: op(c2, 'mod:ind') }
});
lead(calc2, c2, {
  nombre: 'Paula Méndez', email: 'paulamendez.coach@gmail.com', urgencia: 'explorando', estado: 'nuevo', hace: '-2 days',
  config: { [ps(c2, 'sit')]: op(c2, 'sit:emp'), [ps(c2, 'nec')]: op(c2, 'nec:clar'),
    [ps(c2, 'ded')]: op(c2, 'ded:d23'), [ps(c2, 'mod')]: op(c2, 'mod:grp') }
});
lead(calc2, c2, {
  nombre: 'Sergio Rubio', telefono: '699 145 720', email: 'sergio.rubio@empresa.com',
  urgencia: 'proximo_mes', estado: 'contactado', hace: '-4 days',
  config: { [ps(c2, 'sit')]: op(c2, 'sit:esc'), [ps(c2, 'nec')]: op(c2, 'nec:lanz'),
    [ps(c2, 'ded')]: op(c2, 'ded:d7'), [ps(c2, 'mod')]: op(c2, 'mod:ind') }
});

// --- Climatización (2 leads) ---
lead(calc3, c3, {
  nombre: 'Comunidad Edificio Sol', email: 'admin@fincasol.es', telefono: '912 334 556',
  urgencia: 'proximo_mes', estado: 'nuevo', hace: '-2 days',
  config: { [ps(c3, 'uni')]: 4, [ps(c3, 'tipo')]: op(c3, 'tipo:inv'),
    [ps(c3, 'gas')]: op(c3, 'gas:si'), [ps(c3, 'per')]: op(c3, 'per:anual') }
});
lead(calc3, c3, {
  nombre: 'Restaurante La Parra', telefono: '963 887 211', urgencia: 'tres_meses', estado: 'descartado', hace: '-6 days',
  config: { [ps(c3, 'uni')]: 2, [ps(c3, 'tipo')]: op(c3, 'tipo:dom'),
    [ps(c3, 'gas')]: op(c3, 'gas:no'), [ps(c3, 'per')]: op(c3, 'per:unica') }
});

// ---------------- Visitas (últimos 7 días) ----------------
// Dimensionadas para una conversión coherente del 15-25% por calculadora.
const insVisita = db.prepare(`INSERT INTO visitas (calculadora_id, fecha, completada, convertida)
  VALUES (?, datetime('now', ?, ?), ?, ?)`);
function visitas(calcId, total, conversiones) {
  for (let i = 0; i < total; i++) {
    const dia = Math.floor(Math.random() * 7);          // 0..6 días atrás
    const hora = Math.floor(Math.random() * 12) + 8;    // hora ficticia
    const completada = Math.random() < 0.75 ? 1 : 0;    // ~75% llega al gate
    const convertida = i < conversiones ? 1 : 0;
    // datetime() de SQLite solo acepta un modificador por argumento — con los dos
    // pegados en una sola cadena ("-3 days -10 hours") el modificador es inválido
    // y devuelve NULL, rompiendo el NOT NULL de fecha. Van como dos argumentos.
    insVisita.run(calcId, `-${dia} days`, `-${hora} hours`, completada || convertida, convertida);
  }
}
visitas(c1.calcId, 16, 3);  // 3/16 ≈ 18,8%
visitas(c2.calcId, 15, 3);  // 3/15 = 20%
visitas(c3.calcId, 12, 2);  // 2/12 ≈ 16,7%

const nCalc = db.prepare('SELECT COUNT(*) n FROM calculadoras').get().n;
const nLead = db.prepare('SELECT COUNT(*) n FROM leads').get().n;
const nVis = db.prepare('SELECT COUNT(*) n FROM visitas').get().n;
console.log(`Seed completado: ${nCalc} calculadoras, ${nLead} leads, ${nVis} visitas.`);
console.log('Ejemplo de precios calculados:');
for (const c of [calc1, calc2, calc3]) {
  const rows = db.prepare('SELECT nombre, precio_min, precio_max FROM leads WHERE calculadora_id = ?').all(c.id);
  rows.forEach(r => console.log(`  · ${r.nombre}: ${r.precio_min}€ – ${r.precio_max}€`));
}
