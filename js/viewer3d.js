/* viewer3d.js — Puerta de entrada al visor 3D
   Especificación: RF-13, D-06

   Este módulo es minúsculo a propósito: se carga con el resto de la página y
   lo único que hace es esperar. Ni three.js ni el modelo se descargan hasta
   que alguien pulsa un botón (CA-13.1). El motor vive en viewer3d-core.js y
   llega por import() dinámico.

   Hay dos maneras de abrir el visor, y las dos usan el mismo motor:

     · en la sección propia, <section data-viewer3d> con su render estático y
       su botón «Ver en 3D»;
     · desde cualquier punto del texto, con <button data-viewer3d-open>, que lo
       abre en una capa superpuesta sobre la lectura.
*/

let visorActivo = null;      // sólo puede haber uno: la GPU es una
let dialogo = null;

export function initViewer3D() {
  const soportado = hayWebGL();

  document.querySelectorAll('[data-viewer3d]').forEach((seccion) => {
    const boton = seccion.querySelector('[data-load-viewer]');
    if (!boton) return;
    if (!soportado) return degradar(seccion, boton);

    boton.addEventListener('click', async () => {
      const escenario = seccion.querySelector('.viewer3d-stage');
      const cartel = seccion.querySelector('.viewer3d-poster');
      boton.disabled = true;
      boton.textContent = 'Cargando…';
      // El escenario tiene que ser visible antes de crear el visor: si mide
      // cero, el lienzo arranca con el tamaño por defecto de 300x150.
      cartel?.setAttribute('hidden', '');
      escenario.hidden = false;
      try {
        await abrir(escenario, {
          panel: seccion.querySelector('.viewer3d-panel'),
          onClose: () => {
            cerrar();
            cartel?.removeAttribute('hidden');
            escenario.hidden = true;
            boton.hidden = false;
            boton.focus();
          },
        });
        boton.hidden = true;
      } catch (error) {
        cartel?.removeAttribute('hidden');
        escenario.hidden = true;
        console.error('[viewer3d]', error);
        degradar(seccion, boton, 'No se ha podido cargar el modelo. Se muestra el render estático.');
      } finally {
        boton.disabled = false;
        boton.textContent = 'Ver en 3D';
      }
    });
  });

  document.querySelectorAll('[data-viewer3d-open]').forEach((disparador) => {
    if (!soportado) {
      // Sin WebGL, el botón lleva a la sección con el render estático.
      disparador.addEventListener('click', () => {
        document.querySelector('#modelo-3d')?.scrollIntoView({ behavior: 'smooth' });
      });
      return;
    }
    disparador.addEventListener('click', () => abrirEnCapa(disparador));
  });
}

/* ── Capa superpuesta ──────────────────────────────────────────────────── */

async function abrirEnCapa(disparador) {
  if (!dialogo) dialogo = construirDialogo();
  const escenario = dialogo.querySelector('.viewer3d-stage');
  const panel = dialogo.querySelector('.viewer3d-panel');
  panel.innerHTML = '';

  dialogo.showModal();
  document.body.style.overflow = 'hidden';

  const devolverFoco = () => {
    cerrar();
    dialogo.close();
    document.body.style.overflow = '';
    disparador.focus();                     // CA-13.5
  };

  dialogo.addEventListener('close', devolverFoco, { once: true });

  try {
    await abrir(escenario, { panel, onClose: devolverFoco });
  } catch (error) {
    console.error('[viewer3d]', error);
    panel.innerHTML =
      '<p class="viewer3d-error">No se ha podido cargar el modelo. '
      + 'Puedes ver el render estático en la sección del modelo tridimensional.</p>';
  }
}

function construirDialogo() {
  const elemento = document.createElement('dialog');
  elemento.className = 'viewer3d-dialogo';
  elemento.setAttribute('aria-label', 'Visor tridimensional de la puerta');
  elemento.innerHTML =
    '<div class="viewer3d-stage" data-viewer3d-lienzo></div>'
    + '<div class="viewer3d-panel"></div>';
  document.body.appendChild(elemento);
  return elemento;
}

/* ── Arranque y parada del motor ───────────────────────────────────────── */

async function abrir(escenario, opciones) {
  cerrar();
  const { createViewer } = await import('./viewer3d-core.js');
  visorActivo = await createViewer(escenario, opciones);
  return visorActivo;
}

function cerrar() {
  visorActivo?.destruir();
  visorActivo = null;
}

/* ── Degradación (D-06) ────────────────────────────────────────────────── */

function degradar(seccion, boton, mensaje) {
  boton.hidden = true;
  const aviso = seccion.querySelector('.viewer3d-aviso');
  if (aviso) {
    aviso.hidden = false;
    aviso.textContent = mensaje
      || 'Este navegador no admite WebGL, necesario para el visor tridimensional. '
       + 'Debajo se muestra un render estático del modelo.';
  }
}

/* Comprobación silenciosa: si no hay WebGL no debe quedar ningún error en
   consola (CA-13.3). */
function hayWebGL() {
  try {
    const lienzo = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext
      && (lienzo.getContext('webgl2') || lienzo.getContext('webgl'))
    );
  } catch (error) {
    return false;
  }
}
