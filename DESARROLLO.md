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

### JavaScript
- `js/main.js`, `js/door-scroll.js`, `js/nav.js`, `js/gallery.js`, `js/compare.js`, `js/bands.js`
- `js/viewer3d.js` — arranque del visor 3D: no descarga nada hasta que se pulsa un botón
- `js/viewer3d-core.js` — el motor (three.js, escena, mandos). Ver «Visor 3D» más abajo
- `vendor/three-0.185.1/` — copia fijada de three.js y de los cargadores que usa

### Secciones del sitio
1. **Portada** — título, entradilla, autoría, campaña
2. **Puerta** — animación por scroll con 73 fotogramas
3. **Hub** — cuatro tarjetas
4. **La pieza** — ficha de catalogación, construcción, herrajes, policromía, archivos, cuatro ortofotografías, galería
5. **Recreación** — fotogrametría, ortofotografías, recreación del estado original, vectorización del motivo, galería
6. **Modelo 3D** — visor interactivo de las dos hojas (render estático hasta que se pulsa «Ver en 3D»)
7. **Fotografía técnica** — equipo, selector de modalidad (VIS/UVF/UVR/IRR), dos comparadores, tabla de aportaciones y límites, galería
8. **Imagen hiperespectral** — diagrama del cubo, captura, tabla de las 29 firmas espectrales, fichas SAM/LDA/LR/SU, resultados y límites, galería
9. **Hallazgos** — ocho tarjetas de resultados
10. **Créditos** — autoría, ficha de la pieza, agradecimientos, referencias, licencia

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

### 2. Tipografías
`css/tokens.css` pide EB Garamond e Inter; ahora mismo caen a Georgia y a la sans del
sistema, y el resultado es correcto. Si se quieren las reales, descargar los `.woff2`
subconjuntados a `assets/fonts/` y declarar `@font-face` al principio de `css/base.css`.

---

## 🧊 Visor 3D

Sección `#modelo-3d`, más un botón intercalado en Fotografía técnica que abre el mismo
visor en una capa superpuesta sin sacar al lector del texto.

### Qué hace

Órbita, zoom y encuadre; **apertura de las hojas** (botón, deslizador de 0 a 100 % y
selección de qué hoja se mueve); cinco vistas fijas (anterior, posterior, canto, cenital,
tres cuartos); cuatro modos de visualización (policromía, volumen sin color, malla,
relieve por normales); **luz rasante orientable** con su deslizador de dirección;
exposición; giro automático; **medición** entre dos puntos; captura de pantalla;
pantalla completa; puntos comentados anclados al modelo; y teclado completo
(flechas, `+`/`-`, `O` abrir y cerrar, `R` reencuadrar, `F` pantalla completa,
`Esc` salir).

Detalles que importan y son fáciles de romper al tocar el código:

- **Nada se descarga hasta pulsar el botón** (CA-13.1). `viewer3d.js` sólo escucha;
  `viewer3d-core.js`, three.js y el modelo llegan con `import()` dinámico.
- **La rueda no roba el scroll** (CA-13.4): el zoom sólo se activa con el puntero encima
  y el visor activado. En táctil, un dedo sigue desplazando la página hasta que se toca
  el lienzo.
- **Se dibuja bajo demanda.** Sin movimiento no hay fotogramas, y un `IntersectionObserver`
  lo detiene cuando la sección sale de pantalla.
- **`prefers-reduced-motion`** desactiva el giro automático y las transiciones de cámara.
- Sin WebGL, la sección se queda en el render estático y no deja errores en consola
  (CA-13.3).

### El manifiesto

El visor no lleva ningún dato de la pieza dentro. Todo está en `assets/model/puerta.json`:
qué fichero cargar, dónde está la bisagra de cada hoja, cuánto abren, el encuadre inicial
y los puntos comentados. Así se reajusta el modelo sin tocar JavaScript.

```json
{
  "calidades": [
    { "id": "estandar", "fichero": "puerta.glb", "etiqueta": "Estándar",
      "mb": 8.0, "triangulos": 599999, "textura": 4096, "auto": true }
  ],
  "metrosPorUnidad": null,
  "alturaRealCm": 198,
  "alturaRealDe": "hoja-1",
  "metrosPorUnidad": 0.05080114,
  "alturaEncuadre": 2.0,
  "aperturaMaxima": 100,
  "sentidoApertura": -1,
  "hojas": [{ "nodo": "hoja-1", "etiqueta": "Hoja 1", "lado": "derecha", "bisagraX": 10.3167 }],
  "camara": { "azimut": 0, "elevacion": 6, "distancia": 1.05 },
  "puntos": []
}
```

`sentidoApertura` decide hacia qué lado del plano de la puerta giran las hojas: `-1`
hacia la cara posterior, `1` hacia la anterior. Cada hoja gira siempre sobre su canto
exterior, así que esto es lo único que hay que cambiar si el giro sale del revés. Lo
mandan los herrajes: las pletinas de los goznes están clavadas en una de las caras y el
eje del gozne cae de ese lado.

`calidades` es la lista de niveles. Los que llevan `auto: true` se encadenan solos —la
vista previa aparece en un segundo y el detalle la sustituye cuando llega—; el resto
espera a que el lector pulse su botón en la barra, que muestra el peso. En móvil, con
ahorro de datos activado o con conexión declarada lenta, la cadena automática se corta en
la vista previa y los 8 MB del nivel estándar los pide el lector.

**La escala métrica se guarda como la medida, no como el factor.** `alturaRealCm` es lo
que mide de alto en la pieza la hoja que indica `alturaRealDe` —198 cm, tomados sobre la
Hoja 1— y `tools/build_model.py` recalcula `metrosPorUnidad` en cada exportación
dividiéndola por la altura que tenga la malla en ese momento. Así la escala sobrevive a
regenerar el modelo con otra decimación o con otra escala relativa entre hojas, que es
justo cuando un factor copiado a mano se queda obsoleto sin que nadie se entere.

Con esos 198 cm, el modelo da 52,5 cm de ancho y 10,5 cm de grueso para la Hoja 1;
45,9 y 8,6 para la Hoja 2; y 98,4 cm para el conjunto cerrado. El grueso incluye las
molduras, que sobresalen por las dos caras.

Si nunca se toma una medida, `alturaRealCm` se deja a `null`: entonces la herramienta de
medir informa en unidades del modelo en vez de en centímetros, y lo advierte.

**Puntos comentados.** Cada entrada de `puntos` es
`{ "titulo", "texto", "posicion": [x, y, z], "seccion": "#fotografia-tecnica" }`. Las
coordenadas se obtienen abriendo el visor con `?calibrar=1` y pinchando sobre la pieza:
la posición se copia al portapapeles.

### Modo de calibración

`index.html?calibrar=1` añade bajo la barra de mandos los deslizadores de bisagra, el
ángulo máximo de apertura y la altura real en centímetros, más un botón que copia el
JSON resultante. No guarda nada por su cuenta: hay que pegarlo en
`assets/model/puerta.json`.

### Cómo se generó el modelo

Los `.glb` que salen de RealityScan pesan 180 y 168 MB: un millón de triángulos por hoja,
textura de 4096 px sin comprimir y dos capas de color por vértice que duplican lo que ya
trae la textura. GitHub rechaza cualquier fichero de más de 100 MB. Lo reduce
`tools/build_model.py`, con Blender en segundo plano:

```bash
blender --background --factory-startup --python tools/build_model.py -- --stage prepare
blender --background --factory-startup --python tools/build_model.py -- --stage export
```

- `prepare` importa, quita los colores por vértice, **suelda los vértices**, pasa a
  sombreado suave, endereza cada hoja y las coloca cerradas una junto a otra. Es la fase
  cara (dos o tres minutos); deja la caché en `tools/.cache/puerta_prep.blend` y seis
  vistas en `tools/.cache/vista_*.png` para comprobar el resultado.
- `realign` repite sólo la colocación sobre esa caché, para ajustar sin reimportar.
- `export` genera los tres niveles de calidad, el render estático y el manifiesto.
  `--tier estandar` rehace uno solo, en menos de un minuto.

| Nivel | Fichero | Triángulos | Textura | Peso |
|---|---|---|---|---|
| Vista previa | `puerta-preview.glb` | 60 000 | 1024 px, q80 | 0,7 MB |
| Estándar | `puerta.glb` | 600 000 | 4096 px, q90 | 8,0 MB |
| Máxima | `puerta-alta.glb` | 1 907 021 (malla completa) | 4096 px, q95 | 15,0 MB |

Los parámetros de cada nivel están en la constante `TIERS` del script.

### Tres cosas que arruinaban la calidad

Vale la pena dejarlas escritas, porque no son evidentes y volverían a aparecer si se
regenera el modelo con otro procedimiento.

1. **La malla venía sin soldar.** RealityScan entrega cada triángulo con sus tres
   vértices propios: 2 956 015 vértices para 985 561 caras. Sobre una sopa de triángulos
   así, el decimado por colapso de aristas no tiene aristas que colapsar, de modo que se
   limita a tirar triángulos sueltos y la superficie se deshilacha hasta parecer una nube
   de puntos. Soldar (`bmesh.ops.remove_doubles`, 1e-4) deja 493 519 vértices, permite
   decimar de verdad y **reduce el GLB a la mitad**: el nivel estándar pasó de 17,1 a
   8,0 MB con los mismos 600 000 triángulos.
2. **Sombreado plano.** Con los vértices ya compartidos, `shade_smooth()` elimina el
   granulado de facetas que se confundía con suciedad de la pieza y tapaba la veta.
3. **Cuantización de UV demasiado corta.** Draco con 11 bits deja 2048 posiciones para
   una textura de 4096 texeles: cada vértice se desplaza hasta medio texel y la textura
   sale emborronada, con moteado en los bordes de cada isla del atlas. Con 14 bits el
   error baja del texel y cuesta menos de un 10 % de tamaño.

Y una decisión de reparto: **esta pieza es una tabla plana con relieve poco profundo, así
que casi toda la información visible está en la textura, no en la malla**. Por eso los
niveles gastan el presupuesto en 4096 px de textura antes que en triángulos. Bajar la
textura a 2048 px, que fue el primer intento, es lo que hacía ilegible la policromía.

**Si hiciera falta más calidad todavía**, el techo actual es la textura: RealityScan
generó atlas de 4096 px y el visor ya los sirve enteros. La única vía real de mejora es
volver a exportar desde RealityScan con atlas de 8192 px (o varios de 4096); el script y
el visor los admiten sin cambios, y el nivel máximo pasaría a unos 35 MB, que GitHub
Pages sigue sirviendo sin problema.

Dos cosas que el script no puede deducir están escritas a mano en la constante `LEAVES`
de `tools/build_model.py`: **qué cara de cada hoja es la anterior y de qué lado va cada
hoja**. Si se regenera el modelo y las hojas salen del revés o con las bisagras hacia
dentro, se cambian ahí `lado` y `flip` y se vuelven a ejecutar `--stage realign` y
`--stage export`.

### La escala de las hojas

Las dos hojas se procesaron por separado en RealityScan y cada una salió con su propia
escala: 38,98 y 41,89 unidades de alto para dos tablas que en la pieza real miden lo
mismo. Puestas juntas, una asomaba tres unidades por encima de la otra.

El factor de corrección no es una estimación nuestra: es el que está ajustado en la
escena de Blender del estudio, donde las hojas ya se colocaron y redimensionaron para la
animación de la habitación. Allí `PUERTA1_pequenito` está a escala 1,0 y
`PUERTA2_YUJUUU` a **0,923**. Aplicado, las dos hojas quedan en 38,98 y 38,66 unidades,
que es la misma diferencia (0,8 %) que tienen en esa escena.

Ojo con la diferencia entre esto y `alturaRealCm`: esto iguala las dos hojas **entre
sí**, y aquello ancla el conjunto a centímetros. Hacen falta las dos cosas.

Está anotado en el campo `escala` de `LEAVES`. Para releerlo de la escena, sin tener que
copiarlo a mano:

```bash
blender --background --factory-startup --python tools/build_model.py -- --stage prepare   --blend "../TFM modelos puerta Laura 3/TFM modelos puerta Laura/TFM modelos puerta Laura/Untitled.blend"
```

El script abre esa escena **antes** de importar nada, lee la escala de cada objeto por su
nombre (`objeto` en `LEAVES`) y la aplica a la malla. Si el archivo de Blender cambia de
sitio o de nombre, basta con pasar la ruta nueva; si se ajusta allí la escala, se vuelve
a ejecutar `prepare` con `--blend` y luego `export`. No hace falta exportar las hojas por
separado desde Blender: las mallas y las texturas siguen viniendo de los `.glb` de
RealityScan, que es donde están a máxima resolución.

Las fuentes (`TFM modelos puerta Laura 3/`) quedan fuera del repositorio, como
`Documentacion puerta/`. Lo que se publica son los dos `.glb` optimizados.

---

## 🚀 Servir en local

```bash
python -m http.server 8000
```

Los módulos ES requieren servidor HTTP; no funcionan con `file://`.
Hay una configuración lista en `.claude/launch.json` (puerto 8765).

---

## 🚀 Publicar en GitHub Pages

El sitio es estático (sin build ni backend) y pesa unos 34 MB: 8,8 MB de imágenes y
fotogramas, 23 MB de modelos 3D en tres niveles de calidad y 1,8 MB de three.js en
`vendor/`. Entra de sobra en GitHub Pages, cuyos límites reales son **100 MB por fichero
y 1 GB por sitio publicado**, con una recomendación de no pasar de 100 GB de tráfico al
mes. El fichero más grande del proyecto es `puerta-alta.glb`, con 15 MB, y nadie lo
descarga salvo que pulse «Máxima»: la página completa se lee con 0,7 MB de modelo y el
nivel estándar de 8 MB sólo llega si se abre el visor. El repositorio ya está preparado: `.gitignore`
deja fuera `Documentacion puerta/` (2,1 GB, con seis ficheros de más de 100 MB que
GitHub rechaza), los vídeos y `frames_webp/`. Las imágenes del sitio no dependen de
esas carpetas: están derivadas en `assets/`.

Los metadatos sociales ya apuntan a la URL definitiva
(`https://laurariverovico.github.io/puerta-renacentista-alhambra/`): `canonical`,
`og:url`, `og:image` y `twitter:image` con URL absoluta, que es lo que exigen los
rastreadores de Facebook, WhatsApp y LinkedIn. **Si cambias de usuario, de nombre de
repositorio o pones un dominio propio, hay que actualizar esas cinco líneas de la
cabecera de `index.html`**; son las únicas rutas absolutas del proyecto.

Crea el repositorio en GitHub como `puerta-renacentista-alhambra` (vacío, sin README ni
licencia, para que no haya que fusionar nada) y luego:

```bash
git remote add origin https://github.com/laurariverovico/puerta-renacentista-alhambra.git
git push -u origin main
```

Y en GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
El primer despliegue tarda un par de minutos; el sitio queda en
`https://laurariverovico.github.io/puerta-renacentista-alhambra/`.

Notas:

- **Repositorio privado:** Pages sobre repos privados requiere plan de pago. En público
  no hay restricción.
- **Rutas:** todas son relativas, así que funciona igual bajo `/REPO/` que en un dominio
  propio. No hace falta tocar nada al cambiar de URL, salvo los metadatos de arriba.
- **Mayúsculas:** Pages sirve desde Linux, que sí las distingue. Las 120 referencias del
  sitio están verificadas contra el disco una a una; si añades imágenes nuevas, respeta
  la caja exacta del nombre de fichero.
- **`.nojekyll`** está en la raíz y es necesario: sin él, Jekyll ignoraría cualquier
  carpeta que empiece por guion bajo.
- **Modelos 3D:** no hace falta Git LFS y además sería contraproducente: Pages **no
  resuelve los ficheros de LFS**, sirve el puntero de texto en su lugar. Los `.glb` van
  como ficheros normales del repositorio.
- **Carga inicial:** la portada precarga los 73 fotogramas de la puerta, unos 4,5 MB.
  Si se quisiera aligerar, la vía es reducir `numFrames` en `js/door-scroll.js` y
  regenerar con menos fotogramas.

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
