# Calculadora Imán

## Paquete e instrucciones de arranque

La tienda ofrece autoservicio (39 €) e instalación asistida (179 €). Las instrucciones de Node.js, npm e INICIAR.bat de este README corresponden al kit de código fuente. Para el instalador Windows, sigue la guía incluida en el paquete; no necesitas instalar Node.js por separado.

Widget de pre-presupuesto embebible que captura leads. El visitante configura su proyecto paso a paso, obtiene un rango de precio estimado, y lo ve solo tras dejar su contacto. El negocio recibe el lead con todo lo que configuró.

**Para quién:** cualquier negocio de servicios con web (reformas, coaching, mantenimiento técnico, academias). También vendible como servicio de configuración B2B.

## Stack

- Frontend: React 18 + Vite + Tailwind CSS (`/client`)
- Backend: Node.js + Express + SQLite via better-sqlite3 (`/server`)
- Widget: bundle JS con snippet de prueba local. El alojamiento y la integración en una web pública no están incluidos.

## 🚀 Arranque rápido (sin terminal)

Doble clic en **INICIAR.bat**. La primera vez instala las dependencias solo (puede tardar 1-3 minutos) y abre el navegador en `http://localhost:5173` en cuanto está listo.

Si prefieres hacerlo a mano o eres desarrollador, sigue leyendo.

## Instalación

```bash
npm install
npm run dev
```

El panel de administración abre en `http://localhost:5173`. El servidor API corre en `http://localhost:8765`.

## Cómo crear una calculadora

1. Panel → Nueva calculadora
2. Define pasos (selección única, múltiple, número o texto libre)
3. Configura reglas de precio (base fija + multiplicadores + sumas por opción)
4. Ajusta el margen del estimado (±10%, ±20%, ±30% o personalizado)
5. Copia el snippet del widget

## Cómo embeber el widget

```html
<script src="http://localhost:8765/widget/calculadora-iman.js" data-id="[ID_CALCULADORA]"></script>
<div id="calculadora-iman"></div>
```

El snippet de ejemplo sirve para probar el widget en este equipo. La instalación local no publica la calculadora en internet ni incluye alojamiento o integración en una web externa.

## Página standalone

La página /c/[slug-calculadora] permite una vista previa local. Una dirección localhost solo funciona en el equipo que ejecuta la app; no es un enlace público para clientes.

## Gestión de leads

Panel → Leads. Filtra por calculadora y urgencia. Estados: nuevo / contactado / presupuesto enviado / cerrado / descartado.

## Estadísticas

Panel → Estadísticas. Muestra visitas, leads, tasa de conversión y valor estimado total por calculadora. Gráfico semanal de leads.

## Seed demo incluido

3 calculadoras preconfiguradas con datos realistas:

- **Reforma de baño** — precio por m2 + servicios + calidad de materiales. Base 800€, margen ±15%.
- **Programa de coaching de negocio** — situación actual + necesidad + dedicación semanal. Base 500€, margen ±20%.
- **Mantenimiento de climatización** — nº de unidades + tipo de equipo + extras. Base 60€/unidad, margen ±10%.

8 leads seed repartidos entre las 3 calculadoras. 30-50 visitas seed por calculadora (conversión 15-25%).

Página de demo: `demo.html` en la raíz del proyecto con las 3 calculadoras embebidas.

## Fuera del MVP

Notificaciones en tiempo real por lead (email/webhook), A/B testing, multiidioma, multinegocios/multiusuario, analytics avanzados.

## Licencia

Consulta las condiciones de LICENCIA_DE_USO.md incluidas en el paquete recibido.
