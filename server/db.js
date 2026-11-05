const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS calculadoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  color_primario TEXT NOT NULL DEFAULT '#2563eb',
  color_fondo TEXT NOT NULL DEFAULT '#ffffff',
  border_radius INTEGER NOT NULL DEFAULT 12,
  logo_url TEXT,
  texto_confirmacion TEXT NOT NULL DEFAULT '¡Gracias! Aquí tienes tu presupuesto estimado.',
  margen_rango_porcentaje REAL NOT NULL DEFAULT 15,
  precio_base REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pasos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculadora_id INTEGER NOT NULL REFERENCES calculadoras(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('seleccion_unica','seleccion_multiple','numero','texto')),
  num_min REAL,
  num_max REAL,
  num_paso REAL
);

CREATE TABLE IF NOT EXISTS opciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paso_id INTEGER NOT NULL REFERENCES pasos(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL,
  valor_numerico REAL NOT NULL DEFAULT 0,
  imagen_url TEXT,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reglas_precio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculadora_id INTEGER NOT NULL REFERENCES calculadoras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('suma_fija','multiplicador','por_unidad')),
  paso_id INTEGER REFERENCES pasos(id) ON DELETE CASCADE,
  opcion_id INTEGER REFERENCES opciones(id) ON DELETE CASCADE,
  importe REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculadora_id INTEGER NOT NULL REFERENCES calculadoras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  urgencia TEXT,
  precio_min REAL,
  precio_max REAL,
  configuracion_json TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','presupuesto','cerrado','descartado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculadora_id INTEGER NOT NULL REFERENCES calculadoras(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  completada INTEGER NOT NULL DEFAULT 0,
  convertida INTEGER NOT NULL DEFAULT 0
);
`);

module.exports = db;
