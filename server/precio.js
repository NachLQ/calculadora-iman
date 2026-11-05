// Motor de cálculo de precio. Pura: recibe la calculadora completa y la configuración del visitante.
//
// configuracion = { [paso_id]: valor }
//   seleccion_unica   -> opcion_id (number)
//   seleccion_multiple -> [opcion_id, ...]
//   numero            -> number
//   texto             -> string (no afecta al precio)
//
// Reglas:
//   suma_fija    -> si la opción/paso está seleccionado, suma `importe`
//   multiplicador-> multiplica el subtotal acumulado por (valor_numerico de la opción elegida)
//                   o por `importe` si no hay opción asociada
//   por_unidad   -> importe * número introducido en el paso

function calcular(calc, configuracion) {
  const cfg = configuracion || {};
  const opcionesPorId = {};
  const pasosPorId = {};
  for (const paso of calc.pasos) {
    pasosPorId[paso.id] = paso;
    for (const op of paso.opciones || []) opcionesPorId[op.id] = op;
  }

  const seleccionada = (opcionId) => {
    for (const paso of calc.pasos) {
      const v = cfg[paso.id];
      if (paso.tipo === 'seleccion_unica' && Number(v) === opcionId) return true;
      if (paso.tipo === 'seleccion_multiple' && Array.isArray(v) && v.map(Number).includes(opcionId)) return true;
    }
    return false;
  };

  let total = Number(calc.precio_base) || 0;
  const multiplicadores = [];

  for (const r of calc.reglas) {
    if (r.tipo === 'suma_fija') {
      if (r.opcion_id) {
        if (seleccionada(r.opcion_id)) total += Number(r.importe) || 0;
      } else {
        total += Number(r.importe) || 0;
      }
    } else if (r.tipo === 'por_unidad') {
      const paso = pasosPorId[r.paso_id];
      if (paso && paso.tipo === 'numero') {
        const n = Number(cfg[paso.id]) || 0;
        total += (Number(r.importe) || 0) * n;
      }
    } else if (r.tipo === 'multiplicador') {
      // Se aplica al final, sobre el subtotal acumulado.
      if (r.opcion_id) {
        if (seleccionada(r.opcion_id)) {
          const op = opcionesPorId[r.opcion_id];
          multiplicadores.push(op ? (Number(op.valor_numerico) || 1) : (Number(r.importe) || 1));
        }
      } else {
        multiplicadores.push(Number(r.importe) || 1);
      }
    }
  }

  for (const m of multiplicadores) total *= m;

  const margen = (Number(calc.margen_rango_porcentaje) || 0) / 100;
  const precio_min = Math.round(total * (1 - margen));
  const precio_max = Math.round(total * (1 + margen));
  return { precio_estimado: Math.round(total), precio_min, precio_max };
}

module.exports = { calcular };
