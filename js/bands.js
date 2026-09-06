/* bands.js — Selector de banda espectral
   Especificación: RF-10

   Permite alternar entre diferentes bandas/composiciones de una imagen hiperespectral.
   Compatible con ratón y teclado.
*/

export function initBands() {
  const containers = document.querySelectorAll('[data-bands]');
  containers.forEach(container => {
    setupBands(container);
  });
}

function setupBands(container) {
  const buttons = container.querySelectorAll('.band-button');
  const images = container.querySelectorAll('.bands-image');
  const wavelengthDisplay = container.querySelector('[data-wavelength]');

  if (buttons.length === 0 || images.length === 0) return;

  // Crear un mapa de datos de banda (banda, longitud de onda, descripción)
  const bandData = Array.from(buttons).map((btn, index) => ({
    button: btn,
    image: images[index] || null,
    wavelength: btn.textContent,
  }));

  const selectBand = (index) => {
    // Actualizar vista
    bandData.forEach((data, i) => {
      data.button.setAttribute('aria-selected', i === index ? 'true' : 'false');
      if (data.image) {
        data.image.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      }
    });

    // Actualizar display de longitud de onda
    if (wavelengthDisplay) {
      wavelengthDisplay.textContent = `Banda activa: ${bandData[index].wavelength}`;
    }
  };

  // Event listeners para botones
  bandData.forEach((data, index) => {
    data.button.addEventListener('click', () => {
      selectBand(index);
    });

    // Navegación con flechas
    data.button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        const nextIndex = (index + 1) % bandData.length;
        selectBand(nextIndex);
        bandData[nextIndex].button.focus();
      } else if (e.key === 'ArrowLeft') {
        const prevIndex = (index - 1 + bandData.length) % bandData.length;
        selectBand(prevIndex);
        bandData[prevIndex].button.focus();
      } else if (e.key === 'Home') {
        selectBand(0);
        bandData[0].button.focus();
      } else if (e.key === 'End') {
        selectBand(bandData.length - 1);
        bandData[bandData.length - 1].button.focus();
      }
    });
  });

  // Inicializar primera banda como activa
  selectBand(0);
}
