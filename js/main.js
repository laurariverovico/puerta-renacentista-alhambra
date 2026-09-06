/* main.js — Punto de entrada
   Carga e inicializa todos los módulos.

   Especificación: §9
*/

import { initDoorScroll } from './door-scroll.js';
import { initNav } from './nav.js';
import { initGalleries } from './gallery.js';
import { initCompare } from './compare.js';
import { initBands } from './bands.js';

// Punto de entrada
document.addEventListener('DOMContentLoaded', () => {
  console.log('[TFM Web] Inicializando...');

  // Comprobar prefers-reduced-motion al inicio
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    console.log('[TFM Web] Animaciones reducidas detectadas');
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  }

  // Inicializar cada módulo
  const modules = [
    { name: 'door-scroll', fn: initDoorScroll },
    { name: 'nav', fn: initNav },
    { name: 'galleries', fn: initGalleries },
    { name: 'compare', fn: initCompare },
    { name: 'bands', fn: initBands },
  ];

  modules.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`[TFM Web] ${name} inicializado`);
    } catch (error) {
      console.error(`[TFM Web] Error en ${name}:`, error);
      // No abortar: continuar con otros módulos
    }
  });

  // Visor 3D: carga bajo demanda
  const viewer3dButton = document.querySelector('[data-load-viewer]');
  if (viewer3dButton) {
    viewer3dButton.addEventListener('click', async () => {
      try {
        const { initViewer3D } = await import('./viewer3d.js');
        await initViewer3D();
        viewer3dButton.style.display = 'none';
      } catch (error) {
        console.error('[TFM Web] Error cargando visor 3D:', error);
      }
    });
  }

  // Botones de scroll suave a anclas
  document.querySelectorAll('[data-scroll-to]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(button.getAttribute('data-scroll-to'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  console.log('[TFM Web] Inicialización completa');
});

// Escuchador para cambios en prefers-reduced-motion en tiempo real
window.matchMedia('(prefers-reduced-motion: reduce)').addListener((e) => {
  if (e.matches) {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  } else {
    document.documentElement.removeAttribute('data-reduced-motion');
  }
});
