"""build_model.py — Prepara el modelo fotogramétrico para la web.

Convierte los .glb/.obj de RealityScan (180 MB por hoja, ~1 M de triángulos,
textura de 4096 px) en un GLB que GitHub Pages pueda servir: geometría
decimada, textura reducida a WebP y compresión Draco.

Se ejecuta con Blender en segundo plano, nunca con `python` a secas:

    blender --background --factory-startup --python tools/build_model.py -- --stage prepare
    blender --background --factory-startup --python tools/build_model.py -- --stage export

`prepare` es la fase cara (importar y decimar). Deja el resultado en
tools/.cache/puerta_prep.blend y una hoja de contactos con seis vistas para
comprobar qué se ha importado. `export` parte de esa caché, así que se puede
repetir en segundos mientras se ajustan calidades.

Especificación: RF-13, spec/assets.md §5.
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# --- Rutas -------------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "assets", "model")

# Origen por defecto: la carpeta de modelos que queda fuera del repositorio.
DEFAULT_SRC = os.path.abspath(os.path.join(
    ROOT, "..", "TFM modelos puerta Laura 3",
    "TFM modelos puerta Laura", "TFM modelos puerta Laura"))

# Cada hoja: de qué fichero sale, cómo se llama su objeto en la escena de
# Blender del estudio, en qué lado del vano va, si hay que darle la vuelta y a
# qué escala.
#
# `flip` gira la hoja 180° sobre su eje vertical. El alineado automático deja
# las tablas de pie, pero no sabe cuál de las dos caras es la anterior ni de
# qué lado quedan las bisagras: eso se decide mirando
# tools/.cache/vista_frontal.png y se anota aquí.
#
# `escala` corrige que las dos hojas se procesaran por separado en RealityScan
# y salieran con tamaños distintos —41,89 frente a 38,98 unidades de alto,
# cuando en la pieza real miden lo mismo—. El factor no es una estimación: es
# el que Laura ajustó en su escena de Blender, y se puede volver a leer de allí
# con `--blend <ruta>`.
LEAVES = [
    {"id": "hoja-1", "file": "puerta2.glb", "objeto": "PUERTA1_pequenito",
     "lado": "derecha", "flip": False, "escala": 1.0},
    {"id": "hoja-2", "file": "puerta1.glb", "objeto": "PUERTA2_YUJUUU",
     "lado": "izquierda", "flip": True, "escala": 0.923},
]


# Los tres niveles de calidad. El visor descarga el primero al instante, luego
# el segundo, y el tercero solo si el lector lo pide.
#
# La pieza es una tabla plana con relieve poco profundo: casi toda la
# informacion visible esta en la textura, no en la malla. Por eso el reparto
# del peso favorece la textura (4096 px) frente al numero de triangulos, que es
# lo contrario de lo que conviene en un objeto de forma complicada.
TIERS = [
    {
        "id": "previa", "fichero": "puerta-preview.glb", "etiqueta": "Vista previa",
        "tris": 30000, "tex": 1024, "quality": 80, "uv_bits": 12, "auto": True,
    },
    {
        "id": "estandar", "fichero": "puerta.glb", "etiqueta": "Estandar",
        "tris": 300000, "tex": 4096, "quality": 90, "uv_bits": 14, "auto": True,
    },
    {
        "id": "maxima", "fichero": "puerta-alta.glb", "etiqueta": "Maxima",
        "tris": None, "tex": 4096, "quality": 95, "uv_bits": 14, "auto": False,
    },
]


def log(msg):
    print("[build_model] " + str(msg), flush=True)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--stage", choices=["prepare", "realign", "export", "all"], default="all")
    p.add_argument("--src", default=DEFAULT_SRC)
    p.add_argument("--blend", default=None,
                   help="escena de Blender del estudio de la que releer la escala "
                        "de cada hoja antes de importar")
    p.add_argument("--tier", default="todos",
                   choices=["todos"] + [t["id"] for t in TIERS],
                   help="que nivel de calidad exportar")
    return p.parse_args(argv)


# --- Utilidades de escena ----------------------------------------------------

def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def bake_transform(obj):
    """Funde la transformación del objeto en la malla y lo deja en el origen.

    No se usa bpy.ops.object.transform_apply: dentro de un script sin interfaz
    lee una matriz que todavía no se ha reevaluado y aplica la anterior, de
    modo que las rotaciones se pierden en silencio. Transformar los vértices
    directamente es además más rápido con mallas de un millón de caras.
    """
    bpy.context.view_layer.update()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)


def weld(obj):
    """Suelda los vertices duplicados. Es el paso mas importante del script.

    RealityScan entrega cada triangulo con sus tres vertices propios: 2.956.015
    vertices para 985.561 caras, es decir, una sopa de triangulos sin aristas
    compartidas. Sobre una malla asi el decimado por colapso de aristas no
    tiene aristas que colapsar, de modo que se limita a tirar triangulos
    sueltos y el resultado se deshilacha hasta parecer una nube de puntos. Las
    UV viven en los bucles, no en los vertices, asi que soldar no rompe el
    atlas: el exportador vuelve a separar solo en las costuras.
    """
    import bmesh
    antes = len(obj.data.vertices)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(obj.data)
    bm.free()
    log("  " + obj.name + ": " + format(antes, ",") + " -> " +
        format(len(obj.data.vertices), ",") + " vertices tras soldar")


def shade_smooth(obj):
    """Pasa la malla a sombreado suave.

    RealityScan entrega las hojas en sombreado plano: cada triangulo lleva su
    propia normal, de modo que la malla exportada tiene tres vertices por cara
    (899.762 vertices para 300.000 triangulos). Eso se ve como un granulado
    oscuro sobre toda la superficie, que se confunde con suciedad de la pieza y
    tapa la veta de la madera. Con normales compartidas el granulado desaparece
    y, de paso, hay tres veces menos vertices que comprimir.
    """
    obj.data.shade_smooth()


def leer_escalas(ruta):
    """Relee de la escena del estudio a qué escala está puesta cada hoja.

    Se hace antes de importar nada, porque abrir el .blend descarta la escena
    actual. Devuelve el factor uniforme de cada objeto; si la escala no es
    uniforme se avisa y se toma el eje Z, que es el de la altura.
    """
    log("leyendo escalas de " + os.path.basename(ruta) + "...")
    bpy.ops.wm.open_mainfile(filepath=ruta)
    bpy.context.view_layer.update()
    escalas = {}
    for leaf in LEAVES:
        obj = bpy.data.objects.get(leaf["objeto"])
        if not obj:
            log("  AVISO: no hay ningun objeto llamado " + leaf["objeto"])
            continue
        sx, sy, sz = (round(v, 4) for v in obj.scale)
        if not (sx == sy == sz):
            log("  AVISO: " + leaf["objeto"] + " tiene escala no uniforme " +
                str((sx, sy, sz)) + "; se usa la de Z")
        escalas[leaf["id"]] = sz
        log("  " + leaf["objeto"] + " -> escala " + str(sz))
    return escalas


def scale(obj, factor):
    obj.data.transform(Matrix.Scale(factor, 4))


def strip_color_attributes(obj):
    """Los colores por vertice de RealityScan duplican lo que ya trae la textura.

    Con 2,7 millones de vertices y dos capas son decenas de MB que no se ven.
    """
    removed = 0
    while obj.data.color_attributes:
        obj.data.color_attributes.remove(obj.data.color_attributes[0])
        removed += 1
    if removed:
        log("  " + obj.name + ": " + str(removed) + " capa(s) de color por vertice eliminadas")


def decimate(obj, target_tris):
    current = triangles(obj)
    if current <= target_tris:
        log("  " + obj.name + ": " + format(current, ",") + " tri, no hace falta decimar")
        return
    ratio = target_tris / current
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("reduccion", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log("  " + obj.name + ": " + format(current, ",") + " -> " +
        format(triangles(obj), ",") + " tri (ratio " + format(ratio, ".4f") + ")")


def vertices_np(obj):
    """Coordenadas de mundo de la malla, como array de numpy.

    obj.bound_box y obj.dimensions son datos derivados: no se refrescan hasta
    que Blender reevalúa el depsgraph, así que dentro de un script devuelven la
    caja de antes de la última rotación. Leer los vértices evita esa trampa.
    """
    import numpy as np
    n = len(obj.data.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    m = np.array(obj.matrix_world, dtype=np.float32)
    return co @ m[:3, :3].T + m[:3, 3]


def world_bbox(objs):
    import numpy as np
    todos = np.concatenate([vertices_np(o) for o in objs])
    return Vector(todos.min(axis=0).tolist()), Vector(todos.max(axis=0).tolist())


def dimensions_of(obj):
    """obj.dimensions se queda obsoleto hasta que el depsgraph se refresca."""
    lo, hi = world_bbox([obj])
    return hi - lo


def rotate(obj, axis, degrees):
    obj.data.transform(Matrix.Rotation(math.radians(degrees), 4, axis.upper()))


def translate(obj, vector):
    obj.data.transform(Matrix.Translation(vector))


def orient_upright(obj):
    """Deja la hoja de pie: grosor en Y, anchura en X, altura en Z.

    Dos giros. Primero se lleva a Y el eje corto de la caja envolvente, que en
    una tabla es siempre el grosor. Despues se alinea con Z el eje largo de la
    propia madera: las hojas no salen de RealityScan en horizontal ni en
    vertical, sino inclinadas, y una caja envolvente sin girar mide la diagonal
    en lugar de la pieza (la hoja 2 daba 39 x 32 cuando en realidad es mucho
    mas estrecha que alta). El eje principal se saca por componentes
    principales sobre los vertices proyectados en el plano XZ.
    """
    bake_transform(obj)
    dims = list(dimensions_of(obj))
    thin = dims.index(min(dims))
    if thin == 2:            # grosor en Z: la tabla esta tumbada
        rotate(obj, "x", 90)
    elif thin == 0:          # grosor en X: la tabla esta de canto
        rotate(obj, "z", 90)

    import numpy as np
    co = vertices_np(obj)
    plano = co[::max(1, len(co) // 40000), ::2]            # muestra en XZ
    plano = plano - plano.mean(axis=0)
    autovalores, autovectores = np.linalg.eigh(np.cov(plano.T))
    px, pz = autovectores[:, int(np.argmax(autovalores))]
    if pz < 0:                      # el signo del autovector es arbitrario;
        px, pz = -px, -pz           # fijarlo hace repetible el resultado
    rotate(obj, "y", math.degrees(math.atan2(-px, pz)))

    if dimensions_of(obj).x > dimensions_of(obj).z:        # aun acostada
        rotate(obj, "y", 90)
    return dimensions_of(obj)


def place_closed(objs):
    """Coloca las dos hojas juntas y cerradas: se tocan en x = 0.

    Cada hoja va al lado que indica LEAVES, con su canto interior en x = 0, de
    modo que la bisagra es siempre el canto exterior. Ambas apoyan en z = 0 y
    tienen el grosor centrado en y = 0. Antes se les da la vuelta a las que lo
    necesiten para que las dos enseñen su cara anterior hacia -Y.
    """
    lados = {leaf["id"]: leaf for leaf in LEAVES}
    bisagras = {}
    for obj in objs:
        config = lados.get(obj.name, {})
        # La marca evita que --stage realign vuelva a voltear lo ya volteado.
        if bool(config.get("flip")) != bool(obj.get("volteada", False)):
            rotate(obj, "z", 180)
            obj["volteada"] = bool(config.get("flip"))
        if config.get("invertir"):
            rotate(obj, "y", 180)
        izquierda = config.get("lado", "izquierda") == "izquierda"
        lo, hi = world_bbox([obj])
        dx = -hi.x if izquierda else -lo.x
        translate(obj, Vector((dx, -(lo.y + hi.y) / 2, -lo.z)))
        lo, hi = world_bbox([obj])
        bisagras[obj.name] = {
            "lado": "izquierda" if izquierda else "derecha",
            "x": round(lo.x if izquierda else hi.x, 4),
        }
    return bisagras


def resize_textures(px, label=""):
    for img in bpy.data.images:
        if img.size[0] > px or img.size[1] > px:
            before = tuple(img.size)
            img.scale(px, px)
            log("  textura " + img.name + ": " + str(before[0]) + "x" + str(before[1]) +
                " -> " + str(px) + "x" + str(px) + " " + label)


# --- Fase 1: preparar --------------------------------------------------------

def stage_prepare(args):
    os.makedirs(CACHE, exist_ok=True)
    escalas = leer_escalas(args.blend) if args.blend else {}
    wipe()

    for leaf in LEAVES:
        path = os.path.join(args.src, leaf["file"])
        if not os.path.exists(path):
            log("AVISO: no se encuentra " + path + ", se omite")
            continue
        log("importando " + leaf["file"] + " (" +
            format(os.path.getsize(path) / 1e6, ".0f") + " MB)...")
        before = set(bpy.data.objects)
        if path.lower().endswith((".glb", ".gltf")):
            bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
        else:
            bpy.ops.wm.obj_import(filepath=path)
        nuevos = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
        if not nuevos:
            log("AVISO: " + leaf["file"] + " no ha traido ninguna malla")
            continue
        obj = max(nuevos, key=triangles)          # la malla principal
        for extra in nuevos:
            if extra is not obj:
                bpy.data.objects.remove(extra, do_unlink=True)
        for empty in [o for o in bpy.data.objects if o.type == "EMPTY"]:
            bpy.data.objects.remove(empty, do_unlink=True)
        obj.name = leaf["id"]
        obj.data.name = leaf["id"]
        strip_color_attributes(obj)
        weld(obj)
        shade_smooth(obj)
        factor = escalas.get(leaf["id"], leaf.get("escala", 1.0))
        if factor != 1.0:
            scale(obj, factor)
            log("  " + obj.name + ": escalada x" + str(factor))
        dims = orient_upright(obj)
        log("  " + obj.name + ": " + format(dims.x, ".2f") + " x " +
            format(dims.y, ".2f") + " x " + format(dims.z, ".2f") + " unidades")

    bisagras = place_closed(mesh_objects())
    for nombre, b in bisagras.items():
        log("  bisagra de " + nombre + ": lado " + b["lado"] + ", x = " + str(b["x"]))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CACHE, "puerta_prep.blend"))
    log("cache guardada en tools/.cache/puerta_prep.blend")
    contact_sheet()


def stage_realign(args):
    """Vuelve a orientar y colocar las hojas sobre la caché ya importada.

    Importar los dos .glb cuesta un par de minutos; ajustar la colocación, no.
    """
    load_cache()
    for obj in mesh_objects():
        dims = orient_upright(obj)
        log("  " + obj.name + ": " + format(dims.x, ".2f") + " x " +
            format(dims.y, ".2f") + " x " + format(dims.z, ".2f") + " unidades")
    for nombre, b in place_closed(mesh_objects()).items():
        log("  bisagra de " + nombre + ": lado " + b["lado"] + ", x = " + str(b["x"]))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CACHE, "puerta_prep.blend"))
    contact_sheet()


def contact_sheet():
    """Seis vistas rapidas para comprobar que contiene realmente el modelo."""
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x = 900
    scn.render.resolution_y = 900
    scn.display.shading.light = "STUDIO"
    scn.display.shading.color_type = "TEXTURE"

    objs = mesh_objects()
    if not objs:
        return
    lo, hi = world_bbox(objs)
    center = (lo + hi) / 2
    radius = max((hi - lo).x, (hi - lo).y, (hi - lo).z)

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam

    vistas = {
        "frontal": (0, 0), "posterior": (0, 180), "lateral": (0, 90),
        "cenital": (80, 0), "tres-cuartos": (25, 35), "rasante": (5, 70),
    }
    for nombre, (elev, azim) in vistas.items():
        e, a = math.radians(elev), math.radians(azim)
        d = radius * 1.9
        offset = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = center + offset * d
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        scn.render.filepath = os.path.join(CACHE, "vista_" + nombre + ".png")
        bpy.ops.render.render(write_still=True)
        log("  vista " + nombre + " -> tools/.cache/vista_" + nombre + ".png")


# --- Fase 2: exportar --------------------------------------------------------

def export_glb(path, quality, uv_bits=14, pos_bits=14, nrm_bits=10):
    """Exporta el GLB con Draco.

    Los bits de cuantizacion importan mas de lo que parece. Con la textura de
    4096 px, cuantizar las UV a 11 bits deja 2048 posiciones posibles para
    4096 texeles: cada vertice se desplaza hasta medio texel y la textura
    aparece emborronada y con moteado en los bordes de cada isla del atlas.
    Con 14 bits el error baja por debajo del texel y el problema desaparece.
    Cuesta menos de un 10 % de tamano.
    """
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=quality,
        export_unused_images=False,
        export_unused_textures=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=pos_bits,
        export_draco_normal_quantization=nrm_bits,
        export_draco_texcoord_quantization=uv_bits,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    log("  -> " + os.path.relpath(path, ROOT) + "  " +
        format(os.path.getsize(path) / 1e6, ".2f") + " MB")
    return os.path.getsize(path)


def load_cache():
    cache = os.path.join(CACHE, "puerta_prep.blend")
    bpy.ops.wm.open_mainfile(filepath=cache)
    for cam in [o for o in bpy.data.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(cam, do_unlink=True)
    for obj in mesh_objects():
        shade_smooth(obj)          # por si la cache es anterior a este cambio


def stage_export(args):
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(os.path.join(CACHE, "puerta_prep.blend")):
        log("no hay cache: ejecuta antes --stage prepare")
        return

    pedidos = [t for t in TIERS if args.tier in ("todos", t["id"])]
    if not pedidos:
        log("no hay ningun nivel llamado " + args.tier)
        return

    pesos = {}
    medidas_por_hoja = None
    for tier in pedidos:
        log("nivel " + tier["id"] + ": " + tier["etiqueta"])
        load_cache()
        if tier["tris"]:
            for obj in mesh_objects():
                decimate(obj, tier["tris"])
        else:
            log("  malla completa, sin decimar")
        resize_textures(tier["tex"])
        bytes_glb = export_glb(
            os.path.join(OUT, tier["fichero"]), tier["quality"], uv_bits=tier["uv_bits"])
        pesos[tier["id"]] = {
            "bytes": bytes_glb,
            "triangulos": sum(triangles(o) for o in mesh_objects()),
        }
        if tier["id"] == "estandar":
            medidas_por_hoja = medidas()
            render_fallback()

    if medidas_por_hoja is None:
        medidas_por_hoja = medidas()
    escribir_manifiesto(medidas_por_hoja, pesos)


def render_fallback():
    """Render estático: es el estado inicial de la sección y la alternativa
    cuando no hay WebGL (D-06). Fondo transparente, para que encaje sobre la
    banda oscura."""
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x = 1400
    scn.render.resolution_y = 1000
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = "WEBP"
    scn.render.image_settings.quality = 82
    scn.display.shading.light = "STUDIO"
    scn.display.shading.color_type = "TEXTURE"

    objs = mesh_objects()
    lo, hi = world_bbox(objs)
    centro = (lo + hi) / 2
    tam = hi - lo

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam

    # Distancia a la que la pieza entra entera. Con sensor AUTO el angulo de la
    # camara es el horizontal, asi que el vertical hay que deducirlo de la
    # proporcion del fotograma; si no, una pieza alta en un formato apaisado
    # sale recortada por arriba.
    ancho_px, alto_px = scn.render.resolution_x, scn.render.resolution_y
    fov_h = cam_data.angle
    fov_v = 2 * math.atan(math.tan(fov_h / 2) * alto_px / ancho_px)
    diagonal = math.hypot(tam.x, tam.y)          # la vista es de tres cuartos
    distancia = 1.12 * max((tam.z / 2) / math.tan(fov_v / 2),
                           (diagonal / 2) / math.tan(fov_h / 2))

    e, a = math.radians(10), math.radians(24)
    offset = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = centro + offset * distancia
    cam.rotation_euler = (centro - cam.location).to_track_quat("-Z", "Y").to_euler()
    scn.render.filepath = os.path.join(OUT, "fallback.webp")
    bpy.ops.render.render(write_still=True)
    log("  -> assets/model/fallback.webp")


def medidas():
    datos = {}
    for obj in mesh_objects():
        lo, hi = world_bbox([obj])
        datos[obj.name] = {
            "triangulos": triangles(obj),
            "bboxMin": [round(v, 4) for v in lo],
            "bboxMax": [round(v, 4) for v in hi],
            "dimensiones": [round(hi[i] - lo[i], 4) for i in range(3)],
        }
    return datos


def escribir_manifiesto(medidas_por_hoja, pesos=None):
    """Deja en assets/model/puerta.json lo que el visor necesita saber.

    El visor lee este fichero, no valores incrustados en el codigo: la
    alineacion de las hojas, la posicion de las bisagras y los niveles de
    calidad disponibles se afinan aqui, o con el modo de calibracion del propio
    visor (?calibrar=1).
    """
    destino = os.path.join(OUT, "puerta.json")
    anterior = {}
    if os.path.exists(destino):
        with open(destino, encoding="utf-8") as f:
            anterior = json.load(f)

    calidades = []
    for tier in TIERS:
        ruta = os.path.join(OUT, tier["fichero"])
        if not os.path.exists(ruta):
            continue
        medido = (pesos or {}).get(tier["id"], {})
        calidades.append({
            "id": tier["id"],
            "fichero": tier["fichero"],
            "etiqueta": {"previa": "Vista previa", "estandar": "Estándar",
                         "maxima": "Máxima"}[tier["id"]],
            "mb": round(os.path.getsize(ruta) / 1e6, 1),
            "triangulos": medido.get("triangulos", 0),
            "textura": tier["tex"],
            "auto": tier["auto"],
        })

    # El eje X no cambia al pasar de Blender (Z arriba) a glTF (Y arriba),
    # asi que la X de la bisagra sirve tal cual en el visor.
    hojas = []
    for leaf in LEAVES:
        medida = medidas_por_hoja.get(leaf["id"])
        if not medida:
            continue
        izquierda = leaf["lado"] == "izquierda"
        hojas.append({
            "nodo": leaf["id"],
            "etiqueta": leaf["id"].replace("hoja-", "Hoja "),
            "lado": leaf["lado"],
            "bisagraX": medida["bboxMin"][0] if izquierda else medida["bboxMax"][0],
        })

    # La escala metrica se guarda como la medida tomada en la pieza, no como el
    # factor: asi sobrevive a regenerar el modelo con otra decimacion o con
    # otra escala relativa entre hojas, porque el factor se recalcula sobre la
    # altura que tenga la malla en ese momento.
    altura_real_cm = anterior.get("alturaRealCm")
    altura_real_de = anterior.get("alturaRealDe", LEAVES[0]["id"])
    metros_por_unidad = anterior.get("metrosPorUnidad")
    referencia = medidas_por_hoja.get(altura_real_de)
    if altura_real_cm and referencia:
        metros_por_unidad = round((altura_real_cm / 100) / referencia["dimensiones"][2], 8)
        log("  escala: " + altura_real_de + " mide " + str(altura_real_cm) +
            " cm -> " + str(metros_por_unidad) + " m por unidad")

    manifiesto = {
        "calidades": calidades,
        # Altura real de una hoja, medida en la pieza. De aqui sale la escala.
        "alturaRealCm": altura_real_cm,
        "alturaRealDe": altura_real_de,
        "metrosPorUnidad": metros_por_unidad,
        "alturaEncuadre": anterior.get("alturaEncuadre", 2.0),
        "aperturaMaxima": anterior.get("aperturaMaxima", 100),
        # Las pletinas de los goznes estan en la cara anterior, asi que las
        # hojas abren hacia quien mira. -1 invierte el giro.
        "sentidoApertura": anterior.get("sentidoApertura", -1),
        "hojas": anterior.get("hojas") or hojas,
        "camara": anterior.get("camara", {"azimut": 0, "elevacion": 6, "distancia": 1.05}),
        "puntos": anterior.get("puntos", []),
        "medidas": medidas_por_hoja,
    }
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(manifiesto, f, ensure_ascii=False, indent=2)
    log("  -> assets/model/puerta.json")


def main():
    args = parse_args()
    log("Blender " + bpy.app.version_string + " . stage=" + args.stage)
    if args.stage in ("prepare", "all"):
        stage_prepare(args)
    if args.stage == "realign":
        stage_realign(args)
    if args.stage in ("export", "all"):
        stage_export(args)
    log("terminado")


if __name__ == "__main__":
    main()
