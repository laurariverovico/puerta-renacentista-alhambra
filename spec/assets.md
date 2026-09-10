# Contrato de assets

Lo que hay que tener preparado para implementar [requisitos.md](requisitos.md).
Cada apartado indica qué se entrega, en qué formato y cómo se procesa.

Convención de nombres en todo el proyecto: minúsculas, sin acentos, sin espacios,
separación con guiones. `assets/img/hsi/firma-espectral-01.webp`.

---

## 1. Puerta — RF-02, crítico

### Origen
El vídeo de la puerta de dos hojas abriéndose, **con canal alfa**, en su máxima
calidad (ProRes 4444 `.mov`, secuencia PNG, o WebM VP9-alpha).

Requisitos del plano: cámara **fija**, puerta cerrada en el primer fotograma y
abierta del todo en el último, sin fundidos de entrada ni de salida.

### Verificar que el alfa existe de verdad

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,width,height,nb_frames,r_frame_rate -of default=nw=1 puerta.mov
```

`pix_fmt` debe contener una `a`: `yuva444p10le`, `rgba`, `argb`. Si devuelve
`yuv420p` **no hay transparencia** y se activa el respaldo CSS de RF-02, para el
que hace falta lo del apartado 1.4.

### Procesado a secuencia de fotogramas

```bash
mkdir -p assets/door/frames
ffmpeg -i puerta.mov -vf "fps=24,scale=1200:-2:flags=lanczos" -pix_fmt rgba assets/door/frames/door_%03d.png
```

```bash
for f in assets/door/frames/*.png; do cwebp -q 82 -alpha_q 95 "$f" -o "${f%.png}.webp"; done
```

| Parámetro | Objetivo |
|---|---|
| Nº de fotogramas | 60–90 (24 fps × unos 3 s) |
| Ancho | 1200 px |
| Peso por fotograma | ≤ 60 KB en WebP |
| Peso total de la secuencia | ≤ 4 MB |
| Nomenclatura | `door_001.webp` … `door_090.webp` |

Si se pasa de 4 MB: bajar a 20 fps, reducir a 1000 px de ancho, o recortar el
encuadre a la puerta más un margen.

### 1.4 Complementos de la puerta

- `assets/door/poster.webp` — fotograma 1, puerta cerrada. Se usa durante la
  precarga y con `prefers-reduced-motion`.
- `assets/door/background.webp` — lo que se ve a través del vano al entrar.
- **Sólo si se activa el respaldo CSS:** `hoja-izquierda.webp` y
  `hoja-derecha.webp`, cada una con la hoja recortada con alfa y la bisagra
  alineada al borde exterior del recorte.

---

## 2. Fotografía técnica — RF-08 y RF-11

Pares de capturas para la cortinilla comparativa. Como mínimo tres pares, por
ejemplo visible/UV, visible/IR y visible/luz rasante.

**Requisito crítico: registro geométrico.** Las dos imágenes de un par deben
coincidir píxel a píxel: mismas dimensiones, mismo encuadre, misma escala. Si se
capturaron con cámaras u ópticas distintas, hay que registrarlas previamente en
Photoshop o con un alineado por puntos homólogos. Sin esto, la cortinilla
produce un salto visible al mover el divisor y el componente pierde su sentido
(riesgo R-02).

Por cada par se entrega: las dos imágenes, el nombre de cada técnica de captura
y una frase sobre qué debe observarse en la comparación.

Formato: ≥ 1600 px en el lado largo, sin recomprimir. Se convierten a `.webp`
calidad 82.

---

## 3. HSI — RF-09 y RF-10

Un grupo de imágenes de la **misma zona** de la puerta, una por banda o
composición en falso color. De 4 a 8 imágenes por grupo.

Mismo requisito de registro que el apartado 2: dimensiones idénticas entre todas
las imágenes del grupo.

Por cada imagen: etiqueta corta de la banda, longitud de onda o rango en
nanómetros, y una frase sobre qué revela.

Si hay gráficas de firma espectral, se entregan como imagen exportada con su pie;
no se implementa gráfica interactiva.

---

## 4. Imágenes de las secciones — RF-06, RF-07, RF-12

Por cada una de las cuatro secciones:

- 3 a 8 imágenes, originales sin recomprimir, ≥ 1600 px en el lado largo;
- 1 imagen de tarjeta para el hub, **apaisada en proporción 3:2**;
- para cada imagen: texto alternativo, pie de foto y crédito o procedencia.

Procesado: `.webp` a 1600 px para el visor ampliado y a 800 px para la
miniatura, calidad 80.

En la sección Recreación, distinguir en el pie qué imágenes son fotografía y
cuáles son render (CA-07.2).

---

## 5. Modelo 3D — RF-13

### Origen
`.obj` + `.mtl` + carpeta de texturas. Indicar unidades y escala, número
aproximado de triángulos y resolución de las texturas.

### Conversión — **resuelta**

La hace `tools/build_model.py` con Blender en segundo plano; no hace falta Node ni
`gltf-transform`. Ver «Visor 3D» en [DESARROLLO.md](../DESARROLLO.md).

```bash
blender --background --factory-startup --python tools/build_model.py -- --stage prepare
blender --background --factory-startup --python tools/build_model.py -- --stage export
```

Tres niveles, porque el objetivo de «un solo `.glb` de ≤ 15 MB» obligaba a bajar la
textura a 2048 px y con eso la policromía deja de leerse. Se sirve en cambio una cadena
de calidades y el lector decide hasta dónde descargar:

| Nivel | Fichero | Triángulos | Textura | Peso |
|---|---|---|---|---|
| Vista previa | `puerta-preview.glb` | 60 000 | 1024 px, q80 | 0,7 MB |
| Estándar (automático) | `puerta.glb` | 600 000 | 4096 px, q90 | 8,0 MB |
| Máxima (a petición) | `puerta-alta.glb` | 1 907 021, malla completa | 4096 px, q95 | 15,0 MB |

Partimos de 348 MB. Lo que hace que quepa no es decimar mucho, sino **soldar los vértices
que RealityScan entrega duplicados** (2 956 015 → 493 519 por hoja) y subir la
cuantización de UV de Draco a 14 bits; ver «Tres cosas que arruinaban la calidad» en
[DESARROLLO.md](../DESARROLLO.md).

Una hoja por nodo (`hoja-1`, `hoja-2`), enderezadas y colocadas cerradas, para que el
visor pueda abrirlas girando cada una sobre su canto exterior.

### Complementos
- `assets/model/fallback.webp` — render estático, es el estado inicial de la
  sección y la alternativa sin WebGL. Lo genera el mismo script.
- `assets/model/puerta.json` — manifiesto: niveles de calidad, bisagras, apertura,
  encuadre y puntos comentados. Es lo único que hay que tocar para reajustar el modelo.
- `assets/model/orbita/` — no hace falta: la degradación a carrusel estaba prevista para
  un `.glb` demasiado pesado, y aquí la degradación es la propia cadena de niveles.

### Si se quiere aún más calidad

El techo es la textura, no la malla: esta pieza es una tabla plana con relieve poco
profundo y casi toda la información visible está en el atlas. RealityScan generó atlas de
4096 px y el visor ya los sirve enteros, así que la única mejora real es **volver a
exportar desde RealityScan con atlas de 8192 px**, o varios de 4096. El script y el visor
los admiten sin cambios; el nivel máximo pasaría a unos 35 MB, dentro de lo que GitHub
Pages sirve (100 MB por fichero, 1 GB por sitio).

### La escala

Las dos hojas se procesaron por separado en RealityScan y no compartían escala: daban
38,98 y 41,89 unidades de alto cuando en la pieza real miden lo mismo. **Corregido** con
el factor 0,923 que ya estaba ajustado en la escena de Blender del estudio; el script lo
relee de allí con `--blend <ruta>`. Las dos hojas quedan en 38,98 y 38,66.

La escala **absoluta** también está resuelta: la Hoja 1 mide **198 cm** de alto en la
pieza, y de ahí sale el factor de 0,0508011 m por unidad. En el manifiesto se guarda la
medida (`alturaRealCm`), no el factor, y el script lo recalcula en cada exportación.

Medidas que devuelve el modelo con esa escala: Hoja 1, 198 × 52,5 × 10,5 cm; Hoja 2,
196,4 × 45,9 × 8,6 cm; conjunto cerrado, 98,4 cm de ancho. El grueso incluye las molduras.
La herramienta de medir del visor informa ya en centímetros.

---

## 6. Textos — RF-01, RF-06 a RF-09, RF-14

Entregar en un único documento con estos huecos rellenos:

**Portada:** autor · tutor o tutores · máster y universidad · año · descripción
de 40 a 60 palabras.

**Por sección (×4):** entradilla de 1 a 2 frases para la tarjeta del hub + texto
completo de 800 a 1500 palabras con sus subtítulos.

**Pie:** licencia elegida · agradecimiento a la institución depositaria ·
contacto · enlace al repositorio si existe.

**Compartir:** una frase para la `meta description`.

---

## 7. Documento y tipografías

- `assets/doc/tfm.pdf` — el TFM completo. Anotar su tamaño en MB, que debe
  aparecer junto al botón de descarga (CA-14.1). Si supera 100 MB, comprimir o
  enlazar al repositorio institucional (riesgo R-05).
- `assets/og/preview.jpg` — 1200×630 px, imagen de previsualización social.
- `assets/fonts/` — ficheros `.woff2` subconjunto latino de las dos familias
  de §6.2 de la spec, descargados y alojados aquí (restricción C-07).
- `favicon.ico` o `favicon.svg`.

---

## 8. Checklist previa a la implementación

**Bloqueantes** (sin esto no se puede empezar la parte correspondiente):

- [ ] Vídeo de la puerta verificado con `ffprobe`: ¿tiene alfa real?
- [ ] Secuencia de fotogramas generada, ≤ 4 MB · **o bien** las dos hojas
      recortadas para el respaldo CSS
- [ ] Pares de fotografía técnica verificados como registrados al píxel
- [ ] Grupo de bandas HSI verificado como registrado al píxel

**Necesarios antes de la entrega:**

- [ ] Poster y fondo del vano
- [ ] Imágenes de las cuatro secciones, con alt, pie y crédito
- [ ] Imagen de tarjeta 3:2 para cada sección del hub
- [ ] Textos completos de portada, cuatro secciones y pie
- [ ] `.glb` optimizado + render de sustitución
- [ ] PDF del TFM y su tamaño
- [ ] Imagen Open Graph, tipografías y favicon
- [ ] Licencia decidida y permiso de la institución confirmado
