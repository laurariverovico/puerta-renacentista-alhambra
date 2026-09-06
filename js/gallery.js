/* gallery.js — Galerías con visor ampliado (lightbox)
   Especificación: RF-12

   Maneja miniaturas, modal de ampliación, navegación anterior/siguiente,
   cierre con Esc, foco atrapado.
*/

let currentGallery = null;
let currentImageIndex = 0;
const modal = document.querySelector('#lightbox-modal');

export function initGalleries() {
  if (!modal) return;

  const galleries = document.querySelectorAll('[data-gallery]');
  galleries.forEach(gallery => {
    const items = gallery.querySelectorAll('[data-gallery-item]');
    items.forEach((item, index) => {
      item.addEventListener('click', () => openLightbox(gallery, index));
    });
  });

  // Controles del modal
  const closeBtn = modal.querySelector('.lightbox-close');
  const prevBtn = modal.querySelector('[data-prev]');
  const nextBtn = modal.querySelector('[data-next]');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.close();
      restoreFocus();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      navigateImage(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      navigateImage(1);
    });
  }

  // Cierre con Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.open) {
      modal.close();
      restoreFocus();
    }
  });

  // Navegación con flechas
  document.addEventListener('keydown', (e) => {
    if (!modal.open) return;

    if (e.key === 'ArrowLeft') {
      navigateImage(-1);
    } else if (e.key === 'ArrowRight') {
      navigateImage(1);
    }
  });

  // Bloquear scroll cuando el modal está abierto
  modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) {
      e.preventDefault();
    }
  });

  // Manejar el cierre del formulario del dialog
  modal.addEventListener('close', () => {
    document.body.style.overflow = '';
    restoreFocus();
  });
}

function openLightbox(gallery, imageIndex) {
  currentGallery = gallery;
  currentImageIndex = imageIndex;

  const item = gallery.querySelectorAll('[data-gallery-item]')[imageIndex];
  const img = item.querySelector('img');
  const caption = item.querySelector('.gallery-caption');

  if (!img) return;

  const modalImg = modal.querySelector('.lightbox-image');
  const modalCaption = modal.querySelector('.lightbox-caption');
  const modalCredit = modal.querySelector('.lightbox-credit');

  // Obtener credit del padre o usar vacío
  const credit = item.closest('.gallery')?.getAttribute('data-credit') || '';

  modalImg.src = img.src;
  modalImg.alt = img.alt;
  modalCaption.textContent = caption?.textContent || '';
  modalCredit.textContent = credit;

  // Bloquear scroll
  document.body.style.overflow = 'hidden';

  // Abrir modal y enfocar
  modal.showModal();
  const closeBtn = modal.querySelector('.lightbox-close');
  if (closeBtn) closeBtn.focus();

  // Atrapador de foco
  setupFocusTrap();

  // Guardar elemento original para restaurar foco
  modal._originalFocus = item;
}

function navigateImage(direction) {
  if (!currentGallery) return;

  const items = currentGallery.querySelectorAll('[data-gallery-item]');
  const totalItems = items.length;

  currentImageIndex = (currentImageIndex + direction + totalItems) % totalItems;
  const nextItem = items[currentImageIndex];

  if (nextItem) {
    // Simular clic en el nuevo item sin cerrar el modal
    const img = nextItem.querySelector('img');
    const caption = nextItem.querySelector('.gallery-caption');

    const modalImg = modal.querySelector('.lightbox-image');
    const modalCaption = modal.querySelector('.lightbox-caption');

    modalImg.src = img.src;
    modalImg.alt = img.alt;
    modalCaption.textContent = caption?.textContent || '';
  }
}

function setupFocusTrap() {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeydown = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  modal.addEventListener('keydown', handleKeydown);
  modal._keydownHandler = handleKeydown;
}

function restoreFocus() {
  if (modal._originalFocus) {
    modal._originalFocus.focus();
    modal._originalFocus = null;
  }

  // Remover el manejador del atrapador de foco
  if (modal._keydownHandler) {
    modal.removeEventListener('keydown', modal._keydownHandler);
    modal._keydownHandler = null;
  }
}
