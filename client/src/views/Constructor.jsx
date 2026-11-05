import { useEffect, useState } from 'react';
import { api, SERVER } from '../api.js';
import { Card, Button, Input, Label } from '../ui.jsx';

const uid = () => Math.random().toString(36).slice(2, 9);
const TIPOS_PASO = {
  seleccion_unica: 'Selección única',
  seleccion_multiple: 'Selección múltiple',
  numero: 'Número',
  texto: 'Texto libre'
};
const TIPOS_REGLA = { suma_fija: 'Suma fija', multiplicador: 'Multiplicador', por_unidad: 'Por unidad' };

export default function Constructor({ id, onClose }) {
  const [meta, setMeta] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [origPasoIds, setOrigPasoIds] = useState([]);
  const [slug, setSlug] = useState('');
  const [nonce, setNonce] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  async function cargar() {
    setErrorCarga('');
    try {
      await cargarInterno();
    } catch (e) {
      setErrorCarga(e.message || 'No se ha podido cargar la calculadora.');
    }
  }

  async function cargarInterno() {
    const c = await api.calculadora(id);
    setSlug(c.slug);
    setMeta({
      nombre: c.nombre, descripcion: c.descripcion || '', activa: !!c.activa,
      precio_base: c.precio_base, margen_rango_porcentaje: c.margen_rango_porcentaje,
      color_primario: c.color_primario, color_fondo: c.color_fondo, border_radius: c.border_radius,
      logo_url: c.logo_url || '', texto_confirmacion: c.texto_confirmacion
    });
    const pasoKeyById = {}, opKeyById = {};
    const ps = c.pasos.map((p) => {
      const pk = uid();
      pasoKeyById[p.id] = pk;
      const ops = (p.opciones || []).map((o) => {
        const ok = uid(); opKeyById[o.id] = ok;
        return { _key: ok, etiqueta: o.etiqueta, valor_numerico: o.valor_numerico, imagen_url: o.imagen_url || '' };
      });
      return { _key: pk, id: p.id, titulo: p.titulo, descripcion: p.descripcion || '', tipo: p.tipo,
        num_min: p.num_min, num_max: p.num_max, num_paso: p.num_paso, opciones: ops };
    });
    setPasos(ps);
    setOrigPasoIds(c.pasos.map((p) => p.id));
    setReglas((c.reglas || []).map((r) => ({
      _key: uid(), tipo: r.tipo,
      pasoKey: r.paso_id ? pasoKeyById[r.paso_id] : (r.opcion_id ? pasoDeOpcion(c, r.opcion_id, pasoKeyById) : ''),
      opcionKey: r.opcion_id ? opKeyById[r.opcion_id] : '',
      importe: r.importe
    })));
  }

  // ---------- pasos ----------
  const updPaso = (k, patch) => setPasos((ps) => ps.map((p) => (p._key === k ? { ...p, ...patch } : p)));
  const addPaso = () => setPasos((ps) => [...ps, { _key: uid(), titulo: 'Nuevo paso', descripcion: '', tipo: 'seleccion_unica', opciones: [], num_min: 1, num_max: 10, num_paso: 1 }]);
  const delPaso = (k) => setPasos((ps) => ps.filter((p) => p._key !== k));
  const addOpcion = (pk) => updPaso(pk, { opciones: [...findPaso(pk).opciones, { _key: uid(), etiqueta: 'Opción', valor_numerico: 0, imagen_url: '' }] });
  const updOpcion = (pk, ok, patch) => updPaso(pk, { opciones: findPaso(pk).opciones.map((o) => (o._key === ok ? { ...o, ...patch } : o)) });
  const delOpcion = (pk, ok) => updPaso(pk, { opciones: findPaso(pk).opciones.filter((o) => o._key !== ok) });
  const findPaso = (pk) => pasos.find((p) => p._key === pk);

  // ---------- reglas ----------
  const addRegla = () => setReglas((r) => [...r, { _key: uid(), tipo: 'suma_fija', pasoKey: '', opcionKey: '', importe: 0 }]);
  const updRegla = (k, patch) => setReglas((rs) => rs.map((r) => (r._key === k ? { ...r, ...patch } : r)));
  const delRegla = (k) => setReglas((rs) => rs.filter((r) => r._key !== k));

  async function guardar() {
    setGuardando(true); setMsg('');
    try {
      await api.guardarCalculadora(id, { ...meta, border_radius: Number(meta.border_radius), precio_base: Number(meta.precio_base), margen_rango_porcentaje: Number(meta.margen_rango_porcentaje), logo_url: meta.logo_url || null });
      // borrar pasos eliminados
      for (const oid of origPasoIds) if (!pasos.find((p) => p.id === oid)) await api.borrarPaso(id, oid);
      // upsert pasos
      const keyToIds = {};
      const nuevosPasos = [];
      for (let i = 0; i < pasos.length; i++) {
        const p = pasos[i];
        const payload = {
          orden: i, titulo: p.titulo, descripcion: p.descripcion, tipo: p.tipo,
          num_min: p.tipo === 'numero' ? Number(p.num_min) : null,
          num_max: p.tipo === 'numero' ? Number(p.num_max) : null,
          num_paso: p.tipo === 'numero' ? Number(p.num_paso) : null,
          opciones: (p.tipo === 'seleccion_unica' || p.tipo === 'seleccion_multiple')
            ? p.opciones.map((o, j) => ({ etiqueta: o.etiqueta, valor_numerico: Number(o.valor_numerico) || 0, imagen_url: o.imagen_url || null, orden: j }))
            : []
        };
        const saved = typeof p.id === 'number' ? await api.guardarPaso(id, p.id, payload) : await api.crearPaso(id, payload);
        const opIds = {};
        p.opciones.forEach((o, j) => { opIds[o._key] = saved.opciones[j] && saved.opciones[j].id; });
        keyToIds[p._key] = { pasoId: saved.id, opIds };
        nuevosPasos.push({ ...p, id: saved.id });
      }
      // reglas resueltas
      const reglasResueltas = reglas.filter((r) => r.tipo).map((r) => {
        const refs = r.pasoKey ? keyToIds[r.pasoKey] : null;
        return {
          tipo: r.tipo,
          paso_id: refs ? refs.pasoId : null,
          opcion_id: refs && r.opcionKey ? refs.opIds[r.opcionKey] : null,
          importe: Number(r.importe) || 0
        };
      });
      await api.guardarReglas(id, reglasResueltas);
      setPasos(nuevosPasos);
      setOrigPasoIds(nuevosPasos.map((p) => p.id));
      const c = await api.calculadora(id);
      setSlug(c.slug);
      setNonce((n) => n + 1);
      setMsg('Guardado ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (errorCarga) return (
    <div className="text-center py-8 space-y-2">
      <p className="text-sm text-red-600 dark:text-red-400">{errorCarga}</p>
      <button onClick={cargar} className="text-sm text-marca-600 dark:text-accent-light underline">Reintentar</button>
    </div>
  );
  if (!meta) return <p className="text-paper-muted dark:text-ink-muted">Cargando constructor…</p>;
  const pasosSeleccionables = pasos;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-sm text-paper-muted dark:text-ink-muted hover:text-paper-text dark:text-ink-text">‹ Volver a calculadoras</button>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{msg}</span>}
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* ---------- columna izquierda: configuración ---------- */}
        <div className="space-y-4">
          {/* Ajustes generales */}
          <Card className="p-5">
            <h3 className="font-bold mb-3">Ajustes generales</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nombre</Label><Input value={meta.nombre} onChange={(e) => setMeta({ ...meta, nombre: e.target.value })} /></div>
              <div className="col-span-2"><Label>Descripción</Label><Input value={meta.descripcion} onChange={(e) => setMeta({ ...meta, descripcion: e.target.value })} /></div>
              <div><Label>Precio base (€)</Label><Input type="number" value={meta.precio_base} onChange={(e) => setMeta({ ...meta, precio_base: e.target.value })} /></div>
              <div><Label>Margen del rango (±%)</Label><Input type="number" value={meta.margen_rango_porcentaje} onChange={(e) => setMeta({ ...meta, margen_rango_porcentaje: e.target.value })} /></div>
              <div className="col-span-2"><Label>Texto de confirmación</Label><Input value={meta.texto_confirmacion} onChange={(e) => setMeta({ ...meta, texto_confirmacion: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={meta.activa} onChange={(e) => setMeta({ ...meta, activa: e.target.checked })} />
                Calculadora activa (visible públicamente)
              </label>
            </div>
          </Card>

          {/* Estilos */}
          <Card className="p-5">
            <h3 className="font-bold mb-3">Estilos del widget</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Color primario</Label><input type="color" value={meta.color_primario} onChange={(e) => setMeta({ ...meta, color_primario: e.target.value })} className="w-full h-9 rounded border border-paper-card dark:border-ink-card" /></div>
              <div><Label>Color de fondo</Label><input type="color" value={meta.color_fondo} onChange={(e) => setMeta({ ...meta, color_fondo: e.target.value })} className="w-full h-9 rounded border border-paper-card dark:border-ink-card" /></div>
              <div><Label>Radio de borde (px)</Label><Input type="number" value={meta.border_radius} onChange={(e) => setMeta({ ...meta, border_radius: e.target.value })} /></div>
              <div><Label>Logo (URL)</Label><Input value={meta.logo_url} onChange={(e) => setMeta({ ...meta, logo_url: e.target.value })} placeholder="https://…" /></div>
            </div>
          </Card>

          {/* Pasos */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Pasos de configuración</h3>
              <Button variant="ghost" onClick={addPaso}>+ Añadir paso</Button>
            </div>
            <div className="space-y-4">
              {pasos.map((p, i) => (
                <div key={p._key} className="border border-paper-card dark:border-ink-card rounded-lg p-3 bg-paper-card dark:bg-ink-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-paper-dim dark:text-ink-dim">PASO {i + 1}</span>
                    <button onClick={() => delPaso(p._key)} className="text-xs text-red-500 dark:text-red-400 hover:underline">Eliminar</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2"><Label>Título</Label><Input value={p.titulo} onChange={(e) => updPaso(p._key, { titulo: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Descripción</Label><Input value={p.descripcion} onChange={(e) => updPaso(p._key, { descripcion: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Tipo</Label>
                      <select value={p.tipo} onChange={(e) => updPaso(p._key, { tipo: e.target.value })} className="w-full px-3 py-2 border border-paper-card dark:border-ink-card rounded-lg text-sm bg-paper-surface dark:bg-ink-surface">
                        {Object.entries(TIPOS_PASO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  {p.tipo === 'numero' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div><Label>Mín</Label><Input type="number" value={p.num_min ?? 0} onChange={(e) => updPaso(p._key, { num_min: e.target.value })} /></div>
                      <div><Label>Máx</Label><Input type="number" value={p.num_max ?? 0} onChange={(e) => updPaso(p._key, { num_max: e.target.value })} /></div>
                      <div><Label>Paso</Label><Input type="number" value={p.num_paso ?? 1} onChange={(e) => updPaso(p._key, { num_paso: e.target.value })} /></div>
                    </div>
                  )}

                  {(p.tipo === 'seleccion_unica' || p.tipo === 'seleccion_multiple') && (
                    <div className="mt-2">
                      <Label>Opciones (etiqueta · valor numérico · imagen URL)</Label>
                      {p.opciones.map((o) => (
                        <div key={o._key} className="flex gap-1 mb-1">
                          <Input value={o.etiqueta} onChange={(e) => updOpcion(p._key, o._key, { etiqueta: e.target.value })} placeholder="Etiqueta" />
                          <Input type="number" className="w-24" value={o.valor_numerico} onChange={(e) => updOpcion(p._key, o._key, { valor_numerico: e.target.value })} placeholder="valor" />
                          <Input className="w-28" value={o.imagen_url} onChange={(e) => updOpcion(p._key, o._key, { imagen_url: e.target.value })} placeholder="img URL" />
                          <button aria-label="Eliminar opción" onClick={() => delOpcion(p._key, o._key)} className="px-2 text-red-500 dark:text-red-400">✕</button>
                        </div>
                      ))}
                      <button onClick={() => addOpcion(p._key)} className="text-xs text-blue-600 hover:underline mt-1">+ Añadir opción</button>
                    </div>
                  )}
                </div>
              ))}
              {pasos.length === 0 && <p className="text-sm text-paper-dim dark:text-ink-dim">Sin pasos todavía.</p>}
            </div>
          </Card>

          {/* Reglas */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">Reglas de precio</h3>
              <Button variant="ghost" onClick={addRegla}>+ Añadir regla</Button>
            </div>
            <p className="text-xs text-paper-muted dark:text-ink-muted mb-3">
              Precio = base + sumas fijas + (precio por unidad × número), todo multiplicado por los multiplicadores.
              En multiplicador se usa el <em>valor numérico</em> de la opción elegida.
            </p>
            <div className="space-y-2">
              {reglas.map((r) => {
                const paso = pasos.find((p) => p._key === r.pasoKey);
                const esNumero = paso && paso.tipo === 'numero';
                const tieneOpciones = paso && (paso.tipo === 'seleccion_unica' || paso.tipo === 'seleccion_multiple');
                return (
                  <div key={r._key} className="flex flex-wrap items-center gap-1 border border-paper-card dark:border-ink-card rounded-lg p-2">
                    <select value={r.tipo} onChange={(e) => updRegla(r._key, { tipo: e.target.value })} className="px-2 py-1.5 border border-paper-card dark:border-ink-card rounded text-sm bg-paper-surface dark:bg-ink-surface">
                      {Object.entries(TIPOS_REGLA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={r.pasoKey} onChange={(e) => updRegla(r._key, { pasoKey: e.target.value, opcionKey: '' })} className="px-2 py-1.5 border border-paper-card dark:border-ink-card rounded text-sm bg-paper-surface dark:bg-ink-surface">
                      <option value="">— paso —</option>
                      {pasosSeleccionables.map((p, i) => <option key={p._key} value={p._key}>{i + 1}. {p.titulo}</option>)}
                    </select>
                    {tieneOpciones && r.tipo !== 'por_unidad' && (
                      <select value={r.opcionKey} onChange={(e) => updRegla(r._key, { opcionKey: e.target.value })} className="px-2 py-1.5 border border-paper-card dark:border-ink-card rounded text-sm bg-paper-surface dark:bg-ink-surface">
                        <option value="">— opción —</option>
                        {paso.opciones.map((o) => <option key={o._key} value={o._key}>{o.etiqueta}</option>)}
                      </select>
                    )}
                    {(r.tipo === 'suma_fija' || r.tipo === 'por_unidad' || (r.tipo === 'multiplicador' && !r.opcionKey)) && (
                      <Input type="number" className="w-24" value={r.importe} onChange={(e) => updRegla(r._key, { importe: e.target.value })}
                        placeholder={r.tipo === 'por_unidad' ? '€/ud' : r.tipo === 'multiplicador' ? '×' : '€'} />
                    )}
                    {esNumero && r.tipo !== 'por_unidad' && <span className="text-[11px] text-amber-600">usa “Por unidad” para pasos número</span>}
                    <button aria-label="Eliminar regla" onClick={() => delRegla(r._key)} className="ml-auto px-2 text-red-500 dark:text-red-400">✕</button>
                  </div>
                );
              })}
              {reglas.length === 0 && <p className="text-sm text-paper-dim dark:text-ink-dim">Sin reglas: el precio será siempre el precio base.</p>}
            </div>
          </Card>
        </div>

        {/* ---------- columna derecha: vista previa en vivo ---------- */}
        <div className="lg:sticky lg:top-20">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="font-bold text-sm">Vista previa del widget</h3>
              <span className="text-[11px] text-paper-dim dark:text-ink-dim">se actualiza al guardar</span>
            </div>
            <iframe key={nonce} title="preview" src={`${SERVER}/c/${slug}`} className="w-full rounded-lg border border-paper-card dark:border-ink-card" style={{ height: 560 }} />
            <p className="text-[11px] text-paper-dim dark:text-ink-dim mt-2 px-1">Standalone: <a className="text-blue-600" href={`${SERVER}/c/${slug}`} target="_blank" rel="noreferrer">/c/{slug}</a></p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function pasoDeOpcion(calc, opcionId, pasoKeyById) {
  for (const p of calc.pasos) if ((p.opciones || []).some((o) => o.id === opcionId)) return pasoKeyById[p.id];
  return '';
}
