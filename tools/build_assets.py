# -*- coding: utf-8 -*-
"""Genera todas las imagenes del sitio a partir de `Documentacion puerta/`.

Uso, desde la raiz del proyecto:

    python -m pip install pillow
    python tools/build_assets.py

Es idempotente: se puede volver a ejecutar tantas veces como haga falta.
Las ortofotografias originales superan los 32.768 px y ffmpeg las rechaza, por eso
todo el procesado se hace con Pillow y `MAX_IMAGE_PIXELS = None`. La primera pasada
guarda una version de trabajo en `tools/.cache/` porque decodificar esos PNG de
varios cientos de MB tarda varios minutos.
"""

import os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, "Documentacion puerta")
TEC = os.path.join(DOC, "Fotografia tecnica")
ORT = os.path.join(DOC, "Fotos ortogonales puerta")
IMG = os.path.join(ROOT, "assets", "img")
CACHE = os.path.join(ROOT, "tools", ".cache")

BG = (16, 13, 11)
TARGET_W = 1800  # ancho de las hojas completas de fotografia tecnica

MODS = {
    "vis": ("Luz Visible", "VIS"),
    "uvf": ("Fluorescencia Ultravioleta", "UVF"),
    "uvr": ("Reflectografia Ultravioleta", "UVR"),
    "irr": ("Infrarojos", "IRR"),
}

# La hoja con herrajes es la Hoja 2 del estudio. En los ficheros de fotografia
# tecnica es PTA1 y en las ortofotografias es PUERTA_2. `top` = cara anterior,
# `bot` = cara posterior.
FACES = {
    "h2-anterior": ("PTA1", "top"),
    "h2-posterior": ("PTA1", "bot"),
    "h1-anterior": ("PTA2", "top"),
    "h1-posterior": ("PTA2", "bot"),
}

ORTHO = {
    "hoja1-anterior": "PUERTA_1_Delante",
    "hoja1-posterior": "PUERTA_1_Detras",
    "hoja2-anterior": "PUERTA_2_Delante",
    "hoja2-posterior": "PUERTA_2_Detras",
}


# ── utilidades ────────────────────────────────────────────────────────────────

def alpha_crop(im):
    """Recorta la imagen al rectangulo ocupado por el objeto."""
    box = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop(box)


def flatten(im):
    if im.mode != "RGBA":
        return im.convert("RGB")
    flat = Image.new("RGB", im.size, BG)
    flat.paste(im, (0, 0), im)
    return flat


def frac_crop(im, x0, y0, x1, y1):
    w, h = im.size
    return im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))


def cover(im, w, h):
    """Escala y recorta al centro para llenar exactamente w x h."""
    r = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * r)), max(h, round(im.height * r))), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def save(im, path, w=None, quality=80, alpha=False):
    if w and im.width != w:
        im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
    im = im if alpha else flatten(im)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)
    print("  %-58s %-12s %5.0f KB" % (os.path.relpath(path, ROOT), "%dx%d" % im.size,
                                      os.path.getsize(path) / 1024))


def tech(face, mod):
    folder, pref = MODS[mod]
    pta, half = FACES[face]
    return alpha_crop(Image.open(os.path.join(TEC, folder, "%s_%s_%s.png" % (pref, pta, half))).convert("RGBA"))


def ortho(face):
    """Ortofotografia recortada y a 3000 px de alto, cacheada en disco."""
    p = os.path.join(CACHE, face + ".png")
    if os.path.exists(p):
        return Image.open(p).convert("RGBA")
    im = alpha_crop(Image.open(os.path.join(ORT, ORTHO[face] + ".png")).convert("RGBA"))
    im = im.resize((max(1, round(im.width * 3000 / im.height)), 3000), Image.LANCZOS)
    os.makedirs(CACHE, exist_ok=True)
    im.save(p)
    print("  cache %s %dx%d" % (face, im.width, im.height))
    return im


# ── generacion ────────────────────────────────────────────────────────────────

def build_tecnica():
    """Las cuatro modalidades registradas entre si, cara por cara.

    Cada original se recorta por su alfa y se escala al encuadre de la VIS de esa
    misma cara. Asi el comparador y el selector de banda no mueven el encuadre al
    cambiar de modalidad.
    """
    print("- Fotografia tecnica: hojas completas registradas")
    out = os.path.join(IMG, "fotografia-tecnica")
    for face in FACES:
        ref = tech(face, "vis")
        th = int(round(TARGET_W * ref.height / ref.width))
        for mod in MODS:
            im = tech(face, mod).resize((TARGET_W, th), Image.LANCZOS)
            save(im, os.path.join(out, "%s-%s.webp" % (face, mod)))


def build_historia():
    print("- La pieza: ortofotografias y detalles")
    out = os.path.join(IMG, "historia")
    for face in ORTHO:
        im = ortho(face)
        save(im, os.path.join(out, face + ".webp"),
             w=max(1, round(im.width * 1800 / im.height)), quality=78, alpha=True)

    h2a, h2p, h1a = tech("h2-anterior", "vis"), tech("h2-posterior", "vis"), tech("h1-anterior", "vis")
    save(frac_crop(h2a, 0.585, 0.00, 0.735, 0.92), os.path.join(out, "detalle-bisagra.webp"), w=900)
    save(frac_crop(h2p, 0.365, 0.16, 0.635, 0.84), os.path.join(out, "detalle-pergamino.webp"), w=1100)
    save(frac_crop(h1a, 0.255, 0.02, 0.395, 0.98), os.path.join(out, "detalle-marmoleado-verde.webp"), w=900)
    save(frac_crop(h2a, 0.395, 0.24, 0.635, 0.72), os.path.join(out, "detalle-motivo-vegetal.webp"), w=1200)


def build_recreacion():
    print("- Recreacion")
    out = os.path.join(IMG, "recreacion")
    rec = alpha_crop(Image.open(os.path.join(DOC, u"RecreaciónEstadoOriginalPuerta.png")).convert("RGBA"))
    save(rec, os.path.join(out, "estado-original.webp"), w=1000, quality=84, alpha=True)

    mot = alpha_crop(Image.open(os.path.join(DOC, "MotivoVegetal.png")).convert("RGBA"))
    save(mot, os.path.join(out, "motivo-vegetal.webp"), w=600, quality=86, alpha=True)

    # Cenefa: el mismo motivo girado y tenido de oro, para el separador ornamental.
    band = mot.rotate(90, expand=True, resample=Image.BICUBIC)
    band = band.resize((1400, round(band.height * 1400 / band.width)), Image.LANCZOS)
    gold = Image.new("RGBA", band.size, (200, 153, 46, 0))
    gold.putalpha(band.getchannel("A"))
    save(gold, os.path.join(out, "cenefa.webp"), quality=88, alpha=True)

    save(frac_crop(tech("h2-anterior", "vis"), 0.395, 0.24, 0.635, 0.72),
         os.path.join(out, "detalle-motivo-original.webp"), w=1200)

    # Contacto de las cuatro caras: el resultado de la fotogrametria de un vistazo.
    pads = [ortho(f) for f in ("hoja1-anterior", "hoja1-posterior", "hoja2-anterior", "hoja2-posterior")]
    pads = [p.resize((round(p.width * 1600 / p.height), 1600), Image.LANCZOS) for p in pads]
    gap = 40
    sheet = Image.new("RGB", (sum(p.width for p in pads) + gap * 5, 1600 + gap * 2), BG)
    x = gap
    for p in pads:
        sheet.paste(p, (x, gap), p)
        x += p.width + gap
    save(sheet, os.path.join(out, "cuatro-caras.webp"), w=1800)


def build_detalles_tecnicos():
    """Detalles de dos cuarterones en las cuatro modalidades, para los comparadores."""
    print("- Fotografia tecnica: detalles multibanda")
    out = os.path.join(IMG, "fotografia-tecnica")
    ref = tech("h2-anterior", "vis")
    central = (0.395, 0.20, 0.640, 0.76)    # cuarteron central, cara anterior de la Hoja 2
    izquierdo = (0.045, 0.10, 0.300, 0.90)  # cuarteron izquierdo de la misma cara
    for mod in MODS:
        src = tech("h2-anterior", mod).resize(ref.size, Image.LANCZOS)
        save(frac_crop(src, *central), os.path.join(out, "detalle-central-%s.webp" % mod), w=1200)
        save(frac_crop(src, *izquierdo), os.path.join(out, "detalle-izquierdo-%s.webp" % mod), w=1000)


def build_hsi():
    print("- HSI: zonas analizadas")
    out = os.path.join(IMG, "hsi")
    h2a, h2p, h1a = tech("h2-anterior", "vis"), tech("h2-posterior", "vis"), tech("h1-anterior", "vis")
    save(frac_crop(h2a, 0.435, 0.30, 0.560, 0.66), os.path.join(out, "detalle-mancha-oscura.webp"), w=1000)
    save(frac_crop(h2p, 0.375, 0.22, 0.520, 0.80), os.path.join(out, "detalle-banda-roja.webp"), w=900)
    save(frac_crop(h1a, 0.255, 0.04, 0.360, 0.96), os.path.join(out, "detalle-marmoleado-verde.webp"), w=800)


def build_miniaturas_y_og():
    print("- Miniaturas 3:2 y Open Graph")
    h2a = tech("h2-anterior", "vis")
    rec = alpha_crop(Image.open(os.path.join(DOC, u"RecreaciónEstadoOriginalPuerta.png")).convert("RGBA"))
    uvf = tech("h2-anterior", "uvf").resize(h2a.size, Image.LANCZOS)
    thumbs = {
        "historia": frac_crop(ortho("hoja2-anterior"), 0.0, 0.30, 1.0, 0.55),
        "recreacion": frac_crop(rec, 0.10, 0.30, 0.92, 0.62),
        "fotografia-tecnica": frac_crop(uvf, 0.36, 0.12, 0.70, 0.88),
        "hsi": frac_crop(h2a, 0.40, 0.22, 0.64, 0.74),
    }
    for name, im in thumbs.items():
        save(cover(flatten(im), 800, 533), os.path.join(IMG, name, "thumbnail.webp"))

    og_path = os.path.join(ROOT, "assets", "og", "preview.jpg")
    os.makedirs(os.path.dirname(og_path), exist_ok=True)
    cover(flatten(frac_crop(h2a, 0.36, 0.10, 0.72, 0.90)), 1200, 630).save(
        og_path, "JPEG", quality=86, optimize=True)
    print("  %s" % os.path.relpath(og_path, ROOT))


def build_puerta():
    """Reduce los fotogramas de la animacion y genera poster y fondo del vano."""
    from PIL import ImageFilter
    import glob
    frames = sorted(glob.glob(os.path.join(ROOT, "assets", "door", "frames", "door_*.webp")))
    if not frames:
        print("- Puerta: no hay fotogramas en assets/door/frames, se omite")
        return
    print("- Puerta: %d fotogramas" % len(frames))
    total = 0
    for p in frames:
        im = Image.open(p).convert("RGB")
        if im.width > 1200:
            im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
            im.save(p, "WEBP", quality=74, method=6)
        total += os.path.getsize(p)
    print("  total %.2f MB" % (total / 1e6))

    first = Image.open(frames[0]).convert("RGB")
    first.save(os.path.join(ROOT, "assets", "door", "poster.webp"), "WEBP", quality=82, method=6)
    last = Image.open(frames[-1]).convert("RGB")
    bg = last.filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.55))
    bg.save(os.path.join(ROOT, "assets", "door", "background.webp"), "WEBP", quality=72, method=6)
    print("  poster.webp y background.webp")


if __name__ == "__main__":
    build_tecnica()
    build_detalles_tecnicos()
    build_historia()
    build_recreacion()
    build_hsi()
    build_miniaturas_y_og()
    build_puerta()
    print("Listo.")
