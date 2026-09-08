/* viewer3d-core.js — Motor del visor 3D
   Especificación: RF-13

   Este módulo es el que pesa. No lo carga nadie hasta que el usuario pulsa
   «Ver en 3D»: viewer3d.js lo trae con import() dinámico. Aquí dentro viven
   three.js, la escena, los controles y toda la interfaz del visor.

   Lo que el visor sabe de la puerta no está escrito aquí, sino en
   assets/model/puerta.json. Ese manifiesto dice qué fichero cargar, dónde
   están las bisagras, cuánto mide la pieza y qué puntos comentados tiene. Así
   se puede reajustar el modelo sin tocar el código, y el modo de calibración
   (?calibrar=1) escribe justamente ese fichero.
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = './assets/model/';
const RUTA_DRACO = './vendor/three-0.185.1/jsm/libs/draco/gltf/';

/* Valores por defecto. El manifiesto sobreescribe lo que necesite. */
const MANIFIESTO_POR_DEFECTO = {
  calidades: [{ id: 'estandar', fichero: 'puerta.glb', etiqueta: 'Estándar', auto: true }],
  metrosPorUnidad: null,      // null = el modelo no está escalado a metros
  alturaEncuadre: 2.0,        // altura a la que se normaliza la pieza en escena
  aperturaMaxima: 100,        // grados que gira cada hoja al abrirse del todo
  sentidoApertura: -1,        // -1 o 1: hacia qué lado del plano abren las hojas
  hojas: [],                  // [{ nodo, etiqueta, lado, bisagraX }]
  camara: { azimut: 0, elevacion: 6, distancia: 1.05 },   // multiplica al encuadre justo
  puntos: [],
};

const VISTAS = {
  frontal: { azimut: 0, elevacion: 0, etiqueta: 'Anterior' },
  posterior: { azimut: 180, elevacion: 0, etiqueta: 'Posterior' },
  canto: { azimut: 90, elevacion: 0, etiqueta: 'Canto' },
  cenital: { azimut: 0, elevacion: 72, etiqueta: 'Cenital' },
  tresCuartos: { azimut: 32, elevacion: 14, etiqueta: 'Tres cuartos' },
};

const MODOS = {
  textura: 'Policromía',
  volumen: 'Volumen',
  malla: 'Malla',
  normales: 'Relieve',
};

const reducirMovimiento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const enCalibracion = () =>
  new URLSearchParams(location.search).has('calibrar');

const facil = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ───────────────────────────── API pública ───────────────────────────── */

export async function createViewer(stage, opciones = {}) {
  const visor = new Viewer(stage, opciones);
  await visor.arrancar();
  return visor;
}

/* ─────────────────────────────── El visor ─────────────────────────────── */

class Viewer {
  constructor(stage, opciones) {
    this.stage = stage;                   // el elemento que contiene el lienzo
    this.opciones = opciones;
    this.manifiesto = { ...MANIFIESTO_POR_DEFECTO };
    this.hojas = [];                      // { pivote, objeto, etiqueta, lado }
    this.apertura = 0;                    // 0 cerrada, 1 abierta del todo
    this.aperturaObjetivo = 0;
    this.modo = 'textura';
    this.materialesOriginales = new Map();
    this.puntosMedida = [];
    this.midiendo = false;
    this.marcadores = [];
    this.necesitaCuadro = true;
    this.interaccionIniciada = false;
    this.punteroEncima = false;
    this.activado = false;
    this.tween = null;
    this.destruido = false;
  }

  /* ── Arranque ───────────────────────────────────────────────────────── */

  async arrancar() {
    this.construirInterfaz();
    this.avisar('Preparando el visor…');

    await this.leerManifiesto();
    this.construirEscena();
    this.cablearLienzo();          // necesita los controles ya creados
    if (enCalibracion()) this.construirCalibracion();

    this.construirSelectorCalidad();

    // Los niveles marcados como automáticos se encadenan: la vista previa
    // aparece en un segundo y el detalle la sustituye cuando llega. El nivel
    // máximo, que pesa decenas de MB, sólo se descarga si se pide.
    const automaticos = this.calidades.filter((c) => c.auto !== false);
    const cadena = this.conexionLenta() ? automaticos.slice(0, 1) : automaticos;

    for (let i = 0; i < cadena.length; i += 1) {
      const nivel = cadena[i];
      try {
        await this.cargarNivel(nivel, { provisional: i < cadena.length - 1 });
      } catch (error) {
        if (i === 0) throw error;               // sin nada que enseñar
        console.warn('[viewer3d] nivel no disponible:', error.message);
      }
    }

    this.ocultarProgreso();
    this.avisar('Modelo cargado. Arrastra para girar la puerta.');
    this.stage.focus({ preventScroll: true });
  }

  /* Los niveles disponibles, aceptando también el manifiesto antiguo de un
     solo fichero. */
  get calidades() {
    const declaradas = this.manifiesto.calidades;
    if (Array.isArray(declaradas) && declaradas.length) return declaradas;
    const sueltos = [];
    if (this.manifiesto.vistaPrevia) {
      sueltos.push({ id: 'previa', fichero: this.manifiesto.vistaPrevia, etiqueta: 'Vista previa', auto: true });
    }
    sueltos.push({ id: 'estandar', fichero: this.manifiesto.modelo, etiqueta: 'Estándar', auto: true });
    return sueltos;
  }

  /* En móvil o con ahorro de datos activado, la cadena automática se corta en
     la vista previa: los 17 MB del nivel estándar los pide el lector. */
  conexionLenta() {
    const conexion = navigator.connection;
    if (conexion?.saveData) return true;
    if (conexion && /^(slow-2g|2g|3g)$/.test(conexion.effectiveType || '')) return true;
    return window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 820;
  }

  async cargarNivel(nivel, { provisional = false } = {}) {
    const objeto = await this.cargarModelo(nivel.fichero, nivel.etiqueta.toLowerCase());
    if (this.destruido) return;
    this.montarModelo(objeto, { provisional });
    this.nivelActual = nivel.id;
    this.marcarNivelActivo();
  }

  /* ── Niveles de calidad ─────────────────────────────────────────────── */

  construirSelectorCalidad() {
    const niveles = this.calidades;
    if (niveles.length < 2 || !this.barra) return;

    const grupo = document.createElement('div');
    grupo.className = 'v3d-grupo v3d-grupo--calidad';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', 'Calidad del modelo');
    grupo.innerHTML = '<span class="v3d-etiqueta">Calidad</span>' + niveles.map((nivel) => {
      const detalle = nivel.triangulos
        ? `${nivel.triangulos.toLocaleString('es-ES')} triángulos, textura de ${nivel.textura} px`
        : '';
      const peso = nivel.mb ? `<small>${String(nivel.mb).replace('.', ',')} MB</small>` : '';
      return `<button type="button" class="v3d-btn v3d-btn--calidad" data-calidad="${nivel.id}"
                      aria-pressed="false" title="${detalle}">${nivel.etiqueta} ${peso}</button>`;
    }).join('');

    grupo.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-calidad]');
      if (!boton || this.cargando) return;
      const nivel = niveles.find((n) => n.id === boton.dataset.calidad);
      if (!nivel || nivel.id === this.nivelActual) return;
      this.cambiarCalidad(nivel);
    });

    this.barra.insertBefore(grupo, this.barra.querySelector('.v3d-grupo--iconos'));
    this.grupoCalidad = grupo;
    this.marcarNivelActivo();
  }

  async cambiarCalidad(nivel) {
    this.cargando = true;
    this.avisar(`Descargando el nivel «${nivel.etiqueta}» (${String(nivel.mb || '?').replace('.', ',')} MB)…`);
    try {
      await this.cargarNivel(nivel);
      this.avisar(`Nivel «${nivel.etiqueta}» cargado.`);
    } catch (error) {
      console.error('[viewer3d]', error);
      this.avisar('No se ha podido descargar ese nivel. Se mantiene el anterior.');
    } finally {
      this.cargando = false;
      this.ocultarProgreso();
    }
  }

  marcarNivelActivo() {
    this.grupoCalidad?.querySelectorAll('[data-calidad]').forEach((boton) => {
      boton.setAttribute('aria-pressed', String(boton.dataset.calidad === this.nivelActual));
    });
  }

  async leerManifiesto() {
    try {
      const respuesta = await fetch(BASE + 'puerta.json', { cache: 'no-cache' });
      if (respuesta.ok) {
        Object.assign(this.manifiesto, await respuesta.json());
      }
    } catch (error) {
      console.warn('[viewer3d] sin manifiesto, se usan los valores por defecto');
    }
  }

  /* ── Escena ─────────────────────────────────────────────────────────── */

  construirEscena() {
    const canvas = this.canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    // Más de 2 no se aprecia y sí se nota en el ventilador.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Sin mapeo tonal: cualquier curva de contraste altera los rojos y los
    // verdes del marmoleado, que es justo lo que hay que poder leer. La
    // textura ya viene revelada; el visor la reproduce, no la interpreta.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);

    // Iluminación neutra, de tres focos, sin mapa de entorno. Un entorno de
    // estudio (RoomEnvironment) tiñe de cálido y añade un moteado especular
    // sobre una textura que ya trae la luz horneada: aquí interesa que los
    // rojos y los verdes del marmoleado se vean como se fotografiaron.
    this.relleno = new THREE.HemisphereLight(0xffffff, 0x9a9186, 3.1);
    this.scene.add(this.relleno);

    this.clave = new THREE.DirectionalLight(0xffffff, 1.1);
    this.clave.position.set(0.5, 0.7, 1);      // acompaña a la cámara
    this.camera.add(this.clave);
    this.scene.add(this.camera);

    this.rasante = new THREE.DirectionalLight(0xfff1dc, 0);
    this.rasante.position.set(4, 0.6, 1.5);
    this.scene.add(this.rasante);
    this.azimutRasante = 60;
    this.raiz = new THREE.Group();
    this.scene.add(this.raiz);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.8;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.enableZoom = false;       // se habilita al activar el visor
    this.controls.autoRotate = !reducirMovimiento();
    this.controls.autoRotateSpeed = 0.6;
    this.controls.addEventListener('change', () => this.invalidar());
    this.controls.addEventListener('start', () => this.marcarInteraccion());

    this.medidaLinea = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xc8992e, depthTest: false })
    );
    this.medidaLinea.visible = false;
    this.medidaLinea.renderOrder = 10;
    this.scene.add(this.medidaLinea);

    this.raycaster = new THREE.Raycaster();
    this.observarTamano();
    this.observarVisibilidad();
    this.renderer.setAnimationLoop(() => this.cuadro());
  }

  /* ── Carga ──────────────────────────────────────────────────────────── */

  cargarModelo(fichero, etiqueta) {
    const url = fichero.startsWith('.') || fichero.startsWith('/') ? fichero : BASE + fichero;
    this.mostrarProgreso(`Descargando ${etiqueta}…`);

    const alProgresar = (evento) => {
      if (!evento.lengthComputable) return;
      const pct = Math.round((evento.loaded / evento.total) * 100);
      const mb = (evento.loaded / 1048576).toFixed(1);
      const total = (evento.total / 1048576).toFixed(1);
      this.mostrarProgreso(`Descargando ${etiqueta}: ${pct} % · ${mb} de ${total} MB`, pct);
    };

    if (/\.obj$/i.test(url)) return this.cargarOBJ(url, alProgresar);

    // Un solo descodificador Draco para las dos cargas: si se crea uno por
    // fichero, el .wasm se pide dos veces.
    this.draco ||= new DRACOLoader().setDecoderPath(RUTA_DRACO);
    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(this.draco);
    gltf.setMeshoptDecoder(MeshoptDecoder);

    return new Promise((resolve, reject) => {
      gltf.load(
        url,
        (resultado) => resolve(resultado.scene),
        alProgresar,
        () => reject(new Error(`No se pudo descargar ${url}`))
      );
    });
  }

  /* El .obj sin convertir sirve para probar en local; en producción pesa
     demasiado y lo que se publica es el .glb comprimido. */
  cargarOBJ(url, alProgresar) {
    const mtl = url.replace(/\.obj$/i, '.mtl');
    const cargarGeometria = (materiales) => new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      if (materiales) loader.setMaterials(materiales);
      loader.load(url, resolve, alProgresar, () => reject(new Error(`No se pudo descargar ${url}`)));
    });
    return new Promise((resolve, reject) => {
      new MTLLoader().load(
        mtl,
        (materiales) => { materiales.preload(); cargarGeometria(materiales).then(resolve, reject); },
        undefined,
        () => cargarGeometria(null).then(resolve, reject)   // .obj sin .mtl
      );
    });
  }

  /* ── Montaje del modelo ─────────────────────────────────────────────── */

  montarModelo(objeto, { provisional = false } = {}) {
    if (this.destruido) return;
    if (this.raiz.children.length) this.vaciarRaiz();

    // Normaliza tamaño y centro: el modelo llega en las unidades arbitrarias
    // de la fotogrametría y aquí pasa a medir `alturaEncuadre` de alto.
    const caja = new THREE.Box3().setFromObject(objeto);
    const tamano = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    this.escala = this.manifiesto.alturaEncuadre / (tamano.y || 1);
    this.unidadesModelo = tamano;
    this.anchoEscena = tamano.x * this.escala;

    this.hojas = this.repartirHojas(objeto, caja);

    this.raiz.add(objeto);
    this.raiz.scale.setScalar(this.escala);
    this.raiz.position.set(
      -centro.x * this.escala,
      -caja.min.y * this.escala,
      -centro.z * this.escala
    );

    this.recogerMateriales(objeto);
    this.aplicarModo(this.modo);
    this.aplicarApertura(this.apertura, { inmediato: true });

    if (!provisional) {
      this.construirPuntos();
      this.actualizarFichaTecnica(objeto);
    }
    if (!this.encuadrado) {
      this.encuadrar({ inmediato: true });
      this.encuadrado = true;
    }
    this.invalidar();
  }

  /* Separa las hojas en pivotes propios para poder abrirlas.

     Cada hoja cuelga de un grupo situado sobre su bisagra; girar ese grupo
     alrededor de Y es exactamente lo que hace una puerta. Si el manifiesto no
     dice dónde están las bisagras, se deducen de la caja envolvente: cada hoja
     gira sobre su canto exterior. */
  repartirHojas(objeto, cajaTotal) {
    const mallas = [];
    objeto.traverse((nodo) => { if (nodo.isMesh) mallas.push(nodo); });
    if (mallas.length < 2 && !this.manifiesto.hojas.length) return [];

    const declaradas = this.manifiesto.hojas.length
      ? this.manifiesto.hojas
      : mallas.map((malla, i) => ({
          nodo: malla.name,
          etiqueta: `Hoja ${i + 1}`,
          lado: null,
        }));

    const hojas = [];
    declaradas.forEach((declarada, indice) => {
      const nodo = objeto.getObjectByName(declarada.nodo) || mallas[indice];
      if (!nodo) return;

      const caja = new THREE.Box3().setFromObject(nodo);
      const centroX = caja.getCenter(new THREE.Vector3()).x;
      const lado = declarada.lado
        || (centroX <= cajaTotal.getCenter(new THREE.Vector3()).x ? 'izquierda' : 'derecha');
      const bisagraX = declarada.bisagraX !== undefined
        ? declarada.bisagraX
        : (lado === 'izquierda' ? caja.min.x : caja.max.x);
      const bisagraZ = declarada.bisagraZ !== undefined
        ? declarada.bisagraZ
        : caja.getCenter(new THREE.Vector3()).z;

      const pivote = new THREE.Group();
      pivote.name = `pivote-${declarada.nodo}`;
      pivote.position.set(bisagraX, 0, bisagraZ);
      const padre = nodo.parent;
      padre.add(pivote);
      pivote.add(nodo);
      nodo.position.sub(new THREE.Vector3(bisagraX, 0, bisagraZ));

      hojas.push({
        id: declarada.nodo,
        etiqueta: declarada.etiqueta || `Hoja ${indice + 1}`,
        lado,
        pivote,
        objeto: nodo,
        abierta: true,
      });
    });
    return hojas;
  }

  recogerMateriales(objeto) {
    this.materialesOriginales.clear();
    objeto.traverse((nodo) => {
      if (!nodo.isMesh) return;
      this.materialesOriginales.set(nodo, nodo.material);
      // La fotogrametría no trae mapas de rugosidad; sin esto la madera
      // aparece plastificada bajo el entorno.
      const material = nodo.material;
      if (material && material.isMeshStandardMaterial) {
        // La fotogrametría ya trae el brillo horneado en la textura. Dejar el
        // material completamente mate evita que el entorno añada un
        // moteado especular sobre una superficie que no lo tiene.
        material.roughness = 1.0;
        material.metalness = 0.0;
        material.envMapIntensity = 0.6;
        if (material.map) {
          material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          material.map.needsUpdate = true;
        }
      }
    });
  }

  vaciarRaiz() {
    for (const hijo of [...this.raiz.children]) {
      this.raiz.remove(hijo);
      hijo.traverse((nodo) => {
        if (nodo.isMesh) {
          nodo.geometry?.dispose();
          const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
          for (const material of materiales) {
            material?.map?.dispose();
            material?.dispose();
          }
        }
      });
    }
  }

  /* ── Estado del visor ───────────────────────────────────────────────── */

  aplicarApertura(valor, { inmediato = false } = {}) {
    this.aperturaObjetivo = THREE.MathUtils.clamp(valor, 0, 1);
    if (inmediato || reducirMovimiento()) this.apertura = this.aperturaObjetivo;
    this.invalidar();
  }

  /* Hacia dónde abre la puerta.

     Cada hoja gira sobre su canto exterior; lo único que decide el lado del
     giro es el sentido. Lo marcan los herrajes: las pletinas están clavadas en
     la cara anterior, así que el eje del gozne cae de ese lado y las hojas
     abren hacia el que las mira, no hacia dentro. `sentidoApertura` lo
     invierte desde el manifiesto, sin tocar el código. */
  colocarHojas() {
    const maximo = THREE.MathUtils.degToRad(this.manifiesto.aperturaMaxima);
    const sentido = this.manifiesto.sentidoApertura ?? 1;
    for (const hoja of this.hojas) {
      const signo = hoja.lado === 'izquierda' ? 1 : -1;
      const objetivo = hoja.abierta ? this.apertura : 0;
      hoja.pivote.rotation.y = sentido * signo * maximo * objetivo;
    }
  }

  aplicarModo(modo) {
    this.modo = modo;
    for (const [malla, original] of this.materialesOriginales) {
      if (modo === 'textura') {
        malla.material = original;
      } else if (modo === 'volumen') {
        malla.material = this.materialVolumen ||= new THREE.MeshStandardMaterial({
          color: 0xd9d2c6, roughness: 0.95, metalness: 0,
        });
      } else if (modo === 'malla') {
        malla.material = this.materialMalla ||= new THREE.MeshBasicMaterial({
          color: 0xc8992e, wireframe: true, transparent: true, opacity: 0.55,
        });
      } else if (modo === 'normales') {
        malla.material = this.materialNormales ||= new THREE.MeshNormalMaterial();
      }
    }
    // Los botones viven en la barra, no dentro del lienzo.
    this.barra?.querySelectorAll('[data-modo]').forEach((boton) => {
      boton.setAttribute('aria-pressed', String(boton.dataset.modo === modo));
    });
    this.invalidar();
  }

  aplicarRasante(activa, azimut = this.azimutRasante) {
    this.azimutRasante = azimut;
    const radianes = THREE.MathUtils.degToRad(azimut);
    // Elevación baja a propósito: es lo que hace legible la talla.
    this.rasante.position.set(
      Math.sin(radianes) * 6,
      0.9,
      Math.cos(radianes) * 6
    );
    // Con la rasante encendida el resto baja casi a cero: la sombra propia es
    // lo que dibuja el relieve, y cualquier relleno la borra.
    this.rasante.intensity = activa ? 3.6 : 0;
    this.relleno.intensity = activa ? 0.25 : 3.1;
    this.clave.intensity = activa ? 0.1 : 1.1;
    this.invalidar();
  }

  encuadrar({ inmediato = false, vista = null } = {}) {
    const objetivo = new THREE.Vector3(0, this.manifiesto.alturaEncuadre / 2, 0);
    const destino = vista || this.manifiesto.camara;
    const azimut = THREE.MathUtils.degToRad(destino.azimut ?? 0);
    const elevacion = THREE.MathUtils.degToRad(destino.elevacion ?? 0);
    // Distancia mínima a la que la pieza entra entera, por alto y por ancho,
    // con el margen que pida el manifiesto. Depende de la proporción del
    // lienzo, así que se recalcula en cada reencuadre.
    const mitadFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const porAlto = (this.manifiesto.alturaEncuadre / 2) / Math.tan(mitadFov);
    const porAncho = ((this.anchoEscena || 1) / 2)
      / (Math.tan(mitadFov) * Math.max(this.camera.aspect, 0.4));
    const justo = Math.max(porAlto, porAncho) * 1.12;
    const distancia = justo * (destino.distancia ?? this.manifiesto.camara.distancia ?? 1);

    const posicion = new THREE.Vector3(
      Math.sin(azimut) * Math.cos(elevacion),
      Math.sin(elevacion),
      Math.cos(azimut) * Math.cos(elevacion)
    ).multiplyScalar(distancia).add(objetivo);

    this.controls.minDistance = justo * 0.18;
    this.controls.maxDistance = justo * 3.5;

    if (inmediato || reducirMovimiento()) {
      this.camera.position.copy(posicion);
      this.controls.target.copy(objetivo);
      this.controls.update();
      this.invalidar();
      return;
    }
    this.tween = {
      desde: this.camera.position.clone(),
      hasta: posicion,
      objetivoDesde: this.controls.target.clone(),
      objetivoHasta: objetivo,
      inicio: performance.now(),
      duracion: 700,
    };
    this.invalidar();
  }

  /* ── Bucle ──────────────────────────────────────────────────────────── */

  invalidar() { this.necesitaCuadro = true; }

  cuadro() {
    if (this.destruido || this.oculto) return;

    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.inicio) / this.tween.duracion);
      const k = facil(t);
      this.camera.position.lerpVectors(this.tween.desde, this.tween.hasta, k);
      this.controls.target.lerpVectors(this.tween.objetivoDesde, this.tween.objetivoHasta, k);
      if (t >= 1) this.tween = null;
      this.necesitaCuadro = true;
    }

    if (Math.abs(this.apertura - this.aperturaObjetivo) > 0.001) {
      this.apertura += (this.aperturaObjetivo - this.apertura) * 0.12;
      this.necesitaCuadro = true;
    } else if (this.apertura !== this.aperturaObjetivo) {
      this.apertura = this.aperturaObjetivo;
      this.necesitaCuadro = true;
    }
    this.colocarHojas();

    if (this.controls.autoRotate || this.controls.enableDamping) {
      if (this.controls.update()) this.necesitaCuadro = true;
    }

    if (!this.necesitaCuadro) return;
    this.necesitaCuadro = false;
    this.renderer.render(this.scene, this.camera);
    this.colocarMarcadores();
    this.actualizarMedida();
  }

  observarTamano() {
    const ajustar = () => {
      const ancho = this.stage.clientWidth || 1;
      const alto = this.stage.clientHeight || 1;
      this.renderer.setSize(ancho, alto, false);
      this.camera.aspect = ancho / alto;
      this.camera.updateProjectionMatrix();
      this.invalidar();
    };
    this.observadorTamano = new ResizeObserver(ajustar);
    this.observadorTamano.observe(this.stage);
    ajustar();
  }

  /* Sin esto el visor sigue dibujando 60 veces por segundo cuando el usuario
     ya está tres secciones más abajo. */
  observarVisibilidad() {
    this.observadorVisible = new IntersectionObserver((entradas) => {
      this.oculto = !entradas[0].isIntersecting;
      if (!this.oculto) this.invalidar();
    }, { threshold: 0.01 });
    this.observadorVisible.observe(this.stage);

    this.alCambiarPestana = () => {
      this.oculto = document.hidden;
      if (!this.oculto) this.invalidar();
    };
    document.addEventListener('visibilitychange', this.alCambiarPestana);
  }

  marcarInteraccion() {
    if (this.interaccionIniciada) return;
    this.interaccionIniciada = true;
    this.controls.autoRotate = false;
    const boton = this.barra?.querySelector('[data-accion="girar"]');
    if (boton) boton.setAttribute('aria-pressed', 'false');
  }

  /* ── Medición ───────────────────────────────────────────────────────── */

  alternarMedida(activa) {
    this.midiendo = activa;
    this.puntosMedida = [];
    this.medidaLinea.visible = false;
    this.etiquetaMedida.hidden = true;
    this.stage.classList.toggle('is-midiendo', activa);
    this.avisar(activa
      ? 'Medición activada: pulsa dos puntos de la superficie.'
      : 'Medición desactivada.');
    this.invalidar();
  }

  puntoBajoPuntero(evento) {
    const rect = this.canvas.getBoundingClientRect();
    const puntero = new THREE.Vector2(
      ((evento.clientX - rect.left) / rect.width) * 2 - 1,
      -((evento.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(puntero, this.camera);
    const impactos = this.raycaster.intersectObject(this.raiz, true);
    return impactos.length ? impactos[0].point.clone() : null;
  }

  registrarMedida(evento) {
    const punto = this.puntoBajoPuntero(evento);
    if (!punto) return;
    // El tercer punto empieza una medida nueva: hay que retirar la anterior,
    // o se queda una linea y una cifra en pantalla que ya no miden nada.
    if (this.puntosMedida.length >= 2) this.puntosMedida = [];
    this.puntosMedida.push(punto);

    const completa = this.puntosMedida.length === 2;
    if (completa) this.medidaLinea.geometry.setFromPoints(this.puntosMedida);
    this.medidaLinea.visible = completa;
    this.etiquetaMedida.hidden = !completa;
    this.invalidar();
  }

  actualizarMedida() {
    if (this.puntosMedida.length !== 2) return;
    const [a, b] = this.puntosMedida;
    const medio = a.clone().add(b).multiplyScalar(0.5).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    this.etiquetaMedida.hidden = false;
    this.etiquetaMedida.style.left = `${(medio.x * 0.5 + 0.5) * rect.width}px`;
    this.etiquetaMedida.style.top = `${(-medio.y * 0.5 + 0.5) * rect.height}px`;

    // La distancia se mide en la escena, que está normalizada; se devuelve a
    // las unidades del modelo y de ahí a metros, si el manifiesto los conoce.
    const enEscena = a.distanceTo(b);
    const enModelo = enEscena / this.escala;
    const factor = this.manifiesto.metrosPorUnidad;
    this.etiquetaMedida.textContent = factor
      ? `${(enModelo * factor * 100).toFixed(1)} cm`
      : `${enModelo.toFixed(2)} u · sin escala calibrada`;
  }

  /* ── Puntos comentados ──────────────────────────────────────────────── */

  construirPuntos() {
    this.capaMarcadores.innerHTML = '';
    this.marcadores = [];
    (this.manifiesto.puntos || []).forEach((punto, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'v3d-marcador';
      boton.textContent = String(indice + 1);
      boton.setAttribute('aria-label', punto.titulo);
      boton.addEventListener('click', () => this.mostrarPunto(punto));
      this.capaMarcadores.appendChild(boton);
      this.marcadores.push({
        boton,
        posicion: new THREE.Vector3().fromArray(punto.posicion || [0, 0, 0]),
        datos: punto,
      });
    });
    this.capaMarcadores.hidden = this.marcadores.length === 0;
  }

  colocarMarcadores() {
    if (!this.marcadores.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const camaraPos = this.camera.position;
    for (const marcador of this.marcadores) {
      const mundo = marcador.posicion.clone().applyMatrix4(this.raiz.matrixWorld);
      const proyectado = mundo.clone().project(this.camera);
      const visible = proyectado.z < 1
        && Math.abs(proyectado.x) < 1.05 && Math.abs(proyectado.y) < 1.05;
      marcador.boton.hidden = !visible;
      if (!visible) continue;
      marcador.boton.style.left = `${(proyectado.x * 0.5 + 0.5) * rect.width}px`;
      marcador.boton.style.top = `${(-proyectado.y * 0.5 + 0.5) * rect.height}px`;
      // Atenúa los que quedan al otro lado de la pieza.
      const direccion = mundo.clone().sub(camaraPos).normalize();
      this.raycaster.set(camaraPos, direccion);
      const impacto = this.raycaster.intersectObject(this.raiz, true)[0];
      const tapado = impacto && impacto.distance < camaraPos.distanceTo(mundo) - 0.02;
      marcador.boton.classList.toggle('is-detras', Boolean(tapado));
    }
  }

  mostrarPunto(punto) {
    this.fichaPunto.hidden = false;
    this.fichaPunto.querySelector('.v3d-ficha-titulo').textContent = punto.titulo;
    this.fichaPunto.querySelector('.v3d-ficha-texto').textContent = punto.texto || '';
    const enlace = this.fichaPunto.querySelector('.v3d-ficha-enlace');
    if (punto.seccion) {
      enlace.hidden = false;
      enlace.href = punto.seccion;
      enlace.textContent = punto.enlaceTexto || 'Leer en el estudio';
    } else {
      enlace.hidden = true;
    }
    if (punto.vista) this.encuadrar({ vista: punto.vista });
  }

  /* ── Interfaz ───────────────────────────────────────────────────────── */

  construirInterfaz() {
    this.stage.classList.add('v3d-stage');
    this.stage.tabIndex = 0;
    this.stage.setAttribute('role', 'application');
    this.stage.setAttribute('aria-label',
      'Visor tridimensional de la puerta. Arrastra para girar, usa las flechas del teclado, O para abrir y cerrar.');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'v3d-canvas';
    this.stage.appendChild(this.canvas);

    this.capaMarcadores = document.createElement('div');
    this.capaMarcadores.className = 'v3d-marcadores';
    this.capaMarcadores.hidden = true;
    this.stage.appendChild(this.capaMarcadores);

    this.etiquetaMedida = document.createElement('div');
    this.etiquetaMedida.className = 'v3d-medida';
    this.etiquetaMedida.hidden = true;
    this.stage.appendChild(this.etiquetaMedida);

    this.progreso = document.createElement('div');
    this.progreso.className = 'v3d-progreso';
    this.progreso.innerHTML =
      '<p class="v3d-progreso-texto"></p><div class="v3d-progreso-barra"><span></span></div>';
    this.stage.appendChild(this.progreso);

    this.fichaPunto = document.createElement('div');
    this.fichaPunto.className = 'v3d-ficha';
    this.fichaPunto.hidden = true;
    this.fichaPunto.innerHTML =
      '<button type="button" class="v3d-ficha-cerrar" aria-label="Cerrar la nota">×</button>'
      + '<h4 class="v3d-ficha-titulo"></h4><p class="v3d-ficha-texto"></p>'
      + '<a class="v3d-ficha-enlace" href="#"></a>';
    this.fichaPunto.querySelector('.v3d-ficha-cerrar')
      .addEventListener('click', () => { this.fichaPunto.hidden = true; });
    this.stage.appendChild(this.fichaPunto);

    this.panel = this.opciones.panel || this.stage.parentElement;
    this.construirBarra();
  }

  construirBarra() {
    const barra = document.createElement('div');
    barra.className = 'v3d-barra';
    barra.innerHTML = `
      <div class="v3d-grupo" role="group" aria-label="Apertura de las hojas">
        <button type="button" class="v3d-btn v3d-btn--principal" data-accion="abrir" aria-pressed="false">
          Abrir la puerta
        </button>
        <label class="v3d-slider">
          <span>Apertura</span>
          <input type="range" min="0" max="100" value="0" step="1" data-accion="apertura"
                 aria-label="Grado de apertura de las hojas">
          <output data-salida="apertura">0 %</output>
        </label>
        <div class="v3d-hojas" role="group" aria-label="Hojas"></div>
      </div>

      <div class="v3d-grupo" role="group" aria-label="Modo de visualización">
        <span class="v3d-etiqueta">Ver</span>
        ${Object.entries(MODOS).map(([clave, texto]) => `
          <button type="button" class="v3d-btn" data-modo="${clave}"
                  aria-pressed="${clave === 'textura'}">${texto}</button>`).join('')}
      </div>

      <div class="v3d-grupo" role="group" aria-label="Vistas">
        <span class="v3d-etiqueta">Vista</span>
        ${Object.entries(VISTAS).map(([clave, vista]) => `
          <button type="button" class="v3d-btn" data-vista="${clave}">${vista.etiqueta}</button>`).join('')}
      </div>

      <div class="v3d-grupo" role="group" aria-label="Luz">
        <button type="button" class="v3d-btn" data-accion="rasante" aria-pressed="false">Luz rasante</button>
        <label class="v3d-slider" data-para="rasante" hidden>
          <span>Dirección</span>
          <input type="range" min="0" max="360" value="60" step="5" data-accion="azimut"
                 aria-label="Dirección de la luz rasante en grados">
          <output data-salida="azimut">60°</output>
        </label>
        <label class="v3d-slider">
          <span>Luz</span>
          <input type="range" min="40" max="180" value="100" step="5" data-accion="exposicion"
                 aria-label="Intensidad de la luz">
          <output data-salida="exposicion">100 %</output>
        </label>
      </div>

      <div class="v3d-grupo v3d-grupo--iconos" role="group" aria-label="Herramientas">
        <button type="button" class="v3d-btn" data-accion="girar" aria-pressed="${!reducirMovimiento()}">Giro automático</button>
        <button type="button" class="v3d-btn" data-accion="medir" aria-pressed="false">Medir</button>
        <button type="button" class="v3d-btn" data-accion="reencuadrar">Reencuadrar</button>
        <button type="button" class="v3d-btn" data-accion="captura">Captura</button>
        <button type="button" class="v3d-btn" data-accion="pantalla">Pantalla completa</button>
        <button type="button" class="v3d-btn v3d-btn--salir" data-accion="salir">Salir del visor</button>
      </div>

      <p class="v3d-aviso" role="status" aria-live="polite"></p>
      <p class="v3d-ficha-tecnica"></p>
    `;
    this.panel.appendChild(barra);
    this.barra = barra;
    this.avisoTexto = barra.querySelector('.v3d-aviso');
    this.fichaTecnica = barra.querySelector('.v3d-ficha-tecnica');
    this.cablearBarra(barra);
  }

  cablearBarra(barra) {
    const salida = (nombre, texto) => {
      const elemento = barra.querySelector(`[data-salida="${nombre}"]`);
      if (elemento) elemento.textContent = texto;
    };

    barra.addEventListener('click', (evento) => {
      const boton = evento.target.closest('button');
      if (!boton) return;

      if (boton.dataset.modo) return this.aplicarModo(boton.dataset.modo);
      if (boton.dataset.vista) {
        this.marcarInteraccion();
        return this.encuadrar({ vista: VISTAS[boton.dataset.vista] });
      }

      switch (boton.dataset.accion) {
        case 'abrir': {
          const abrir = this.aperturaObjetivo < 0.5;
          this.aplicarApertura(abrir ? 1 : 0);
          boton.setAttribute('aria-pressed', String(abrir));
          boton.textContent = abrir ? 'Cerrar la puerta' : 'Abrir la puerta';
          barra.querySelector('[data-accion="apertura"]').value = abrir ? 100 : 0;
          salida('apertura', abrir ? '100 %' : '0 %');
          this.avisar(abrir ? 'Puerta abierta.' : 'Puerta cerrada.');
          break;
        }
        case 'rasante': {
          const activa = boton.getAttribute('aria-pressed') !== 'true';
          boton.setAttribute('aria-pressed', String(activa));
          barra.querySelector('[data-para="rasante"]').hidden = !activa;
          this.aplicarRasante(activa);
          this.avisar(activa
            ? 'Luz rasante activada: la talla y las pérdidas de materia se leen mejor.'
            : 'Iluminación general restablecida.');
          break;
        }
        case 'girar': {
          const activo = boton.getAttribute('aria-pressed') !== 'true';
          boton.setAttribute('aria-pressed', String(activo));
          this.controls.autoRotate = activo;
          this.interaccionIniciada = true;
          this.invalidar();
          break;
        }
        case 'medir': {
          const activa = boton.getAttribute('aria-pressed') !== 'true';
          boton.setAttribute('aria-pressed', String(activa));
          this.alternarMedida(activa);
          break;
        }
        case 'reencuadrar':
          this.encuadrar();
          this.avisar('Encuadre inicial restablecido.');
          break;
        case 'captura':
          this.guardarCaptura();
          break;
        case 'pantalla':
          this.alternarPantallaCompleta();
          break;
        case 'salir':
          this.salir();
          break;
        default:
          break;
      }
    });

    barra.addEventListener('input', (evento) => {
      const control = evento.target;
      const valor = Number(control.value);
      switch (control.dataset.accion) {
        case 'apertura':
          this.aplicarApertura(valor / 100);
          salida('apertura', `${valor} %`);
          break;
        case 'azimut':
          this.aplicarRasante(this.rasante.intensity > 0, valor);
          salida('azimut', `${valor}°`);
          break;
        case 'exposicion':
          this.renderer.toneMappingExposure = valor / 100;
          salida('exposicion', `${valor} %`);
          this.invalidar();
          break;
        default:
          break;
      }
    });
  }

  /* Botones por hoja: se generan cuando ya se sabe cuántas hay. */
  actualizarFichaTecnica(objeto) {
    const contenedor = this.barra.querySelector('.v3d-hojas');
    contenedor.innerHTML = '';
    if (this.hojas.length > 1) {
      for (const hoja of this.hojas) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'v3d-btn v3d-btn--pequeno';
        boton.textContent = hoja.etiqueta;
        boton.setAttribute('aria-pressed', 'true');
        boton.title = `Incluir o excluir ${hoja.etiqueta} del movimiento de apertura`;
        boton.addEventListener('click', () => {
          hoja.abierta = !hoja.abierta;
          boton.setAttribute('aria-pressed', String(hoja.abierta));
          this.invalidar();
        });
        contenedor.appendChild(boton);
      }
    }

    let triangulos = 0;
    objeto.traverse((nodo) => {
      if (nodo.isMesh && nodo.geometry?.index) triangulos += nodo.geometry.index.count / 3;
      else if (nodo.isMesh) triangulos += nodo.geometry.attributes.position.count / 3;
    });
    const factor = this.manifiesto.metrosPorUnidad;
    const alto = factor ? ` · ${(this.unidadesModelo.y * factor * 100).toFixed(0)} cm de alto` : '';
    this.fichaTecnica.textContent =
      `Malla fotogramétrica de ${Math.round(triangulos).toLocaleString('es-ES')} triángulos${alto}. `
      + 'Captura con Canon EOS 2000D y procesado en RealityScan.';
  }

  cablearLienzo() {
    // CA-13.4: la rueda sólo hace zoom con el puntero encima y el visor activo.
    this.stage.addEventListener('pointerenter', () => {
      this.punteroEncima = true;
      this.controls.enableZoom = this.activado;
    });
    this.stage.addEventListener('pointerleave', () => {
      this.punteroEncima = false;
      this.controls.enableZoom = false;
    });
    const activar = () => {
      if (this.activado) return;
      this.activado = true;
      this.controls.enableZoom = this.punteroEncima;
      this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      this.stage.classList.add('is-activo');
      this.avisar('Visor activo. La rueda hace zoom; Escape devuelve el foco a la página.');
    };
    this.stage.addEventListener('pointerdown', activar);
    this.stage.addEventListener('focus', activar);
    this.stage.addEventListener('blur', () => { this.controls.enableZoom = false; });

    // En táctil, un dedo debe seguir desplazando la página hasta que el
    // usuario decida entrar en el visor.
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };

    this.stage.addEventListener('click', (evento) => {
      if (this.midiendo) return this.registrarMedida(evento);
      // En calibración, pinchar sobre la pieza devuelve las coordenadas del
      // punto en el sistema del modelo: es la forma de rellenar "puntos" en
      // assets/model/puerta.json sin tener que abrir Blender.
      if (!enCalibracion()) return;
      const punto = this.puntoBajoPuntero(evento);
      if (!punto) return;
      const local = this.raiz.worldToLocal(punto.clone()).toArray().map((v) => Number(v.toFixed(3)));
      console.log('[viewer3d] posición para el manifiesto:', JSON.stringify(local));
      navigator.clipboard?.writeText(JSON.stringify(local));
      this.avisar(`Posición copiada: ${JSON.stringify(local)}`);
    });

    this.stage.addEventListener('keydown', (evento) => this.teclado(evento));
  }

  teclado(evento) {
    const paso = THREE.MathUtils.degToRad(5);
    const acciones = {
      ArrowLeft: () => this.girarCamara(-paso, 0),
      ArrowRight: () => this.girarCamara(paso, 0),
      ArrowUp: () => this.girarCamara(0, paso),
      ArrowDown: () => this.girarCamara(0, -paso),
      '+': () => this.acercar(0.9),
      '=': () => this.acercar(0.9),
      '-': () => this.acercar(1.1),
      o: () => this.aplicarApertura(this.aperturaObjetivo < 0.5 ? 1 : 0),
      O: () => this.aplicarApertura(this.aperturaObjetivo < 0.5 ? 1 : 0),
      r: () => this.encuadrar(),
      R: () => this.encuadrar(),
      f: () => this.alternarPantallaCompleta(),
      F: () => this.alternarPantallaCompleta(),
      Escape: () => this.salir(),
    };
    const accion = acciones[evento.key];
    if (!accion) return;
    evento.preventDefault();
    this.marcarInteraccion();
    accion();
  }

  girarCamara(dAzimut, dElevacion) {
    const desplazamiento = this.camera.position.clone().sub(this.controls.target);
    const esferica = new THREE.Spherical().setFromVector3(desplazamiento);
    esferica.theta += dAzimut;
    esferica.phi = THREE.MathUtils.clamp(esferica.phi - dElevacion, 0.05, Math.PI - 0.05);
    this.camera.position.copy(this.controls.target).add(
      new THREE.Vector3().setFromSpherical(esferica)
    );
    this.controls.update();
    this.invalidar();
  }

  acercar(factor) {
    const desplazamiento = this.camera.position.clone().sub(this.controls.target);
    const distancia = THREE.MathUtils.clamp(
      desplazamiento.length() * factor, this.controls.minDistance, this.controls.maxDistance
    );
    this.camera.position.copy(this.controls.target).add(desplazamiento.setLength(distancia));
    this.controls.update();
    this.invalidar();
  }

  guardarCaptura() {
    this.renderer.render(this.scene, this.camera);
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `puerta-3d-${Date.now()}.png`;
      enlace.click();
      URL.revokeObjectURL(url);
      this.avisar('Captura guardada.');
    }, 'image/png');
  }

  alternarPantallaCompleta() {
    const contenedor = this.stage.closest('[data-viewer3d]') || this.stage;
    if (document.fullscreenElement) document.exitFullscreen();
    else contenedor.requestFullscreen?.().catch(() => {
      this.avisar('Este navegador no permite la pantalla completa.');
    });
  }

  avisar(texto) {
    if (this.avisoTexto) this.avisoTexto.textContent = texto;
  }

  mostrarProgreso(texto, porcentaje = null) {
    this.progreso.hidden = false;
    this.progreso.querySelector('.v3d-progreso-texto').textContent = texto;
    const barra = this.progreso.querySelector('.v3d-progreso-barra span');
    barra.style.width = porcentaje === null ? '35%' : `${porcentaje}%`;
    this.progreso.classList.toggle('is-indeterminado', porcentaje === null);
  }

  ocultarProgreso() { this.progreso.hidden = true; }

  /* ── Calibración ────────────────────────────────────────────────────── */

  /* Con ?calibrar=1 aparecen los mandos que colocan las bisagras y fijan la
     escala. El botón «Copiar JSON» devuelve el bloque listo para pegar en
     assets/model/puerta.json; no se guarda nada solo. */
  construirCalibracion() {
    const panel = document.createElement('details');
    panel.className = 'v3d-calibracion';
    panel.open = true;
    panel.innerHTML = `
      <summary>Calibración (sólo con ?calibrar=1)</summary>
      <div class="v3d-calibracion-campos"></div>
      <label class="v3d-slider">
        <span>Apertura máxima</span>
        <input type="range" min="45" max="170" step="1" value="${this.manifiesto.aperturaMaxima}" data-cal="aperturaMaxima">
        <output>${this.manifiesto.aperturaMaxima}°</output>
      </label>
      <label class="v3d-slider">
        <span>Altura real (cm)</span>
        <input type="number" min="10" max="500" step="0.5" value="" data-cal="alturaCm" placeholder="p. ej. 196">
      </label>
      <button type="button" class="v3d-btn" data-cal="copiar">Copiar JSON</button>
      <pre class="v3d-calibracion-salida"></pre>
    `;
    this.barra.appendChild(panel);

    const campos = panel.querySelector('.v3d-calibracion-campos');
    const pintarCampos = () => {
      campos.innerHTML = this.hojas.map((hoja, i) => `
        <label class="v3d-slider">
          <span>${hoja.etiqueta}: bisagra X</span>
          <input type="range" min="-1" max="1" step="0.005" value="0" data-cal="bisagra" data-hoja="${i}">
          <output>0</output>
        </label>`).join('');
    };
    setTimeout(pintarCampos, 500);

    panel.addEventListener('input', (evento) => {
      const control = evento.target;
      const salida = control.parentElement.querySelector('output');
      if (control.dataset.cal === 'bisagra') {
        const hoja = this.hojas[Number(control.dataset.hoja)];
        const ancho = this.unidadesModelo.x / 2;
        hoja.pivote.position.x = hoja.pivote.userData.x0 ??= hoja.pivote.position.x;
        hoja.pivote.position.x += Number(control.value) * ancho * 0.02;
        hoja.objeto.position.x -= Number(control.value) * ancho * 0.02;
        if (salida) salida.textContent = control.value;
        this.invalidar();
      } else if (control.dataset.cal === 'aperturaMaxima') {
        this.manifiesto.aperturaMaxima = Number(control.value);
        if (salida) salida.textContent = `${control.value}°`;
        this.invalidar();
      } else if (control.dataset.cal === 'alturaCm') {
        const cm = Number(control.value);
        this.manifiesto.metrosPorUnidad = cm > 0 ? (cm / 100) / this.unidadesModelo.y : null;
      }
    });

    panel.querySelector('[data-cal="copiar"]').addEventListener('click', () => {
      const json = JSON.stringify({
        modelo: this.manifiesto.modelo,
        vistaPrevia: this.manifiesto.vistaPrevia,
        metrosPorUnidad: this.manifiesto.metrosPorUnidad,
        alturaEncuadre: this.manifiesto.alturaEncuadre,
        aperturaMaxima: this.manifiesto.aperturaMaxima,
        hojas: this.hojas.map((hoja) => ({
          nodo: hoja.id,
          etiqueta: hoja.etiqueta,
          lado: hoja.lado,
          bisagraX: Number(hoja.pivote.position.x.toFixed(4)),
        })),
        camara: this.manifiesto.camara,
        puntos: this.manifiesto.puntos,
      }, null, 2);
      panel.querySelector('.v3d-calibracion-salida').textContent = json;
      navigator.clipboard?.writeText(json);
    });
  }

  /* ── Cierre ─────────────────────────────────────────────────────────── */

  salir() {
    if (document.fullscreenElement) document.exitFullscreen();
    this.opciones.onClose?.();
  }

  destruir() {
    this.destruido = true;
    this.renderer?.setAnimationLoop(null);
    this.observadorTamano?.disconnect();
    this.observadorVisible?.disconnect();
    document.removeEventListener('visibilitychange', this.alCambiarPestana);
    this.controls?.dispose();
    this.draco?.dispose();
    this.vaciarRaiz();
    this.renderer?.dispose();
    this.barra?.remove();
    this.stage.innerHTML = '';
    this.stage.removeAttribute('role');
    this.stage.classList.remove('v3d-stage', 'is-activo');
  }
}
