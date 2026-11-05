# Pruebas E2E

`node --test tests/e2e/pantallas.test.cjs`

Requiere Playwright y las dependencias del cliente/servidor instaladas para Windows. PLAYWRIGHT_MODULE permite seleccionar el módulo de Playwright, E2E_SERVER_MODULES las dependencias de servidor del entorno de QA y E2E_OUTPUT la carpeta de evidencias. El servidor y la base se aíslan en un directorio temporal. E2E_BROWSER permite seleccionar Chromium/Edge.

Esta prueba recorre pantallas, tamaños, temas y estados; no sustituye las pruebas funcionales de escrituras, cálculos, exportación, PDF e integraciones. Las exclusiones quedan registradas en matriz-pantallas.json.

constructor-widget.test.cjs recorre las ocho combinaciones de datos, tema y tamaño: crear/editar y guardar con cuatro tipos de paso y cuatro reglas, vista previa, añadir/eliminar paso y regla, copiar snippet del origen real, navegación y validaciones del visitante, rango 261–319 €, contacto persistido, respuestas y cambio de estado, conversión, cancelar/borrar con cascada. Audita JS, respuestas API, anchura y contraste en cada estado recorrido. No envía correos ni añade funciones.
