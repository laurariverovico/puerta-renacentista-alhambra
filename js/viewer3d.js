/* viewer3d.js — Visor 3D interactivo (carga bajo demanda)
   Especificación: RF-13

   Carga three.js desde /vendor y renderiza el modelo .glb.
   Se carga sólo cuando el usuario pulsa el botón "Ver modelo interactivo".
*/

let scene, camera, renderer, model, controls;

export async function initViewer3D() {
  const container = document.querySelector('[data-viewer3d]');
  if (!container) return;

  const canvas = container.querySelector('.viewer3d-canvas');
  const fallback = container.querySelector('.viewer3d-fallback');
  const loading = container.querySelector('.viewer3d-loading');
  const button = container.querySelector('[data-load-viewer]');

  if (!canvas) {
    console.error('[viewer3d] Canvas no encontrado');
    return;
  }

  // Mostrar estado de carga
  if (loading) loading.style.display = 'flex';
  if (button) button.disabled = true;

  try {
    // Cargar three.js desde /vendor
    const THREE = await loadThreeJS();
    if (!THREE) throw new Error('three.js no disponible');

    // Verificar WebGL
    if (!isWebGLAvailable()) {
      throw new Error('WebGL no disponible en este navegador');
    }

    // Inicializar scene
    initScene(THREE, canvas);

    // Cargar modelo
    await loadModel(THREE);

    // Animar
    animate();

    if (loading) loading.style.display = 'none';
    if (fallback) fallback.style.display = 'none';
  } catch (error) {
    console.error('[viewer3d] Error:', error);

    // Mostrar fallback
    if (loading) loading.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (fallback) fallback.style.display = 'block';

    // Mostrar mensaje en consola
    const message = container.querySelector('.viewer3d-loading');
    if (message) {
      message.textContent = 'No se pudo cargar el visor 3D. Se muestra imagen estática.';
      message.style.display = 'flex';
    }
  }

  if (button) button.disabled = false;
}

function loadThreeJS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/three-0.169.0/three.min.js';
    script.async = true;
    script.onload = () => {
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error('three.js no se cargó correctamente'));
      }
    };
    script.onerror = () => reject(new Error('Error cargando three.js'));
    document.head.appendChild(script);
  });
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

function initScene(THREE, canvas) {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1512); // --c-noche-2

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Controles orbitales básicos (sin OrbitControls externo)
  setupBasicControls(canvas);

  // Responder a cambios de tamaño
  window.addEventListener('resize', () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
}

function setupBasicControls(canvas) {
  let isRotating = true;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let rotation = { x: 0, y: 0 };

  // Auto-rotación lenta
  const autoRotate = () => {
    if (isRotating && model && !isDragging) {
      model.rotation.y += 0.002;
    }
  };

  // Ratón
  canvas.addEventListener('mousedown', () => {
    isDragging = true;
    isRotating = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !model) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    rotation.y += deltaX * 0.005;
    rotation.x += deltaY * 0.005;

    model.rotation.y = rotation.y;
    model.rotation.x = rotation.x;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Zoom con rueda
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const direction = e.deltaY > 0 ? 1 : -1;
    camera.position.z = Math.max(2, Math.min(20, camera.position.z + direction * zoomSpeed));
  }, { passive: false });

  // Toque (móvil)
  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    isRotating = false;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || !model) return;

    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;

    rotation.y += deltaX * 0.005;
    rotation.x += deltaY * 0.005;

    model.rotation.y = rotation.y;
    model.rotation.x = rotation.x;

    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Doble clic para reencuadrar
  canvas.addEventListener('dblclick', () => {
    camera.position.set(0, 0, 5);
    rotation = { x: 0, y: 0 };
    if (model) {
      model.rotation.x = 0;
      model.rotation.y = 0;
    }
  });

  // Loop de auto-rotación
  const rotationLoop = setInterval(autoRotate, 16); // ~60 FPS

  // Retornar función para limpiar
  return () => clearInterval(rotationLoop);
}

async function loadModel(THREE) {
  // Importar GLTFLoader
  const GLTFLoader = await loadGLTFLoader(THREE);
  if (!GLTFLoader) throw new Error('GLTFLoader no disponible');

  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      './assets/model/objeto.glb',
      (gltf) => {
        model = gltf.scene;

        // Centrar y escalar el modelo
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        model.scale.multiplyScalar(scale);

        scene.add(model);
        resolve(model);
      },
      (progress) => {
        // Mostrar progreso
        const percent = Math.round((progress.loaded / progress.total) * 100);
        const loading = document.querySelector('.viewer3d-loading');
        if (loading) {
          loading.textContent = `Cargando modelo: ${percent}%`;
        }
      },
      (error) => {
        reject(new Error(`Error cargando .glb: ${error.message}`));
      }
    );
  });
}

function loadGLTFLoader(THREE) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/three-0.169.0/GLTFLoader.js';
    script.async = true;
    script.onload = () => {
      if (window.GLTFLoader) {
        resolve(window.GLTFLoader);
      } else {
        reject(new Error('GLTFLoader no se cargó'));
      }
    };
    script.onerror = () => reject(new Error('Error cargando GLTFLoader'));
    document.head.appendChild(script);
  });
}

function animate() {
  requestAnimationFrame(animate);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
