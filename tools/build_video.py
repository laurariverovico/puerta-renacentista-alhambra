"""Genera assets/video/ a partir de Animacion.mp4 (RF-17).

El vídeo de partida sale de Blender a 1920×1080, 24 fps y ~7,5 Mb/s (24 MB), con
una pista de audio vacía. Para la web se recodifica sin audio y con `faststart`
para que empiece a reproducirse antes de haberse descargado entero.

Salida:
  assets/video/animacion.mp4         H.264 (High), reproducible en cualquier navegador
  assets/video/animacion-av1.mp4     AV1, ~30 % más ligero; el <video> lo ofrece primero
                                     y el navegador que no lo entienda salta al H.264
  assets/video/animacion-poster.webp fotograma inicial, se muestra hasta que se pulsa play

Uso (hace falta ffmpeg con libx264 y libsvtav1 en el PATH):
  python tools/build_video.py
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Animacion.mp4")
OUT = os.path.join(ROOT, "assets", "video")

# CRF elegidos comparando fotogramas con el original: por debajo de estos valores
# el fichero crece mucho sin que se aprecie la diferencia (las paredes de yeso
# moteado son lo que más cuesta comprimir).
H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "27",
        "-profile:v", "high", "-level", "4.1"]
AV1 = ["-c:v", "libsvtav1", "-preset", "5", "-crf", "36"]
POSTER_SECOND = "0.5"


def run(args):
    print("  $", " ".join(os.path.basename(a) if os.sep in a else a for a in args))
    subprocess.run(args, check=True)


def main():
    if not os.path.exists(SRC):
        sys.exit("No se encuentra %s" % SRC)
    os.makedirs(OUT, exist_ok=True)

    common = ["ffmpeg", "-v", "error", "-y", "-i", SRC, "-an",
              "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

    print("H.264")
    run(common + H264 + [os.path.join(OUT, "animacion.mp4")])
    print("AV1")
    run(common + AV1 + [os.path.join(OUT, "animacion-av1.mp4")])
    print("Cartel")
    run(["ffmpeg", "-v", "error", "-y", "-ss", POSTER_SECOND, "-i", SRC,
         "-frames:v", "1", "-c:v", "libwebp", "-quality", "80",
         os.path.join(OUT, "animacion-poster.webp")])

    for name in sorted(os.listdir(OUT)):
        path = os.path.join(OUT, name)
        print("  %-24s %5.1f MB" % (name, os.path.getsize(path) / 1e6))


if __name__ == "__main__":
    main()
