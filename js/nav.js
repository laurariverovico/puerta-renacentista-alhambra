/* nav.js — Barra de navegación persistente
   Especificación: RF-05, RF-06

   Controla la visibilidad de la barra, marca la sección activa y el menú móvil.
*/

let nav = null;
let navToggle = null;
let navMenu = null;
const observerOptions = {
  root: null,
  rootMargin: '-50% 0px -50% 0px', // Marca como activa cuando está en el centro
  threshold: 0,
};

export function initNav() {
  nav = document.querySelector('[data-nav]');
  navToggle = nav?.querySelector('.nav-toggle');
  navMenu = nav?.querySelector('ul');

  if (!nav || !navToggle || !navMenu) return;

  setupNavToggle();
  setupNavObserver();
  setupScrollListener();
  setupNavLinks();
}

function setupNavToggle() {
  navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
  });

  // Cerrar menú al hacer clic en un enlace
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  });

  // Cerrar menú con Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('open')) {
      navMenu.classList.remove('open');
      navToggle.focus();
    }
  });
}

function setupNavObserver() {
  const sections = document.querySelectorAll('[data-zone]');
  if (sections.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const link = nav.querySelector(`a[href="#${id}"]`);

      if (entry.isIntersecting && link) {
        // Remover aria-current de todos los links
        nav.querySelectorAll('a').forEach(a => {
          a.removeAttribute('aria-current');
        });

        // Añadir aria-current al link activo
        link.setAttribute('aria-current', 'location');
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));
}

function setupScrollListener() {
  const doorSection = document.querySelector('[data-door]');
  let animationId = null;

  const handleScroll = () => {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(() => {
      if (doorSection && window.scrollY > doorSection.offsetTop) {
        nav.classList.add('visible');
      } else {
        nav.classList.remove('visible');
      }
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
}

function setupNavLinks() {
  // Los enlaces internos se manejan con el scroll suave por defecto
  // Pero podemos añadir un pequeño delay para que la barra se cierre
  nav.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const target = document.querySelector(href);

      if (target && href !== '#inicio') {
        // Cerrar menú móvil
        if (navMenu) navMenu.classList.remove('open');

        // Esperar a que la transición de scroll termine
        setTimeout(() => {
          // La navegación se maneja por el comportamiento suave de scroll
        }, 300);
      }
    });
  });
}
