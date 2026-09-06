# Guía de desarrollo — Web del estudio de la puerta renacentista

**Estado:** Sitio con contenido real completo y assets generados. Pendiente de revisión de datos y de tres piezas opcionales.

---

## ✅ Hecho

### Estructura y maquetación
- `index.html` — contenido real, sin marcadores de posición
- `css/tokens.css` — sistema de diseño + token `--c-claro-suave` para texto secundario sobre fondo oscuro
- `css/base.css` — reinicio, utilidades, enlace de salto corregido
- `css/layout.css` — contenedores, retícula, barra de navegación
- `css/sections.css` — secciones, ficha, tablas, figuras, fila de ortofotografías, hallazgos, cenefa
- `css/components.css` — comparador, selector de banda, galerías, fichas de método, diagrama del cubo
- `css/print.css` — actualizado a las secciones nuevas

### JavaScript (sin cambios respecto al esqueleto)
- `js/main.js`, `js/door-scroll.js`, `js/nav.js`, `js/gallery.js`, `js/compare.js`, `js/bands.js`
- `js/viewer3d.js` queda sin uso: la sección del visor 3D se sustituyó por la sección de hallazgos.
  Si en el futuro hay un `.glb`, se puede recuperar (ver «Pendiente»).

### Secciones del sitio
1. **Portada** — título, entradilla, autoría, campaña
2. **Puerta** — animación por scroll con 73 fotogramas
3. **Hub** — cuatro tarjetas
4. **La pieza** — ficha de catalogación, construcción, herrajes, policromía, archivos, cuatro ortofotografías, galería
5. **Recreación** — fotogrametría, ortofotografías, recreación del estado original, vectorización del motivo, galería
6. **Fotografía técnica** — equipo, selector de modalidad (VIS/UVF/UVR/IRR), dos comparadores, tabla de aportaciones y límites, galería
7. **Imagen hiperespectral** — diagrama del cubo, captura, tabla de las 29 firmas espectrales, fichas SAM/LDA/LR/SU, resultados y límites, galería
8. **Hallazgos** — ocho tarjetas de resultados
9. **Créditos** — autoría, ficha de la pieza, agradecimientos, referencias, licencia

### Assets generados
Todos se han derivado de `Documentacion puerta/` con Pillow. Ver «Cómo regenerar».

```
assets/
├── door/
│   ├── frames/door_001..073.webp   1200×1600, 4,5 MB en total (antes 24 MB)
│   ├── poster.webp                 fotograma 1
│   └── background.webp             fondo del vano
├── img/
│   ├── historia/                   4 ortofotografías + 4 detalles + miniatura
│   ├── recreacion/                 estado original, motivo vectorizado, cenefa,
│   │                               cuatro caras, detalle, miniatura
│   ├── fotografia-tecnica/         16 imágenes de hoja completa (4 caras × 4 modalidades)
│   │                               + 8 detalles + miniatura
│   └── hsi/                        3 detalles de las zonas analizadas + miniatura
└── og/preview.jpg                  1200×630
favicon.svg
```

**Registro entre modalidades:** las imágenes de `fotografia-tecnica/` están alineadas
entre sí recortando cada original por el rectángulo de su canal alfa y escalando todas
al encuadre de la VIS. Por eso el comparador y el selector de banda funcionan: al cambiar
de modalidad no se mueve el encuadre. Si se sustituyen los originales hay que volver a
ejecutar el script de generación, no copiarlos a mano.

---

## ⚠️ Pendiente de revisión (datos, no código)

1. **Numeración de las hojas.** En el TFM, la Hoja 2 es la que conserva tres de las
   cuatro bisagras. En los ficheros de fotografía técnica, la hoja con bisagras es
   `PTA1`, y en las ortofotografías es `PUERTA_2`. La web sigue la convención del TFM
   (hoja con herrajes = Hoja 2), de modo que `PTA1_*` se ha rotulado como Hoja 2 y
   `PTA2_*` como Hoja 1. **Conviene confirmarlo antes de publicar.**
2. **Fecha de catalogación en DOMUS.** La ficha del TFM dice «19 de abril de 2010»;
   una nota al margen menciona «10/04/2010». La web usa la primera.
3. **ROI usadas en LDA.** La metodología habla de veinte ROI y los resultados de quince.
   La web dice quince, siguiendo el apartado de resultados.
4. **Licencia y permisos de imagen.** El pie afirma que los derechos sobre el bien
   corresponden al Patronato de la Alhambra y Generalife y que la reutilización requiere
   autorización. Ajustar al acuerdo real con la institución.
5. **Tutores.** No figuran en el documento, así que no aparecen en la web. Añadirlos en
   el bloque «Autoría del estudio» del pie si procede.
6. **Contacto y repositorio.** No se ha inventado ninguna dirección ni URL. Añadir en
   `#creditos` → «Créditos de imagen» si se quiere ofrecerlos.

---

## 📋 Pendiente (opcional)

### 1. Imágenes de resultados HSI
No hay en `Documentacion puerta/` ninguna imagen de los mapas de clasificación
(SAM, LDA, LR, SU) ni de las firmas espectrales. La sección HSI describe los resultados
y muestra las zonas analizadas, pero gana mucho con los mapas. Al añadirlos:

- Guardar en `assets/img/hsi/` como `mapa-sam.webp`, `mapa-lda.webp`, `mapa-su.webp`,
  `firmas-*.webp`.
- Se pueden montar como un segundo `data-bands` (SAM / LDA / LR) reutilizando
  `.bands-image-stack--cuarteron`, o como galería.

### 2. Modelo 3D interactivo
`js/viewer3d.js` sigue en el proyecto pero no se carga. Para recuperarlo:

```bash
# Exportar de RealityScan/Blender a glTF 2.0 (.glb) con compresión Draco
npx @gltf-transform/cli optimize modelo.glb assets/model/objeto.glb --texture-size 2048 --compress draco
```

Objetivo ≤ 15 MB (ideal ≤ 8 MB). Después, volver a añadir la sección con
`data-viewer3d` y el botón `data-load-viewer` (main.js ya lo importa bajo demanda).

### 3. Tipografías
`css/tokens.css` pide EB Garamond e Inter; ahora mismo caen a Georgia y a la sans del
sistema, y el resultado es correcto. Si se quieren las reales, descargar los `.woff2`
subconjuntados a `assets/fonts/` y declarar `@font-face` al principio de `css/base.css`.

---

## 🚀 Servir en local

```bash
python -m http.server 8000
```

Los módulos ES requieren servidor HTTP; no funcionan con `file://`.
Hay una configuración lista en `.claude/launch.json` (puerto 8765).

---

## 🔁 Cómo regenerar los assets

Todo el procesado de imagen está en un único script:

```bash
python -m pip install pillow
python tools/build_assets.py
```

Es idempotente y reproduce exactamente lo que hay ahora en `assets/`. Qué hace:

1. **Fotografía técnica registrada** — recorta cada original por el rectángulo de su
   canal alfa y escala las cuatro modalidades al encuadre de la VIS de esa misma cara.
2. **Detalles multibanda** — dos cuarterones en VIS, UVF, UVR e IRR para los comparadores.
3. **Ortofotografías** — los PNG originales superan los 32 768 px y ffmpeg los rechaza;
   por eso se usa Pillow con `MAX_IMAGE_PIXELS = None`. La primera pasada tarda varios
   minutos y deja una versión de trabajo en `tools/.cache/` (ignorada por git); las
   siguientes son inmediatas. Borra esa carpeta si cambian los originales.
4. **Recreación y cenefa** — recorte por alfa y, para el separador ornamental, el motivo
   vegetal girado 90° y teñido de oro.
5. **Miniaturas, Open Graph y fotogramas de la puerta** — las miniaturas 3:2 de las
   tarjetas, la imagen social y la reducción de los 73 fotogramas a 1200 px.

Los recortes de detalle están expresados en fracciones de la imagen (`frac_crop`), de
modo que se ajustan cambiando cuatro números en el script.

---

## ✔️ Comprobado

- Sin errores de consola ni peticiones 404
- Selector de modalidad: las cuatro bandas conmutan y el rótulo se actualiza
- Comparadores: el arrastre funciona y las imágenes están registradas
- Galerías y lightbox: se abren, navegan y muestran pie y crédito
- Contraste corregido en `.hero-meta`, pie, notas del comparador y del selector
- Móvil (375 px): tarjetas en una columna, ortofotografías en dos, selector de banda
  recorta al cuarterón central
- Sin desbordamiento horizontal

## ⏳ Sin comprobar

- Lighthouse y axe DevTools
- Impresión
- Navegadores reales de iOS y Android

---

**Última actualización:** 2026-09-06
