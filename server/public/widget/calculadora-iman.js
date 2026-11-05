/* Calculadora Imán — widget embebible standalone (sin dependencias).
   Uso:
     <script src="http://localhost:8765/widget/calculadora-iman.js" data-id="reforma-bano"></script>
     <div id="calculadora-iman"></div>
   Opcional: data-slug (alias de data-id) y data-target="id-del-div" para varias en una página. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;
  // Base del servidor: origen desde el que se sirvió este script.
  var BASE = (function () {
    try { return new URL(script.src).origin; } catch (e) { return ''; }
  })();
  var slug = script.getAttribute('data-slug') || script.getAttribute('data-id');
  if (!slug) { console.error('[Calculadora Imán] falta data-id/data-slug'); return; }

  // Resolver contenedor.
  var target = script.getAttribute('data-target');
  var container;
  if (target) {
    container = document.getElementById(target);
  } else {
    var def = document.getElementById('calculadora-iman');
    if (def && !def.getAttribute('data-ci-init')) container = def;
  }
  if (!container) {
    container = document.createElement('div');
    script.parentNode.insertBefore(container, script.nextSibling);
  }
  container.setAttribute('data-ci-init', '1');

  function api(pathname, opts) {
    return fetch(BASE + pathname, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || ''))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function lum(hex) { var c = hex.replace('#',''); if (c.length === 3) c = c.split('').map(function(x){return x+x;}).join(''); var n = [0,2,4].map(function(i){var v=parseInt(c.slice(i,i+2),16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*n[0]+.7152*n[1]+.0722*n[2]; }
  function contraste(a,b) { var x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  function tinta(bg) { return lum(bg)>.179 ? '#000000' : '#ffffff'; }
  function euros(n) { return new Intl.NumberFormat('es-ES').format(Math.round(n)) + ' €'; }

  // Estado del wizard.
  var calc = null, idx = 0, config = {}, visitaId = null, theme = {};

  function start() {
    container.innerHTML = 'Cargando…';
    api('/api/calculadora/' + encodeURIComponent(slug)).then(function (c) {
      calc = c;
      theme = {
        primario: c.color_primario || '#2563eb',
        fondo: c.color_fondo || '#ffffff',
        radius: (c.border_radius != null ? c.border_radius : 6) + 'px',
        texto: tinta(c.color_fondo || '#ffffff'),
        muted: (function(){ var fondo=c.color_fondo||'#ffffff', muted=lum(fondo)>.179?'#475569':'#cbd5e1';return contraste(muted,fondo)>=4.5?muted:tinta(fondo); })(),
        boton: tinta(c.color_primario || '#2563eb'),
        importe: contraste(c.color_primario || '#2563eb', c.color_fondo || '#ffffff')>=4.5 ? (c.color_primario || '#2563eb') : tinta(c.color_fondo || '#ffffff')
      };
      api('/api/calculadora/' + encodeURIComponent(slug) + '/visita', {
        method: 'POST', body: JSON.stringify({ completada: false })
      }).then(function (v) { visitaId = v.visita_id; }).catch(function () {});
      render();
    }).catch(function () {
      container.innerHTML = '<div style="font-family:system-ui;padding:16px;color:#b91c1c">No se pudo cargar la calculadora.</div>';
    });
  }

  function wrap(inner) {
    var box = el('div', {
      style: 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:' + theme.fondo +
        ';border-radius:' + theme.radius + ';border:1px solid #94a3b8;overflow:hidden;max-width:480px;margin:0 auto;color:' + theme.texto + ''
    }, []);
    var head = el('div', {
      style: 'padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px'
    }, [
      calc.logo_url ? el('img', { src: calc.logo_url, alt: calc.nombre, style: 'height:32px;width:auto;border-radius:6px' }) : null,
      el('div', {}, [
        el('div', { style: 'font-weight:700;font-size:15px' }, [calc.nombre]),
        calc.descripcion ? el('div', { style: 'font-size:12px;color:' + theme.muted + '' }, [calc.descripcion]) : null
      ])
    ]);
    box.appendChild(head);
    box.appendChild(inner);
    container.innerHTML = '';
    container.appendChild(box);
  }

  function progress(current, total) {
    var pct = total ? Math.round((current / total) * 100) : 100;
    return el('div', { style: 'height:6px;background:#e2e8f0' }, [
      el('div', { style: 'height:6px;width:' + pct + '%;background:' + theme.primario + ';transition:width .3s' }, [])
    ]);
  }

  function btnPrimario(label, onclick, disabled) {
    return el('button', {
      onclick: onclick, disabled: disabled ? '1' : null,
      style: 'width:100%;padding:14px;border:0;border-radius:' + theme.radius + ';background:' + theme.primario +
        ';color:' + theme.boton + ';font-size:16px;font-weight:600;cursor:' + (disabled ? 'not-allowed' : 'pointer') +
        ';opacity:' + (disabled ? '.5' : '1')
    }, [label]);
  }

  function render() {
    if (idx >= calc.pasos.length) return renderGate();
    var paso = calc.pasos[idx];
    var body = el('div', { style: 'padding:20px' }, []);
    body.appendChild(el('div', { style: 'font-size:12px;color:' + theme.muted + ';margin-bottom:4px' },
      ['Paso ' + (idx + 1) + ' de ' + calc.pasos.length]));
    body.appendChild(el('div', { style: 'font-size:18px;font-weight:700;margin-bottom:4px' }, [paso.titulo]));
    if (paso.descripcion) body.appendChild(el('div', { style: 'font-size:14px;color:' + theme.muted + ';margin-bottom:14px' }, [paso.descripcion]));

    var control = renderControl(paso);
    body.appendChild(control);

    var nav = el('div', { style: 'display:flex;gap:10px;margin-top:18px' }, [
      idx > 0 ? el('button', {
        onclick: function () { idx--; render(); },
        style: 'padding:14px 18px;border:1px solid #cbd5e1;border-radius:' + theme.radius +
          ';background:#fff;color:#111111;font-size:15px;cursor:pointer'
      }, ['Atrás']) : null,
      el('div', { style: 'flex:1' }, [
        btnPrimario(idx === calc.pasos.length - 1 ? 'Continuar' : 'Siguiente', function () {
          if (!valido(paso)) return;
          idx++; render();
        }, false)
      ])
    ]);
    body.appendChild(nav);

    wrap(el('div', {}, [progress(idx, calc.pasos.length), body]));
  }

  function valido(paso) {
    var v = config[paso.id];
    if (paso.tipo === 'seleccion_unica') return v != null;
    if (paso.tipo === 'seleccion_multiple') return Array.isArray(v) && v.length > 0;
    if (paso.tipo === 'numero') return v != null && v !== '';
    if (paso.tipo === 'texto') return true; // texto libre opcional
    return true;
  }

  function renderControl(paso) {
    var box = el('div', {}, []);
    if (paso.tipo === 'seleccion_unica') {
      paso.opciones.forEach(function (op) {
        var sel = Number(config[paso.id]) === op.id;
        box.appendChild(el('button', {
          onclick: function () { config[paso.id] = op.id; render(); },
          style: 'display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin-bottom:10px;padding:14px;' +
            'border:2px solid ' + (sel ? theme.primario : '#e2e8f0') + ';border-radius:' + theme.radius +
            ';background:' + (sel ? theme.primario : '#fff') + ';color:' + (sel ? theme.boton : '#111111') + ';cursor:pointer;font-size:15px'
        }, [
          op.imagen_url ? el('img', { src: op.imagen_url, alt: '', style: 'height:36px;width:36px;object-fit:cover;border-radius:8px' }) : null,
          el('span', { style: 'font-weight:' + (sel ? '700' : '500') }, [op.etiqueta])
        ]));
      });
    } else if (paso.tipo === 'seleccion_multiple') {
      if (!Array.isArray(config[paso.id])) config[paso.id] = [];
      paso.opciones.forEach(function (op) {
        var arr = config[paso.id];
        var sel = arr.indexOf(op.id) >= 0;
        box.appendChild(el('button', {
          onclick: function () {
            var i = arr.indexOf(op.id);
            if (i >= 0) arr.splice(i, 1); else arr.push(op.id);
            render();
          },
          style: 'display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin-bottom:10px;padding:14px;' +
            'border:2px solid ' + (sel ? theme.primario : '#e2e8f0') + ';border-radius:' + theme.radius +
            ';background:' + (sel ? theme.primario : '#fff') + ';color:' + (sel ? theme.boton : '#111111') + ';cursor:pointer;font-size:15px'
        }, [
          el('span', {
            style: 'width:20px;height:20px;border-radius:5px;border:2px solid ' + (sel ? theme.primario : '#cbd5e1') +
              ';background:' + (sel ? theme.primario : '#fff') + ';color:' + theme.boton + ';display:inline-flex;align-items:center;justify-content:center;font-size:13px'
          }, [sel ? '✓' : '']),
          el('span', {}, [op.etiqueta])
        ]));
      });
    } else if (paso.tipo === 'numero') {
      var val = config[paso.id] != null ? config[paso.id] : (paso.num_min != null ? paso.num_min : 1);
      config[paso.id] = val;
      var label = el('div', { style: 'text-align:center;font-size:32px;font-weight:800;margin:8px 0;color:' + theme.importe }, [String(val)]);
      var input = el('input', {
        type: 'range', 'aria-label': paso.titulo, min: paso.num_min != null ? paso.num_min : 0,
        max: paso.num_max != null ? paso.num_max : 100, step: paso.num_paso || 1, value: val,
        style: 'width:100%;accent-color:' + theme.primario,
        oninput: function (e) { config[paso.id] = Number(e.target.value); label.textContent = e.target.value; }
      }, []);
      box.appendChild(label);
      box.appendChild(input);
      box.appendChild(el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;color:' + theme.muted + ';margin-top:6px' },
        [String(paso.num_min != null ? paso.num_min : 0), String(paso.num_max != null ? paso.num_max : 100)]));
    } else if (paso.tipo === 'texto') {
      box.appendChild(el('textarea', {
        rows: '3', placeholder: 'Escribe aquí…', 'aria-label': paso.titulo,
        style: 'width:100%;box-sizing:border-box;padding:12px;border:1px solid #64748b;border-radius:' + theme.radius + ';background:#fff;color:#111111;font-size:15px;font-family:inherit',
        oninput: function (e) { config[paso.id] = e.target.value; }
      }, []));
      if (config[paso.id]) box.querySelector('textarea').value = config[paso.id];
    }
    return box;
  }

  function renderGate() {
    var data = { nombre: '', email: '', telefono: '', urgencia: '' };
    var err = el('div', { style: 'color:' + (lum(theme.fondo)>.179 ? '#b91c1c' : '#fca5a5') + ';font-size:13px;min-height:18px;margin-top:4px' }, []);

    function field(label, key, type, ph) {
      return el('div', { style: 'margin-bottom:12px' }, [
        el('label', { style: 'display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:' + theme.muted + '' }, [label]),
        el('input', {
          type: type || 'text', placeholder: ph || '', 'aria-label': label,
          style: 'width:100%;box-sizing:border-box;padding:12px;border:1px solid #64748b;border-radius:' + theme.radius + ';background:#fff;color:#111111;font-size:15px',
          oninput: function (e) { data[key] = e.target.value; }
        }, [])
      ]);
    }

    var sel = el('select', { 'aria-label': '¿Cuándo necesitas el servicio?',
      style: 'width:100%;box-sizing:border-box;padding:12px;border:1px solid #64748b;border-radius:' + theme.radius + ';background:#fff;color:#111111;font-size:15px',
      onchange: function (e) { data.urgencia = e.target.value; }
    }, [
      el('option', { value: '' }, ['Selecciona…']),
      el('option', { value: 'urgente' }, ['Urgente']),
      el('option', { value: 'proximo_mes' }, ['En el próximo mes']),
      el('option', { value: 'tres_meses' }, ['En los próximos 3 meses']),
      el('option', { value: 'explorando' }, ['Todavía explorando'])
    ]);

    var body = el('div', { style: 'padding:20px' }, [
      el('div', { style: 'text-align:center;margin-bottom:16px' }, [
        el('div', { style: 'font-size:19px;font-weight:800' }, ['Tu presupuesto está listo']),
        el('div', { style: 'font-size:14px;color:' + theme.muted + ';margin-top:4px' },
          ['Déjanos tu contacto y te mostramos el precio estimado al instante.'])
      ]),
      field('Nombre *', 'nombre', 'text', 'Tu nombre'),
      field('Email', 'email', 'email', 'tucorreo@ejemplo.com'),
      field('Teléfono', 'telefono', 'tel', '600 000 000'),
      el('div', { style: 'margin-bottom:6px' }, [
        el('label', { style: 'display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:' + theme.muted + '' },
          ['¿Cuándo necesitas el servicio?']),
        sel
      ]),
      err,
      el('div', { style: 'margin-top:8px' }, [
        btnPrimario('Ver mi presupuesto estimado', function () {
          if (!data.nombre.trim()) { err.textContent = 'El nombre es obligatorio.'; return; }
          if (!data.email.trim() && !data.telefono.trim()) { err.textContent = 'Indica email o teléfono.'; return; }
          err.textContent = '';
          enviarLead(data);
        }, false)
      ]),
      calc.pasos.length ? el('button', {
        onclick: function () { idx = calc.pasos.length - 1; render(); },
        style: 'width:100%;margin-top:8px;background:none;border:0;color:' + theme.muted + ';font-size:13px;cursor:pointer'
      }, ['‹ Volver atrás']) : null
    ]);

    wrap(el('div', {}, [progress(calc.pasos.length, calc.pasos.length), body]));
  }

  function enviarLead(data) {
    api('/api/calculadora/' + encodeURIComponent(slug) + '/lead', {
      method: 'POST',
      body: JSON.stringify({
        nombre: data.nombre, email: data.email, telefono: data.telefono,
        urgencia: data.urgencia || null, configuracion: config, visita_id: visitaId
      })
    }).then(renderResultado).catch(function (e) {
      alert('No se pudo enviar: ' + ((e && e.error) || 'error'));
    });
  }

  function renderResultado(res) {
    var body = el('div', { style: 'padding:28px 20px;text-align:center' }, [
      el('div', { style: 'font-size:14px;color:' + theme.muted + ';margin-bottom:6px' }, ['Tu proyecto costaría entre']),
      el('div', { style: 'font-size:30px;font-weight:900;color:' + theme.importe }, [euros(res.precio_min) + ' – ' + euros(res.precio_max)]),
      el('div', { style: 'font-size:14px;color:' + theme.muted + ';margin-top:14px;line-height:1.4' }, [res.texto_confirmacion]),
      el('div', { style: 'font-size:12px;color:' + theme.muted + ';margin-top:18px' }, ['Presupuesto orientativo. Nos pondremos en contacto contigo.'])
    ]);
    // marca visita completada/convertida ya hecho en el POST lead
    wrap(el('div', {}, [progress(1, 1), body]));
  }

  start();
})();
