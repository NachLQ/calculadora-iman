// Cliente API. En dev, Vite hace proxy de /api -> :8765.
// En produccion (build servido por el lanzador) el widget y las paginas
// standalone se sirven desde el mismo origen, via proxy.
export const SERVER = window.location.origin;

async function req(path, opts) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const api = {
  calculadoras: () => req('/api/calculadoras'),
  calculadora: (id) => req(`/api/calculadoras/${id}`),
  crearCalculadora: (body) => req('/api/calculadoras', { method: 'POST', body: JSON.stringify(body) }),
  guardarCalculadora: (id, body) => req(`/api/calculadoras/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  borrarCalculadora: (id) => req(`/api/calculadoras/${id}`, { method: 'DELETE' }),

  crearPaso: (id, body) => req(`/api/calculadoras/${id}/pasos`, { method: 'POST', body: JSON.stringify(body) }),
  guardarPaso: (id, pasoId, body) => req(`/api/calculadoras/${id}/pasos/${pasoId}`, { method: 'PUT', body: JSON.stringify(body) }),
  borrarPaso: (id, pasoId) => req(`/api/calculadoras/${id}/pasos/${pasoId}`, { method: 'DELETE' }),
  guardarReglas: (id, reglas) => req(`/api/calculadoras/${id}/reglas`, { method: 'POST', body: JSON.stringify({ reglas }) }),

  calcular: (slug, configuracion) => req(`/api/calculadora/${slug}/calcular`, { method: 'POST', body: JSON.stringify({ configuracion }) }),

  leads: (filtros = {}) => {
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
    return req('/api/leads' + (qs ? '?' + qs : ''));
  },
  actualizarLead: (id, body) => req(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  estadisticas: () => req('/api/estadisticas')
};
