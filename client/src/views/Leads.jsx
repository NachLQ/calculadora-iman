import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Badge, Label, euros, URGENCIAS, ESTADOS } from '../ui.jsx';

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [calcs, setCalcs] = useState([]);
  const [filtros, setFiltros] = useState({ calculadora_id: '', urgencia: '', estado: '' });
  const [abierto, setAbierto] = useState(null); // id del lead expandido
  const [err, setErr] = useState('');

  const cargar = (f = filtros) => api.leads(f).then(setLeads).catch((e) => setErr(e.message));

  useEffect(() => { api.calculadoras().then(setCalcs).catch(() => {}); }, []);
  useEffect(() => { cargar(); }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFiltro = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));

  const cambiarEstado = async (id, estado) => {
    try {
      await api.actualizarLead(id, { estado });
      cargar();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (err) return <p className="text-red-600 dark:text-red-400">Error: {err}. ¿Está el servidor en marcha?</p>;
  if (!leads) return <p className="text-paper-muted dark:text-ink-muted">Cargando…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Bandeja de leads</h1>
        <span className="text-sm text-paper-muted dark:text-ink-muted">{leads.length} lead{leads.length === 1 ? '' : 's'}</span>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Calculadora</Label>
            <Select value={filtros.calculadora_id} onChange={(v) => setFiltro('calculadora_id', v)}>
              <option value="">Todas</option>
              {calcs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>
          <div>
            <Label>Urgencia</Label>
            <Select value={filtros.urgencia} onChange={(v) => setFiltro('urgencia', v)}>
              <option value="">Todas</option>
              {Object.entries(URGENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={filtros.estado} onChange={(v) => setFiltro('estado', v)}>
              <option value="">Todos</option>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {leads.length === 0 && (
        <p className="text-paper-muted dark:text-ink-muted">
          No hay leads{Object.values(filtros).some(Boolean) ? ' con esos filtros' : ' todavía. Comparte tu calculadora para captar los primeros'}.
        </p>
      )}

      <div className="space-y-3">
        {leads.map((l) => (
          <Card key={l.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold">{l.nombre}</h2>
                  {l.urgencia === 'urgente' && <Badge cls="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300">Urgente</Badge>}
                  {l.urgencia && l.urgencia !== 'urgente' && <Badge>{URGENCIAS[l.urgencia] || l.urgencia}</Badge>}
                </div>
                <div className="text-sm text-paper-muted dark:text-ink-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {l.email && <a className="text-blue-600 hover:underline" href={`mailto:${l.email}`}>{l.email}</a>}
                  {l.telefono && <a className="text-blue-600 hover:underline" href={`tel:${l.telefono.replace(/\s/g, '')}`}>{l.telefono}</a>}
                  <span>{l.calculadora_nombre}</span>
                  <span>{fecha(l.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  <div className="font-bold whitespace-nowrap">{euros(l.precio_min)} – {euros(l.precio_max)}</div>
                  <div className="text-[11px] text-paper-muted dark:text-ink-muted">presupuesto estimado</div>
                </div>
                <select
                  value={l.estado}
                  onChange={(e) => cambiarEstado(l.id, e.target.value)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${(ESTADOS[l.estado] || ESTADOS.nuevo).cls}`}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {(l.respuestas || []).length > 0 && (
              <div className="mt-2">
                <button className="text-xs text-blue-600 hover:underline"
                  onClick={() => setAbierto(abierto === l.id ? null : l.id)}>
                  {abierto === l.id ? 'Ocultar respuestas ▲' : 'Ver respuestas ▼'}
                </button>
                {abierto === l.id && (
                  <div className="mt-2 grid sm:grid-cols-2 gap-1 text-sm bg-paper-card dark:bg-ink-card rounded-lg p-3">
                    {l.respuestas.map((r) => (
                      <div key={r.pregunta}><span className="text-paper-muted dark:text-ink-muted">{r.pregunta}:</span> <span className="font-medium">{r.respuesta}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-paper-card dark:border-ink-card rounded-lg text-sm bg-paper-surface dark:bg-ink-surface focus:outline-none focus:ring-2 focus:ring-accent/40">
      {children}
    </select>
  );
}

function fecha(sql) {
  if (!sql) return '';
  const d = new Date(sql.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
