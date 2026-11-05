import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, euros } from '../ui.jsx';

export default function Estadisticas() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.estadisticas().then(setStats).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="text-red-600 dark:text-red-400">Error: {err}. ¿Está el servidor en marcha?</p>;
  if (!stats) return <p className="text-paper-muted dark:text-ink-muted">Cargando…</p>;

  const { totales, por_calculadora, serie_semanal } = stats;
  const maxSerie = Math.max(1, ...serie_semanal.map((d) => d.leads));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Estadísticas</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Kpi n={totales.visitas} l="Visitas totales" icon="" />
        <Kpi n={totales.leads} l="Leads captados" icon="" />
        <Kpi n={totales.conversion + '%'} l="Conversión visita → lead" icon="" />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-bold mb-3">Leads de los últimos 7 días</h2>
        <div className="flex items-end gap-2 h-32">
          {serie_semanal.map((d) => (
            <div key={d.fecha} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-xs font-semibold text-paper-muted dark:text-ink-muted mb-1">{d.leads || ''}</div>
              <div
                className="w-full max-w-[48px] bg-blue-500 rounded-t"
                style={{ height: `${Math.round((d.leads / maxSerie) * 100)}%`, minHeight: d.leads ? 6 : 2, opacity: d.leads ? 1 : 0.15 }}
                title={`${d.fecha}: ${d.leads} leads`}
              />
              <div className="text-[10px] text-paper-muted dark:text-ink-muted mt-1">{diaCorto(d.fecha)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold mb-3">Por calculadora</h2>
        {por_calculadora.length === 0 && <p className="text-paper-muted dark:text-ink-muted text-sm">Aún no tienes calculadoras.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-paper-muted dark:text-ink-muted border-b border-paper-card dark:border-ink-card">
                <th className="py-2 pr-3">Calculadora</th>
                <th className="py-2 px-3 text-right">Visitas</th>
                <th className="py-2 px-3 text-right">Leads</th>
                <th className="py-2 px-3 text-right">Conversión</th>
                <th className="py-2 pl-3 text-right">Valor estimado (30 días)</th>
              </tr>
            </thead>
            <tbody>
              {por_calculadora.map((c) => (
                <tr key={c.id} className="border-b border-paper-card dark:border-ink-card last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{c.nombre}</td>
                  <td className="py-2.5 px-3 text-right">{c.visitas}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{c.leads}</td>
                  <td className="py-2.5 px-3 text-right">{c.conversion}%</td>
                  <td className="py-2.5 pl-3 text-right font-semibold">{euros(c.valor_estimado_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-paper-dim dark:text-ink-dim mt-3">
          El valor estimado es la media del rango de presupuesto de cada lead captado en los últimos 30 días.
        </p>
      </Card>
    </div>
  );
}

function Kpi({ n, l, icon }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold leading-tight">{n}</div>
        <div className="text-xs text-paper-muted dark:text-ink-muted">{l}</div>
      </div>
    </Card>
  );
}

function diaCorto(fecha) {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short' });
}
