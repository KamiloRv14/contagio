// main.js (actualizado con correcciones)

import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/controls/OrbitControls.js';
import { Usuario } from '../models/Usuario.js';
import { obtenerColorUsuario, colorConexion } from '../models/InteresesVisual.js';
///*
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/BokehPass.js';
//*/
const noise = new Noise(Math.random());

const N = 200;
const radioEsfera = 50;

const umbralSimilitud = 0.65;
const minConexionesPorUsuario = 1;
const maxConexionesPorUsuario = 3;
const podaAleatoria = 0.15;

const lineasConexiones = new Map();
let lastDebugTime = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let seleccionado = null;

// Panel info en HTML
const infoPanel = document.createElement('div');
infoPanel.style.position = 'absolute';
infoPanel.style.top = '10px';
infoPanel.style.right = '10px';
infoPanel.style.padding = '10px';
infoPanel.style.background = 'rgba(0,0,0,0.7)';
infoPanel.style.color = 'white';
infoPanel.style.display = 'none';
document.body.appendChild(infoPanel);

function puntoAleatorioEsfera(radio) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radio * Math.sin(phi) * Math.cos(theta);
  const y = radio * Math.sin(phi) * Math.sin(theta);
  const z = radio * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const interesesPosibles = ['deporte', 'musica', 'cine', 'tecnologia', 'arte', 'lectura', 'viajes'];
let usuarios = new Map();
for (let i = 0; i < N; i++) {
  let user = new Usuario(i.toString());
  let nIntereses = Math.floor(Math.random() * 2) + 2;
  while (user.intereses.size < nIntereses) {
    let interes = interesesPosibles[Math.floor(Math.random() * interesesPosibles.length)];
    user.agregarInteres(interes);
  }
  usuarios.set(user.id, user);
  console.log(`Usuario creado: ID=${user.id}, Tipo=${user.tipo}, Intereses=${[...user.intereses].join(', ')}`);
}

// Crear conexiones entre usuarios (no cambió)
usuarios.forEach((usuario) => {
  let candidatos = [];
  usuarios.forEach((otroUsuario) => {
    if (usuario.id !== otroUsuario.id) {
      let peso = usuario.calcularSimilitud(otroUsuario);
      if (peso > umbralSimilitud) {
        candidatos.push({ id: otroUsuario.id, peso });
      }
    }
  });
  
  candidatos.sort((a,b) => b.peso - a.peso);
  let conexionesFinales = candidatos.slice(0, maxConexionesPorUsuario);

  if (conexionesFinales.length < minConexionesPorUsuario) {
    let candidatosExtra = [];
    usuarios.forEach((otroUsuario) => {
      if (usuario.id !== otroUsuario.id && !conexionesFinales.some(c => c.id === otroUsuario.id)) {
        let peso = usuario.calcularSimilitud(otroUsuario);
        candidatosExtra.push({ id: otroUsuario.id, peso });
      }
    });
    candidatosExtra.sort((a,b) => b.peso - a.peso);
    conexionesFinales = conexionesFinales.concat(candidatosExtra.slice(0, minConexionesPorUsuario - conexionesFinales.length));
  }

  conexionesFinales.forEach(c => {
    usuario.agregarConexion(c.id, c.peso);
  });
});

// Inicializar activaciones dispersas y válidas
usuarios.forEach(usuario => {
  usuario.activacion = Math.random() * 0.8 + 0.1;
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

///*
//POSTPROCESAMIENTO
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

//POSTPROCESAMIENTO - BOKEH
const bokehPass = new BokehPass(scene, camera, {
  focus: 0.2,           // distancia focal al plano enfocado
  aperture: 0.0025,      // cantidad de desenfoque (apertura del lente)
  maxblur: 0.18,        // máximo nivel de blur general
  width: window.innerWidth,
  height: window.innerHeight
});
composer.addPass(bokehPass);
//*/

const controls = new OrbitControls(camera, renderer.domElement);

const geometry = new THREE.SphereGeometry(1.5, 8, 8);
const nodos3D = new Map();
const posiciones = new Map();

// Agrega luz ambiental para que materiales con emissive luzcan bien
const ambientLight = new THREE.AmbientLight(0xffffff, 2); // luz blanca suave, intensidad 0.5
scene.add(ambientLight);
scene.background = new THREE.Color(0x000000);

// Crear nodos con colores iniciales por interés
usuarios.forEach((usuario) => {
  let pos = puntoAleatorioEsfera(radioEsfera);
  posiciones.set(usuario.id, pos);

  const colorNodo = obtenerColorUsuario(usuario);
  const materialUsuario = new THREE.MeshStandardMaterial({ color: colorNodo, emissive: 0x000000 });
  let mesh = new THREE.Mesh(geometry, materialUsuario);
  mesh.position.copy(pos);

  // Guardar color base en userData
  mesh.userData.colorBase = new THREE.Color(colorNodo);

  scene.add(mesh);
  nodos3D.set(usuario.id, mesh);
});

// Crear líneas (aristas)
usuarios.forEach((usuario) => {
  usuario.conexiones.forEach((peso, idConectado) => {
    const colorBase = colorConexion(usuario, usuarios.get(idConectado));
    const materialLinea = new THREE.LineBasicMaterial({ color: colorBase });
    const puntos = [posiciones.get(usuario.id), posiciones.get(idConectado)];
    const geoLinea = new THREE.BufferGeometry().setFromPoints(puntos);
    const linea = new THREE.Line(geoLinea, materialLinea);
    scene.add(linea);
    lineasConexiones.set(`${usuario.id}-${idConectado}`, { linea, colorBase });
  });
});

/* VIAJE TIPO 1
// Define dos posiciones en el espacio para los extremos de la cámara
const camStart = new THREE.Vector3(0, 0, radioEsfera * 2);
const camEnd = new THREE.Vector3(0, 0, 0);

let camMoveProgress = 0;   // progreso normalizado entre 0 y 1
const camMoveSpeed = 0.0003; // velocidad de viaje (ajustar)
*/

// /*VIAJE TIPO 2
// Parámetros para el movimiento
const radioMin = radioEsfera * 1.2;
const radioMax = radioEsfera * 1.8;
const anguloPolarMin = Math.PI / 6;   // 30 grados (altura mínima)
const anguloPolarMax = Math.PI / 3;   // 60 grados (altura máxima)
let tiempoInicio = performance.now();

camera.position.z = radioEsfera * 2;
// */

function animate(time) {
  requestAnimationFrame(animate);
  
  actualizarCamaraOscilante(time);
  
  usuarios.forEach(u => u.actualizarActivacion(usuarios));
  usuarios.forEach(u => u.aplicarNuevaActivacion());

  actualizarPesosGlobal(usuarios);

  actualizarColoresLineas();
  actualizarVisualNodos();
  
  if (time - lastDebugTime > 10000) {
    debugEstado();
    lastDebugTime = time;
  }

  controls.update();
  //scene.rotation.y += 0.0001;
  composer.render(scene, camera);
}

animate();

function actualizarColoresLineas() {
  lineasConexiones.forEach(({ linea, colorBase }, key) => {
    const [idOrigen, idDestino] = key.split('-');
    const usuarioOrigen = usuarios.get(idOrigen);
    const usuarioDestino = usuarios.get(idDestino);

    const activacionPromedio = (usuarioOrigen.activacion + usuarioDestino.activacion) / 2 || 0;

    const color = new THREE.Color(colorBase);
    const hsl = {};
    color.getHSL(hsl);
    hsl.s = THREE.MathUtils.clamp(activacionPromedio, 0, 1);
    hsl.l = 0.5;
    color.setHSL(hsl.h, hsl.s, hsl.l);

    linea.material.color.set(color);
    linea.material.needsUpdate = true;
  });
}

function actualizarVisualNodos() {
  usuarios.forEach(usuario => {
    const mesh = nodos3D.get(usuario.id);
    if (mesh) {
      const baseColor = new THREE.Color(obtenerColorUsuario(usuario));
      const hsl = {};
      baseColor.getHSL(hsl);
      hsl.s = THREE.MathUtils.clamp(usuario.activacion * 0.8 + 0.2, 0, 1);
      hsl.l = 0.5;
      baseColor.setHSL(hsl.h, hsl.s, hsl.l);
      mesh.material.color.set(baseColor);
      mesh.material.needsUpdate = true;

      //const scale = THREE.MathUtils.lerp(0.5, 4, usuario.activacion);
      //mesh.scale.set(scale, scale, scale);
    }
  });
}

function actualizarPesosGlobal(usuariosMap) {
  usuariosMap.forEach(usuario => {
    usuario.actualizarPesosConexiones(usuariosMap);
  });
}

function debugEstado() {
  console.log(
    [...usuarios.values()].slice(0, 5).map(u => ({
      id: u.id,
      act: u.activacion.toFixed(2),
      conexiones: [...u.conexiones.values()].map(v => v.toFixed(2))
    }))
  );
}

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 -1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 +1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = [...nodos3D.values()];
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    seleccionado = [...nodos3D.entries()].find(([id, m]) => m === mesh)[0];
    mostrarInformacion(seleccionado);
    resaltarNodo(seleccionado);
  } else {
    seleccionado = null;
    ocultarInformacion();
    limpiarResaltados();
  }
});

function mostrarInformacion(id) {
  const usuario = usuarios.get(id);
  if (!usuario) return;

  infoPanel.style.display = 'block';
  infoPanel.innerHTML = `
    <h3>Usuario ${usuario.id}</h3>
    <p>Tipo: ${usuario.tipo}</p>
    <p>Activación: ${usuario.activacion.toFixed(2)}</p>
    <p>Intereses: ${[...usuario.intereses].join(', ')}</p>
    <p>Conexiones: ${usuario.conexiones.size}</p>
  `;
}

function ocultarInformacion() {
  infoPanel.style.display = 'none';
}

function resaltarNodo(id) {
  limpiarResaltados(); // restaurar visual a todos los nodos primero
  
  const mesh = nodos3D.get(id);
  if (!mesh) return;

  // Nodo seleccionado: emissive amarillo, escala más grande
  mesh.material.emissive = new THREE.Color(0xffff00);
  mesh.scale.set(3, 3, 3);

  // Resaltar nodos conectados
  usuarios.get(id).conexiones.forEach((peso, idConectado) => {
    const meshConectado = nodos3D.get(idConectado);
    if (meshConectado) {
      meshConectado.material.emissive = new THREE.Color(0x00ffff);
      meshConectado.scale.set(2, 2, 2);
    }
  });
}

function limpiarResaltados() {
  nodos3D.forEach((mesh) => {
    mesh.material.emissive.set(0x000000);
    mesh.material.color.copy(mesh.userData.colorBase);
    mesh.scale.set(1, 1, 1);
  });
}

// Función para actualizar posición de cámara en el animate loop
function actualizarCamaraOscilante(time) {
  const t = (time - tiempoInicio) * 0.000001; // velocidad temporal ajustable
  
  // Oscilación del radio entre radioMin y radioMax con función seno
  const radio = radioMin + (radioMax - radioMin) * (0.5 + 0.5 * Math.sin(t));
  
  // Oscilación del ángulo polar para subir y bajar ligeramente
  const anguloPolar = anguloPolarMin + (anguloPolarMax - anguloPolarMin) * (0.5 + 0.5 * Math.sin(t * 0.2));
  
  // Ángulo azimutal que aumenta linealmente para orbitación continua
  const anguloAzimutal = t * 2 * Math.PI; // una vuelta cada unidad de t
  
  // Convertir coordenadas esféricas a cartesianas
  const x = radio * Math.sin(anguloPolar) * Math.cos(anguloAzimutal);
  const y = radio * Math.cos(anguloPolar);
  const z = radio * Math.sin(anguloPolar) * Math.sin(anguloAzimutal);
  
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0); // Siempre mira al centro del grafo
}