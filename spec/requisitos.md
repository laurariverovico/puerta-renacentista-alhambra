# Especificación de requisitos — Web del TFM

**Título:** Fotografía técnica e imagen hiperespectral aplicadas al estudio de
una puerta renacentista policromada del fondo museístico de la Alhambra

**Versión:** 1.0 (lista para implementación) · **Fecha:** 2026-09-06

Este documento es la fuente de verdad. Lo que no esté aquí no se implementa;
lo que se implemente distinto se corrige aquí primero.

---

## 1. Objetivo y público

Sitio web estático de una sola página que divulga el TFM. La entrada es
narrativa —portada, apertura de la puerta con el scroll, paso a través del
vano— y desemboca en cuatro bloques de contenido: **Historia**, **Recreación**,
**Fotografía técnica** e **HSI**.

Público: tribunal y tutores en primer lugar; difusión académica y museística
después. El sitio no sustituye al TFM: lo enlaza en PDF y aporta lo que el papel
no puede dar, que es la comparación interactiva de capturas técnicas y el modelo
tridimensional.

---

## 2. Decisiones cerradas

| # | Decisión | Valor |
|---|---|---|
| D-01 | Stack | HTML + CSS + JavaScript vanilla. Sin framework, sin paso de build. |
| D-02 | Estructura | Página única con secciones ancladas y scroll continuo. |
| D-03 | Dirección visual | Contraste por zonas: portada y puerta oscuras y cinematográficas; contenido en claro. |
| D-04 | Animación de la puerta | Secuencia de fotogramas con alfa sobre `<canvas>`, con respaldo CSS 3D si el vídeo no tiene alfa real. |
| D-05 | Visores técnicos | Cortinilla comparativa + selector de banda. |
| D-06 | Visor 3D | Requisito, con degradación definida a carrusel de renders. |
| D-07 | Idioma | Español únicamente (`lang="es"`). |
| D-08 | Extensión por sección | 800–1500 palabras. |
| D-09 | PDF del TFM | Enlazado y descargable desde el pie y desde la portada. |
| D-10 | Hosting | Sin compromiso con una plataforma concreta. Se mantiene la compatibilidad con GitHub Pages (ver §4). |

---

## 3. Alcance

**Dentro:** los requisitos RF-01 a RF-17 de §7.

**Fuera:** CMS o panel de edición · buscador interno · comentarios · cuentas de
usuario · multiidioma · analítica con cookies · foro o formulario de contacto
con envío · descarga de las imágenes en resolución de archivo · anotación
colaborativa sobre las imágenes · animaciones no descritas en RF-02 y RF-03.

---

## 4. Restricciones

| # | Restricción | Motivo |
|---|---|---|
| C-01 | El sitio es estático: sólo HTML, CSS, JS e imágenes. Ninguna funcionalidad depende de un servidor propio. | Permite publicar en GitHub Pages, Netlify, un servidor de la universidad o un pendrive sin cambiar nada. |
| C-02 | Todas las rutas internas son relativas (`assets/…`, nunca `/assets/…`). | Sin esto, el sitio se rompe al servirse en una subruta como `usuario.github.io/repo/`. |
| C-03 | Sin paso de build obligatorio. Las dependencias de terceros se guardan en `/vendor` con la versión en el nombre. | Reproducibilidad: el TFM debe poder recuperarse dentro de años sin resolver un árbol de dependencias. |
| C-04 | Ningún fichero individual supera 100 MB; el total del sitio se mantiene por debajo de 1 GB. | Límites de GitHub, que es el destino probable. |
| C-05 | Sin Git LFS. | GitHub Pages no resuelve punteros LFS y serviría ficheros corruptos. |
| C-06 | El texto de las cuatro secciones está en el HTML servido, nunca inyectado por JavaScript. | Legible sin JS, indexable, imprimible y buscable con Ctrl+F. |
| C-07 | Las tipografías se autoalojan en `assets/fonts/`. Sin Google Fonts ni CDN de fuentes. | Una web institucional que llama a un CDN externo transmite la IP del visitante a un tercero. |
| C-08 | Sin cookies ni almacenamiento persistente de datos del visitante. | Evita el requisito de banner de consentimiento. |
| C-09 | `prefers-reduced-motion: reduce` desactiva toda animación ligada al scroll. | Accesibilidad; exigible en el ámbito universitario público. |

**Nota sobre el desarrollo local:** el sitio usa módulos ES, que el navegador
bloquea al abrir un fichero con `file://`. Durante el desarrollo se sirve con
`python -m http.server 8000` o equivalente. Esto no afecta al despliegue.

---

## 5. Arquitectura de la información

Orden vertical de la página única. Cada bloque con su ancla:

| Orden | Bloque | Ancla | Zona visual |
|---|---|---|---|
| 1 | Portada | `#inicio` | Oscura |
| 2 | Puerta (scroll-scrubbing) | — | Oscura |
| 3 | Hub de 4 columnas | `#contenidos` | Transición oscuro → claro |
| 4 | Historia | `#historia` | Clara |
| 5 | Recreación | `#recreacion` | Clara |
| 6 | Fotografía técnica | `#fotografia-tecnica` | Clara |
| 7 | HSI | `#hsi` | Clara |
| 8 | Modelo 3D | `#modelo-3d` | Oscura |
| 9 | Pie y descargas | `#creditos` | Oscura |

Las anclas son parte del contrato público: una vez publicadas no se renombran.

---

## 6. Sistema de diseño

### 6.1 Color

Paleta derivada de la policromía renacentista. Definida como variables CSS en
`:root`; ningún color se escribe literal fuera de ahí.

| Token | Valor | Uso |
|---|---|---|
| `--c-noche` | `#0E0B09` | Fondo de la zona oscura |
| `--c-noche-2` | `#1A1512` | Superficies elevadas en oscuro |
| `--c-marfil` | `#FAF7F2` | Fondo de la zona clara |
| `--c-tinta` | `#1B1714` | Texto sobre claro |
| `--c-tinta-suave` | `#5A524A` | Texto secundario sobre claro |
| `--c-claro-sobre-oscuro` | `#F2EDE7` | Texto sobre oscuro |
| `--c-bermellon` | `#A8321E` | Acento principal, enlaces, foco |
| `--c-oro` | `#C8992E` | Acento secundario, detalles |
| `--c-lapislazuli` | `#2C4A7C` | Acento terciario, gráficos |
| `--c-borde` | `#E2DAD0` | Separadores en claro |

**Verificación obligatoria:** todo par texto/fondo alcanza 4.5:1 (texto normal)
o 3:1 (texto ≥ 24 px o ≥ 19 px en negrita). `--c-bermellon` sobre `--c-marfil`
debe comprobarse y oscurecerse si no llega.

### 6.2 Tipografía

- Títulos: serif con carácter (EB Garamond o Cormorant Garamond), pesos 400 y 600.
- Texto corrido: sans humanista legible (Inter o Source Sans 3), pesos 400 y 600.
- Autoalojadas en `assets/fonts/` como `.woff2` subconjunto latino, con
  `font-display: swap` y una pila de reserva del sistema declarada.

Escala tipográfica fluida con `clamp()`:

| Token | Móvil → Escritorio |
|---|---|
| `--t-hero` | 2.0rem → 4.5rem |
| `--t-h2` | 1.6rem → 2.5rem |
| `--t-h3` | 1.2rem → 1.5rem |
| `--t-body` | 1.0rem → 1.125rem |
| `--t-small` | 0.85rem → 0.9rem |

Medida de lectura: `max-width: 68ch` en el texto corrido. Interlineado 1.65 en
párrafos, 1.2 en títulos.

### 6.3 Espaciado, retícula y puntos de ruptura

- Escala de espaciado en múltiplos de 4 px: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Contenedor de lectura: `min(68ch, 100% - 2 * var(--s-24))`.
- Contenedor ancho (galerías, visores): `min(1280px, 100% - 2 * var(--s-24))`.
- Puntos de ruptura: **640 px** (móvil grande), **1024 px** (tablet/escritorio),
  **1440 px** (escritorio ancho). Diseño móvil primero.

### 6.4 Movimiento

- Duraciones: 150 ms (microinteracción), 300 ms (transición de estado),
  600 ms (entrada de sección).
- Curva por defecto: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Sólo se animan `transform` y `opacity`. Queda prohibido animar `width`,
  `height`, `top`, `left`, `margin` o `filter` en respuesta al scroll.
- Bajo `prefers-reduced-motion: reduce`, todas las duraciones pasan a 0.01 ms y
  la animación de la puerta se sustituye por su estado final.

---

## 7. Requisitos funcionales

Cada requisito lleva sus criterios de aceptación (CA), verificables uno a uno.

---

### RF-01 · Portada

Primera pantalla, altura `100svh`, zona oscura.

Contiene, en este orden: título completo del TFM · autor · tutor o tutores ·
máster y universidad · año · descripción de 40 a 60 palabras · botón primario
«Entrar» · enlace secundario «Descargar el TFM (PDF, ‹tamaño› MB)» · indicador
animado de desplazamiento.

Fondo: imagen fija de la puerta cerrada, oscurecida con un degradado para
garantizar el contraste del texto.

**CA-01.1** El título completo se lee sin recortes ni desbordamiento a 360 px de ancho.
**CA-01.2** Ningún texto de la portada cae por debajo de 4.5:1 de contraste sobre el punto más claro de la imagen de fondo.
**CA-01.3** El botón «Entrar» desplaza hasta `#contenidos` saltándose la animación.
**CA-01.4** La portada es visible y legible antes de que termine de cargar cualquier fotograma de la puerta.
**CA-01.5** El indicador de desplazamiento desaparece en cuanto el usuario hace scroll.

---

### RF-02 · Apertura de la puerta controlada por el scroll

Sección contenedora de `300vh` con un hijo `position: sticky; height: 100svh`.

**Cálculo del progreso.** Con `p` el progreso normalizado de la sección:

```
p        = clamp(0, 1, (scrollY - inicioSeccion) / (altoSeccion - alturaViewport))
pPuerta  = clamp(0, 1, p / 0.75)          // 0 → 0.75 : la puerta abre
pEntrada = clamp(0, 1, (p - 0.75) / 0.25) // 0.75 → 1 : se atraviesa el vano (RF-03)
```

**Dibujado.** `indice = round(pPuerta * (N - 1))`, con `N` el número de
fotogramas. Se dibuja en un `<canvas>` mediante `requestAnimationFrame`; el
escuchador de scroll sólo almacena el valor y nunca dibuja directamente.

**Estado derivado únicamente de la posición de scroll.** No se acumulan deltas
ni se usan temporizadores. Consecuencia exigible: al scrollear hacia arriba la
puerta cierra recorriendo exactamente los mismos estados.

**Precarga.** Los fotogramas se descargan en paralelo con un límite de 6
peticiones simultáneas. Hasta que el 100 % esté decodificado se muestra
`poster.webp` (puerta cerrada) y la sección se comporta como una imagen fija que
no bloquea el scroll.

**Respaldo CSS (D-04).** Si el vídeo de origen no tiene canal alfa real, se
sustituye el `<canvas>` por dos elementos `.hoja-izquierda` y `.hoja-derecha`
con `transform-origin` en sus bisagras y `rotateY(±110deg * pPuerta)` sobre un
contenedor con `perspective: 1200px`. El resto de esta especificación no cambia:
sólo se reemplaza la función de dibujado.

**CA-02.1** Con `pPuerta = 0` la puerta está cerrada; con `pPuerta = 1`, abierta del todo.
**CA-02.2** Scrollear hacia arriba cierra la puerta hasta el estado inicial exacto.
**CA-02.3** Scrollear muy rápido y muy lento produce el mismo estado final para la misma posición de scroll.
**CA-02.4** El *frame rate* durante la animación se mantiene ≥ 50 fps en un portátil de gama media.
**CA-02.5** Antes de completarse la precarga, el scroll de la página nunca se bloquea ni salta.
**CA-02.6** Con `prefers-reduced-motion`, la sección se reduce a `100svh` con la puerta abierta como imagen fija.
**CA-02.7** En móvil, la sección no provoca scroll horizontal ni supera el `svh` real con la barra del navegador visible.

---

### RF-03 · Transición de entrada por el vano

Durante `pEntrada` de 0 a 1:

- El conjunto de la puerta escala de `1` a `4` con origen en el centro del vano.
- La opacidad del conjunto pasa de `1` a `0` en el tramo `pEntrada > 0.6`.
- El hub (RF-04) pasa de `opacity: 0` a `1` en el tramo `pEntrada > 0.5`.
- El fondo de la página interpola de `--c-noche` a `--c-marfil`.

Al superar `p = 1`, la sección deja de ser *sticky* y el scroll continúa normal.

**CA-03.1** La transición es continua y reversible en ambos sentidos, sin saltos ni parpadeos.
**CA-03.2** Al terminar, el hub está completamente visible y legible.
**CA-03.3** No hay ningún instante en que el fondo y el texto compartan color.
**CA-03.4** Con `prefers-reduced-motion`, no hay zoom: el hub aparece directamente.

---

### RF-04 · Hub de contenidos

Cuatro tarjetas: Historia · Recreación · Fotografía técnica · HSI.

Cada tarjeta: imagen apaisada 3:2 · título · entradilla de 1 a 2 frases ·
indicador de enlace. La tarjeta entera es un enlace (un único `<a>` que envuelve
el contenido; no varios enlaces anidados).

Retícula: 1 columna < 640 px · 2 columnas de 640 a 1023 px · 4 columnas ≥ 1024 px.

**CA-04.1** Cada tarjeta desplaza suavemente hasta su sección y actualiza el fragmento de la URL.
**CA-04.2** Las cuatro tarjetas tienen la misma altura dentro de una fila, independientemente del largo de su entradilla.
**CA-04.3** Cada tarjeta es alcanzable con `Tab` y activable con `Enter`, con un anillo de foco visible de al menos 2 px.
**CA-04.4** Las imágenes declaran `width` y `height`; el desplazamiento acumulado de maquetación (CLS) es inferior a 0.1.

---

### RF-05 · Navegación persistente

Barra superior que aparece al superar la sección de la puerta y se fija con
`position: sticky`. Contiene: título abreviado del TFM (enlace a `#inicio`) ·
las cuatro secciones · enlace al PDF.

Marca como activa la sección visible mediante `IntersectionObserver`
(`aria-current="location"`). En móvil (< 640 px) se colapsa en un menú
desplegable con botón accesible.

**CA-05.1** La barra no tapa el título de una sección al llegar a ella mediante un ancla (`scroll-margin-top` compensado).
**CA-05.2** El elemento activo se actualiza al scrollear y se distingue por algo más que el color.
**CA-05.3** Abrir `…/#hsi` en una pestaña nueva lleva directamente a HSI sin reproducir la animación de la puerta.
**CA-05.4** El menú móvil abre y cierra con teclado, cierra con `Esc` y devuelve el foco al botón que lo abrió.
**CA-05.5** Existe un enlace «Saltar al contenido» como primer elemento enfocable de la página.

---

### RF-06 · Sección Historia

800–1500 palabras. Encabezado `h2`, subapartados `h3`, párrafos, listas y
galería (RF-12). Puede incluir una línea temporal como lista descriptiva
semántica, no como gráfico dependiente de JS.

**CA-06.1** El texto respeta la medida de 68ch y la jerarquía de encabezados no salta niveles.
**CA-06.2** La sección es legible y completa con JavaScript desactivado.

---

### RF-07 · Sección Recreación

800–1500 palabras sobre la recreación digital: metodología, decisiones y
resultado. Galería (RF-12) y enlace destacado al visor 3D (RF-13).

**CA-07.1** El enlace al visor 3D desplaza hasta `#modelo-3d`.
**CA-07.2** Los pies de foto distinguen con claridad qué imágenes son fotografía y cuáles render.

---

### RF-08 · Sección Fotografía técnica

800–1500 palabras. Incorpora al menos una instancia del comparador (RF-11) con
pares de capturas registradas: visible frente a ultravioleta, infrarrojo o luz
rasante. Cada par lleva una nota de una frase sobre qué debe observarse.

**CA-08.1** El comparador funciona con ratón, con dedo y con teclado.
**CA-08.2** Cada par indica la técnica de captura de cada lado, visible sin interactuar.

---

### RF-09 · Sección HSI

800–1500 palabras. Incorpora el selector de banda (RF-10) sobre la misma zona de
la puerta, con explicación de qué revela cada banda o composición en falso
color. Si hay firmas espectrales, se muestran como imagen con su pie, no como
gráfico interactivo.

**CA-09.1** El selector de banda cambia la imagen sin desplazamiento de maquetación.
**CA-09.2** El nombre y la longitud de onda de la banda activa son visibles en todo momento.

---

### RF-10 · Componente: selector de banda

Grupo de botones (patrón *tablist*) sobre un contenedor de imágenes apiladas y
registradas al píxel.

Comportamiento: al activar una banda, se hace fundido cruzado de 150 ms.
Todas las imágenes del grupo se precargan tras la primera interacción, no antes.
Navegación con flechas izquierda y derecha entre bandas; `Home` y `End` a los
extremos.

**CA-10.1** Todas las imágenes del grupo tienen dimensiones idénticas; el contenedor reserva su espacio con `aspect-ratio`.
**CA-10.2** El botón activo tiene `aria-selected="true"` y se distingue por forma además de por color.
**CA-10.3** Sin JavaScript, se muestra la primera banda con su pie de foto y ningún control roto.

---

### RF-11 · Componente: cortinilla comparativa

Dos imágenes registradas superpuestas y un divisor vertical arrastrable.

Comportamiento: arrastre con ratón y con dedo; el divisor también es un
`<input type="range">` visualmente oculto pero enfocable, de modo que las
flechas del teclado lo mueven en pasos del 2 % (10 % con `Mayús`). Posición
inicial: 50 %. Etiqueta permanente de la técnica a cada lado.

**CA-11.1** Arrastrar el divisor no provoca scroll de la página en móvil.
**CA-11.2** Las dos imágenes coinciden píxel a píxel; no hay desalineación visible al mover el divisor.
**CA-11.3** El divisor es alcanzable con `Tab` y movible con flechas.
**CA-11.4** Sin JavaScript, se ven las dos imágenes una encima de otra con sus pies, no una superposición ilegible.

---

### RF-12 · Componente: galería y visor ampliado

Retícula de miniaturas. Al activar una, abre un `<dialog>` modal con la imagen
grande, pie de foto y crédito, y navegación anterior/siguiente.

Comportamiento: cierre con `Esc`, con clic en el fondo y con botón visible.
Foco atrapado mientras está abierto y devuelto al elemento de origen al cerrar.
Fondo de la página bloqueado contra el scroll mientras el modal está abierto.

**CA-12.1** El foco no escapa del modal con `Tab` ni con `Mayús+Tab`.
**CA-12.2** Al cerrar, el foco vuelve exactamente a la miniatura desde la que se abrió.
**CA-12.3** Toda imagen informativa tiene `alt` descriptivo; las decorativas llevan `alt=""`.
**CA-12.4** Sin JavaScript, las miniaturas siguen siendo enlaces a la imagen a tamaño completo.

---

### RF-13 · Visor 3D del modelo

Sección `#modelo-3d`, zona oscura. Estado inicial: render estático del modelo
con un botón «Ver en 3D».

Al pulsarlo se cargan bajo demanda, mediante `import()` dinámico, la biblioteca
de renderizado (versión fijada en `/vendor`) y el fichero `objeto.glb`. Se
muestra progreso de descarga. Controles: órbita, zoom con rueda y pellizco,
encuadre inicial fijo y botón de reencuadre. Rotación automática lenta hasta la
primera interacción.

**Degradación definida (D-06),** en este orden:
1. Sin WebGL, o error de carga → render estático y un mensaje explicativo.
2. `.glb` por encima de 15 MB tras optimizar → se sustituye por un carrusel de
   renders precalculados en órbita, y esta sección pasa a ser una galería.
3. `prefers-reduced-motion` → sin rotación automática; el visor sigue disponible
   a petición.

**CA-13.1** Antes de pulsar el botón, el panel de red no muestra ninguna petición de `.glb`, de texturas ni de la biblioteca 3D.
**CA-13.2** El modelo aparece con sus texturas y con una iluminación que permite distinguir la policromía.
**CA-13.3** En un navegador sin WebGL, la sección muestra el render estático y ningún error en consola.
**CA-13.4** El visor no captura el scroll de la página: la rueda hace zoom sólo cuando el puntero está sobre el lienzo y el visor tiene el foco.
**CA-13.5** Existe una salida clara del visor que devuelve el foco a la página.

---

### RF-14 · Pie, créditos y descargas

Zona oscura. Contiene: autor · tutor o tutores · máster, universidad y año ·
agradecimiento a la institución depositaria de la pieza · licencia del contenido
· créditos de imágenes de terceros · contacto · botón de descarga del PDF con su
tamaño indicado · enlace al repositorio si existe.

**CA-14.1** El botón de descarga del PDF indica formato y tamaño antes de pulsarlo.
**CA-14.2** La licencia está enunciada de forma explícita, no sólo con un icono.

---

### RF-15 · Accesibilidad (transversal)

- Objetivo: WCAG 2.1 nivel AA en todo el contenido.
- Un único `h1` en la página (el título del TFM). Jerarquía sin saltos.
- Todo lo accionable es alcanzable con teclado, en orden lógico, con foco visible.
- Ninguna información se transmite sólo por color.
- Los controles táctiles miden al menos 44×44 px.
- Los `landmark` semánticos están presentes: `header`, `nav`, `main`, `footer`.
- `prefers-reduced-motion` respetado según C-09.

**CA-15.1** Recorrido completo de la página con `Tab` sin quedar atrapado y sin perder el indicador de foco.
**CA-15.2** El validador axe DevTools no reporta ninguna incidencia crítica ni grave.
**CA-15.3** Lighthouse móvil: Accesibilidad ≥ 95.

---

### RF-16 · Metadatos y compartición

`<title>`, `meta description` de una frase, `meta author`, Open Graph
(`og:title`, `og:description`, `og:image` de 1200×630 px, `og:type`, `og:url`),
`twitter:card` de tipo `summary_large_image`, favicon y `lang="es"`.

**CA-16.1** Al pegar la URL en un cliente de mensajería aparece la previsualización con imagen y título.
**CA-16.2** Lighthouse móvil: SEO ≥ 90.

---

### RF-17 · Animación del modelo

Sección `#animacion`, zona oscura, inmediatamente después del visor 3D. Un
`<video>` con controles nativos, cartel (`poster`) y `preload="none"`: no se
descarga nada hasta que se pulsa reproducir. Sin pista de audio. Dos fuentes en
orden de preferencia, AV1 y H.264, ambas en contenedor MP4 y con `faststart`.
Texto que explica qué parte del vídeo procede de datos (las hojas) y qué parte
es escenografía (el interior), y un aviso que descarta leerlo como propuesta de
ubicación.

**CA-17.1** Antes de pulsar reproducir, el panel de red no muestra ninguna petición de vídeo.
**CA-17.2** El peso y la duración figuran en el pie de la figura antes de reproducir.
**CA-17.3** Un navegador sin AV1 reproduce el H.264 sin intervención del usuario.
**CA-17.4** Con `prefers-reduced-motion` el vídeo no arranca solo (nunca lo hace: no hay `autoplay`).

---

## 8. Requisitos no funcionales

| # | Requisito | Umbral verificable |
|---|---|---|
| RNF-01 | Peso hasta poder leer la portada | ≤ 1,5 MB transferidos |
| RNF-02 | Peso hasta completar la animación de la puerta | ≤ 6 MB transferidos |
| RNF-03 | Fluidez de la animación de scroll | ≥ 50 fps sostenidos |
| RNF-04 | LCP en 4G simulada con CPU ralentizada 4× | < 2,5 s |
| RNF-05 | CLS acumulado en toda la página | < 0,1 |
| RNF-06 | Navegadores soportados | Últimas dos versiones de Chrome, Firefox, Edge y Safari, incluido iOS Safari |
| RNF-07 | Rango responsive | De 360 px a 1920 px sin scroll horizontal |
| RNF-08 | Peso total del sitio desplegado | ≤ 60 MB sin contar el PDF |
| RNF-09 | Lighthouse móvil | Rendimiento ≥ 80 · Accesibilidad ≥ 95 · Buenas prácticas ≥ 95 · SEO ≥ 90 |
| RNF-10 | Mantenibilidad | Cambiar un texto o añadir una imagen a una galería se hace editando HTML, sin tocar JavaScript |
| RNF-11 | Consola limpia | Cero errores y cero advertencias en la consola durante un recorrido completo |
| RNF-12 | Impresión | `@media print` produce un documento legible: sin barra fija, sin fondos oscuros, con las URL de los enlaces expandidas |

---

## 9. Estructura de ficheros y contratos de módulo

```
/
├── index.html
├── .nojekyll
├── css/
│   ├── tokens.css        variables de §6
│   ├── base.css          reinicio, tipografía, utilidades
│   ├── layout.css        contenedores, retículas, barra de navegación
│   ├── sections.css      portada, puerta, hub, secciones, pie
│   ├── components.css    comparador, selector de banda, galería, visor 3D
│   └── print.css
├── js/
│   ├── main.js           punto de entrada: instancia los módulos presentes
│   ├── door-scroll.js
│   ├── nav.js
│   ├── gallery.js
│   ├── compare.js
│   ├── bands.js
│   └── viewer3d.js       cargado con import() dinámico
├── vendor/
│   └── three-0.169.0/    biblioteca 3D fijada
└── assets/
    ├── fonts/
    ├── door/             frames/, poster.webp, background.webp
    ├── img/              historia/, recreacion/, fotografia-tecnica/, hsi/
    ├── model/            objeto.glb, fallback.webp, orbita/
    ├── video/            animacion.mp4, animacion-av1.mp4, animacion-poster.webp
    ├── doc/              tfm.pdf
    └── og/               preview.jpg
```

### Reglas comunes a todos los módulos

1. Cada módulo exporta una función `init(root)` que busca sus elementos dentro
   de `root` y no hace nada si no los encuentra.
2. Ningún módulo escribe contenido textual: sólo añade comportamiento a HTML que
   ya existe (C-06).
3. Todos los escuchadores de `scroll` y `resize` son `{ passive: true }` y se
   limitan mediante `requestAnimationFrame`.
4. Cada módulo comprueba `matchMedia('(prefers-reduced-motion: reduce)')` y
   aplica su comportamiento reducido.
5. Un fallo en cualquier módulo se captura y no impide la inicialización de los
   demás.

### Contrato de marcado

Los componentes se activan por atributos de datos sobre HTML que funciona por sí
solo:

```html
<div data-compare>          <!-- RF-11 -->
<div data-bands>            <!-- RF-10 -->
<div data-gallery>          <!-- RF-12 -->
<section data-viewer3d>     <!-- RF-13 -->
<section data-video>        <!-- RF-17 -->
<section data-door>         <!-- RF-02 -->
```

---

## 10. Plan de pruebas

Pruebas manuales sobre la URL desplegada. Cada caso indica el requisito que
verifica.

| # | Caso | Verifica |
|---|---|---|
| P-01 | Carga en frío con caché vacía: medir peso y LCP | RNF-01, RNF-04 |
| P-02 | Scroll lento completo por la puerta y vuelta arriba | CA-02.1, CA-02.2, CA-03.1 |
| P-03 | Scroll con la rueda a máxima velocidad, luego posicionar a mitad | CA-02.3 |
| P-04 | Grabar el perfil de rendimiento durante la animación | CA-02.4, RNF-03 |
| P-05 | Recorrido completo sólo con teclado, de principio a fin | CA-04.3, CA-05.4, CA-11.3, CA-12.1, RF-15 |
| P-06 | Activar `prefers-reduced-motion` en el sistema y recargar | CA-02.6, CA-03.4, RF-15 |
| P-07 | Desactivar JavaScript y recorrer la página | CA-06.2, CA-10.3, CA-11.4, CA-12.4 |
| P-08 | Abrir cada una de las cuatro anclas en pestaña nueva | CA-05.3 |
| P-09 | Comparador: arrastre con ratón, con dedo y con flechas | RF-11 completo |
| P-10 | Selector de banda: alternar todas las bandas y medir CLS | CA-09.1, CA-10.1 |
| P-11 | Abrir y cerrar el visor ampliado desde varias miniaturas | CA-12.1, CA-12.2 |
| P-12 | Visor 3D: comprobar en el panel de red que no carga nada antes de pulsar | CA-13.1 |
| P-13 | Visor 3D con WebGL desactivado | CA-13.3 |
| P-14 | Recorrido en iOS Safari y en Android Chrome, dispositivos reales | RNF-06, CA-02.7 |
| P-15 | Redimensionar de 360 px a 1920 px en continuo | RNF-07 |
| P-16 | Lighthouse móvil en las cuatro categorías | RNF-09 |
| P-17 | axe DevTools sobre la página completa | CA-15.2 |
| P-18 | Vista previa de impresión | RNF-12 |
| P-19 | Consola durante un recorrido completo | RNF-11 |
| P-20 | Pegar la URL en un cliente de mensajería | CA-16.1 |
| P-21 | Servir el sitio desde una subcarpeta y repetir P-08 | C-02 |

**Criterio de entrega:** los 21 casos superados, o bien documentados como
desviación aceptada con su motivo en §12.

---

## 11. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-01 | El vídeo de la puerta no tiene canal alfa real | Alto | Respaldo CSS 3D ya especificado en RF-02 (D-04) |
| R-02 | Las capturas técnicas no están registradas al píxel | Alto | El comparador y el selector de banda pierden todo su valor. Verificar antes de maquetar; si no lo están, registrarlas o pasar a imágenes compuestas lado a lado |
| R-03 | El `.obj` no baja de 15 MB sin degradarse | Medio | Degradación a carrusel de renders (RF-13) |
| R-04 | El scroll-scrubbing rinde mal en móviles antiguos | Medio | Reducir a 20 fps y 1000 px de ancho; en último término, activar el respaldo CSS por debajo de 640 px |
| R-05 | El PDF del TFM supera los 100 MB | Bajo | Comprimir imágenes del PDF o enlazarlo al repositorio institucional en lugar de alojarlo |
| R-06 | Derechos de las imágenes de la pieza | Medio | Confirmar con la institución depositaria antes de publicar y reflejar los créditos en RF-14 |

---

## 12. Supuestos abiertos

Se desarrolla bajo estos supuestos. Corregir aquí en cuanto se confirme o se
desmienta cada uno.

- **S-01** Autor, tutor o tutores, máster y universidad: pendientes de facilitar.
- **S-02** El vídeo de la puerta tiene cámara fija y canal alfa real.
- **S-03** Las capturas de fotografía técnica y de HSI están registradas
  geométricamente entre sí, o pueden registrarse.
- **S-04** Existe permiso de la institución depositaria para publicar las
  imágenes de la pieza.
- **S-05** El PDF del TFM estará disponible para alojarlo junto al sitio.
- **S-06** La licencia del contenido está por decidir; hasta entonces se maqueta
  con «Todos los derechos reservados» como marcador.
