/* door-scroll.js — Animación de la puerta controlada por scroll
   Especificación: RF-02, RF-03

   Carga fotogramas y mapea el progreso de scroll a su visualización.
   Fórmula:
     p = clamp(0, 1, (scrollY - inicioSeccion) / (altoSeccion - alturaViewport))
     pPuerta = clamp(0, 1, p / 0.75)
     pEntrada = clamp(0, 1, (p - 0.75) / 0.25)
*/

const config = {
  framePath: './assets/door/frames/door_',
  numFrames: 73, // 73 fotogramas disponibles
  posterPath: './assets/door/poster.webp',
  backgroundPath: './assets/door/background.webp',
  preloadLimit: 6, // Número máximo de peticiones simultáneas
  format: 'webp', // 'webp' o 'png'
};

let frameCache = [];
let isPreloading = true;
let preloadProgress = 0;
let doorSection = null;
let doorContainer = null;
let canvas = null;
let ctx = null;
let entranceOverlay = null;
let lastScrollProgress = 0;

export function initDoorScroll() {
  doorSection = document.querySelector('[data-door]');
  if (!doorSection) return;

  doorContainer = doorSection.querySelector('.door-container');
  canvas = doorSection.querySelector('.door-canvas');
  entranceOverlay = doorSection.querySelector('.entrance-overlay');

  if (!canvas) return;

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('[door-scroll] Canvas 2D context no disponible');
    return;
  }

  // Comprobar prefers-reduced-motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) {
    // Sin animación: mostrar la puerta abierta como imagen fija
    canvas.style.display = 'none';
    doorSection.style.minHeight = '100svh';
    doorContainer.style.height = '100svh';
    doorContainer.style.position = 'relative';
    return;
  }

  // Precargar fotogramas
  preloadFrames().then(() => {
    isPreloading = false;
    console.log('[door-scroll] Fotogramas precargados');

    // Mostrar el canvas y esconder el fallback
    canvas.style.display = 'block';
    const fallback = doorSection.querySelector('.door-fallback');
    if (fallback) fallback.style.display = 'none';

    // Iniciar animación
    setupScrollListener();
    drawFrame(0); // Fotograma inicial
  }).catch(error => {
    // Ningún fotograma disponible: se deja el póster estático, que siempre carga.
    console.error('[door-scroll] Error precargando fotogramas:', error);
    canvas.style.display = 'none';
  });
}

async function preloadFrames() {
  const promises = [];
  let activeRequests = 0;
  let settled = 0;

  for (let i = 1; i <= config.numFrames; i++) {
    // Control de peticiones simultáneas
    while (activeRequests >= config.preloadLimit) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    activeRequests++;
    const frameIndex = String(i).padStart(3, '0');
    const url = `${config.framePath}${frameIndex}.${config.format}`;

    const promise = loadImage(url)
      .then(img => {
        frameCache[i - 1] = img;
      })
      .catch(() => {
        // Un fotograma perdido no debe tumbar la animación entera: al servirse
        // desde un CDN, con 73 peticiones, un fallo suelto es esperable.
        console.warn(`[door-scroll] No se pudo cargar ${url}`);
      })
      .finally(() => {
        activeRequests--;
        preloadProgress = Math.floor((++settled / config.numFrames) * 100);
      });

    promises.push(promise);
  }

  await Promise.all(promises);

  // Compactar: los huecos romperían el mapeo de scroll a fotograma.
  frameCache = frameCache.filter(Boolean);

  if (frameCache.length === 0) {
    throw new Error('No se pudo cargar ningún fotograma de la puerta');
  }
  if (frameCache.length < config.numFrames) {
    console.warn(`[door-scroll] ${config.numFrames - frameCache.length} fotogramas no disponibles; se anima con ${frameCache.length}`);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

function setupScrollListener() {
  let animationId = null;

  const handleScroll = () => {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(() => {
      updateDoorProgress();
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
}

function updateDoorProgress() {
  const p = getScrollProgress();
  const pPuerta = clamp(0, 1, p / 0.75);
  const pEntrada = clamp(0, 1, (p - 0.75) / 0.25);

  // Dibujar fotograma
  if (!isPreloading && frameCache.length > 0) {
    const frameIndex = Math.round(pPuerta * (frameCache.length - 1));
    drawFrame(frameIndex);
  }

  // Zoom y entrada
  if (canvas) {
    if (pEntrada > 0) {
      const scale = 1 + 3 * pEntrada;
      const opacity = 1 - pEntrada;
      canvas.style.transform = `scale(${scale})`;
      canvas.style.opacity = opacity;
    } else {
      // Reset cuando no hay entrada
      canvas.style.transform = 'scale(1)';
      canvas.style.opacity = '1';
    }
  }

  // Entrada al hub
  if (entranceOverlay) {
    entranceOverlay.style.opacity = pEntrada > 0.6 ? 1 : 0;
  }

  // Cambiar fondo
  if (pEntrada > 0) {
    const bgColor = interpolateColor(
      { r: 14, g: 11, b: 9 },  // --c-noche
      { r: 250, g: 247, b: 242 }, // --c-marfil
      pEntrada
    );
    document.body.style.backgroundColor = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
  }

  lastScrollProgress = p;
}

function getScrollProgress() {
  if (!doorSection) return 0;

  const sectionTop = doorSection.offsetTop;
  const sectionHeight = doorSection.offsetHeight;
  const viewportHeight = window.innerHeight;

  const scrollProgress = (window.scrollY - sectionTop) / (sectionHeight - viewportHeight);
  return clamp(0, 1, scrollProgress);
}

function drawFrame(index) {
  if (!canvas || !ctx || !frameCache[index]) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frameCache[index], 0, 0, canvas.width, canvas.height);
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function interpolateColor(from, to, t) {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}
