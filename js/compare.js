/* compare.js — Cortinilla comparativa de imágenes
   Especificación: RF-11

   Permite deslizar un divisor para comparar dos imágenes registradas.
   Compatible con ratón, toque y teclado.
*/

export function initCompare() {
  const containers = document.querySelectorAll('[data-compare]');
  containers.forEach(container => {
    setupCompare(container);
  });
}

function setupCompare(container) {
  const wrapper = container.querySelector('.compare-wrapper');
  const divider = container.querySelector('.compare-divider');
  const range = container.querySelector('.compare-range');
  const imageBefore = container.querySelector('.compare-image-before');
  const imageAfter = container.querySelector('.compare-image-after');

  if (!wrapper || !divider || !range || !imageBefore || !imageAfter) return;

  let isActive = false;

  const updateDivider = (x) => {
    const rect = wrapper.getBoundingClientRect();
    const percentage = clamp(0, 100, ((x - rect.left) / rect.width) * 100);

    divider.style.left = `${percentage}%`;
    imageBefore.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
    imageAfter.style.clipPath = `inset(0 0 0 ${percentage}%)`;
    range.value = percentage;
  };

  // Manejo de ratón
  const handleMouseDown = () => {
    isActive = true;
  };

  const handleMouseUp = () => {
    isActive = false;
  };

  const handleMouseMove = (e) => {
    if (!isActive) return;
    updateDivider(e.clientX);
  };

  // Manejo de toque
  const handleTouchStart = () => {
    isActive = true;
  };

  const handleTouchEnd = () => {
    isActive = false;
  };

  const handleTouchMove = (e) => {
    if (!isActive || !e.touches.length) return;
    updateDivider(e.touches[0].clientX);
  };

  // Manejo de rango (teclado y entrada)
  const handleRangeInput = (e) => {
    const rect = wrapper.getBoundingClientRect();
    const x = rect.left + (rect.width * (e.target.value / 100));
    updateDivider(x);
  };

  // Event listeners
  divider.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('mousemove', handleMouseMove);

  divider.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });

  range.addEventListener('input', handleRangeInput);

  // Prevenir drag en móvil
  wrapper.style.touchAction = 'none';

  // Inicializar con posición 50%
  updateDivider(wrapper.getBoundingClientRect().left + wrapper.getBoundingClientRect().width / 2);
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}
