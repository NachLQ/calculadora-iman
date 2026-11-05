import { useEffect, useState } from 'react';
import { api, SERVER } from '../api.js';
import { Card, Button, Badge, euros } from '../ui.jsx';

export default function Calculadoras({ onEditar }) {
  const [lista, setLista] = useState(null);
  const [err, setErr] = useState('');

  const cargar = () => api.calculadoras().then(setLista).catch((e) => setErr(e.message));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    try {
      const c = await api.crearCalculadora({ nombre: 'Nueva calculadora' });
      onEditar(c.id);
    } catch (e) {
      setErr(e.message);
    }
  };

  const borrar = async (id, nombre) => {
    if (!confirm(`¿Borrar "${nombre}" y todos sus leads?`)) return;
    try {
      await api.borrarCalculadora(id);
      cargar();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (err) return <p className="text-red-600 dark:text-red-400">Error: {err}. ¿Está el servidor en marcha en :8765?</p>;
  if (!lista) return <p className="text-paper-muted dark:text-ink-muted">Cargando…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tus calculadoras</h1>
        <Button onClick={crear}>+ Nueva calculadora</Button>
      </div>

      {lista.length === 0 && <p className="text-paper-muted dark:text-ink-muted">Aún no tienes calculadoras. Crea la primera.</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {lista.map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color_primario }} />
                  <h2 className="font-bold text-lg">{c.nombre}</h2>
                  {c.activa ? <Badge cls="bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300">Activa</Badge>
                    : <Badge cls="bg-paper-card dark:bg-ink-card text-paper-muted dark:text-ink-muted">Inactiva</Badge>}
                </div>
                <p className="text-sm text-paper-muted dark:text-ink-muted mt-1">{c.descripcion}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 my-4 text-center">
              <Stat n={c.stats.visitas} l="Visitas" />
              <Stat n={c.stats.leads} l="Leads" />
              <Stat n={c.stats.conversion + '%'} l="Conversión" />
              <Stat n={euros(c.stats.valor_estimado_mes)} l="Valor/mes" small />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-paper-muted dark:text-ink-muted mb-3">
              <span className="font-mono bg-paper-card dark:bg-ink-card px-2 py-1 rounded">/{c.slug}</span>
              <a className="text-blue-600 hover:underline" href={`${SERVER}/c/${c.slug}`} target="_blank" rel="noreferrer">Abrir standalone </a>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => onEditar(c.id)}>Editar / Constructor</Button>
              <Button variant="ghost" onClick={() => navigator.clipboard.writeText(snippet(c.slug))}>Copiar snippet</Button>
              <Button variant="danger" onClick={() => borrar(c.id, c.nombre)}>Borrar</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l, small }) {
  return (
    <div className="bg-paper-card dark:bg-ink-card rounded-lg py-2">
      <div className={`font-bold ${small ? 'text-sm' : 'text-xl'}`}>{n}</div>
      <div className="text-[11px] text-paper-muted dark:text-ink-muted">{l}</div>
    </div>
  );
}

function snippet(slug) {
  return `<script src="${SERVER}/widget/calculadora-iman.js" data-id="${slug}"></script>\n<div id="calculadora-iman"></div>`;
}
