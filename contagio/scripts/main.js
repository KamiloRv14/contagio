import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/BokehPass.js';

import GUI from 'lil-gui';

const N = 100;
const noise = new Noise(Math.random());

const params = {
	minCuradores: N * 0.05,
	maxCuradores: N * 0.15,
	maxCuradoresLimit: N * 0.5,
	propagationInterval: 2000,
	propagationProbability: 0.2,
	cureProbability: 1,
	curadorConversionProbability: 0.2,
	curadorCooldown: 5,
	infectedRepulsion: 0.5,
	attractionForce: 2,
	maxForceIncrement: 0.05,
	frictionBase: 0.55,
	frictionHigh: 0.45,
	maxGraphRadius: 10,
	maxCenteringForce: 0.05
};

const gui = new GUI();

gui.add(params, 'minCuradores', 1, N * 0.5).step(N * 0.05).name('Min Curadores');
gui.add(params, 'maxCuradores', N * 0.1, N * 0.9).step(N * 0.05).name('Max Curadores').listen();
gui.add(params, 'maxCuradoresLimit', 1, N * 0.9).step(N * 0.05).name('Max Curadores Limit');
gui.add(params, 'propagationInterval', 100, 2000).step(100).name('Intervalo Propagación');
gui.add(params, 'propagationProbability', 0.01, 1).step(0.01).name('Probabilidad Contagio');
gui.add(params, 'cureProbability', 0.01, 1).step(0.01).name('Probabilidad Cura');
gui.add(params, 'curadorConversionProbability', 0, 1).step(0.01).name('Probabilidad Conversión');
gui.add(params, 'curadorCooldown', 0, 10).step(0.1).name('Curador cool down');
gui.add(params, 'maxForceIncrement', 0.01, 0.1).step(0.01).name('Incremento Máx. Fuerza');
gui.add(params, 'infectedRepulsion', 0.01, 2).step(0.01).name('Fuerza de repulsión');
gui.add(params, 'attractionForce', 0.01, 2).step(0.01).name('Fuerza de atracción');
gui.add(params, 'frictionBase', 0.1, 1).step(0.05).name('Fricción Base');
gui.add(params, 'frictionHigh', 0.1, 1).step(0.05).name('Fricción Alta');
gui.add(params, 'maxGraphRadius', 1, 100).step(1).name('Radio del grafo');
gui.add(params, 'maxCenteringForce', 0.01, 2).step(0.05).name('Fuerza Centrípeta');

const nodes = [];
const edges = [];

let lastPropagationTime = 0;
let lastLinkUpdateTime = 0;

let curadores = [];

const curadoresChangeInterval = 5000;  // tiempo en ms para cambiar valor
let lastChangeTime = 0;

const infectionInterval = 10000; // ms, cada 10 segundos. Muy seguido hace que se infecte
let lastInfectionTime = 0;

// Parámetros para el movimiento suave de la cámara
let time = 0;
const radiusMin = 5;
const radiusMax = 30;
const rotationSpeed = 0.1; 		// rotación en radianes por segundo
const zoomSpeed = 0.1;       	// velocidad de oscilación zoom

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({
	precision: 'mediump' 
});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// --- HOVER: raycaster y tooltip
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;

// Crear tooltip DIV
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.pointerEvents = 'none';
tooltip.style.padding = '6px 8px';
tooltip.style.background = 'rgba(0,0,0,0.7)';
tooltip.style.color = '#fff';
tooltip.style.fontFamily = 'monospace';
tooltip.style.fontSize = '12px';
tooltip.style.borderRadius = '4px';
tooltip.style.transition = 'opacity 0.15s ease';
tooltip.style.opacity = '0';
document.body.appendChild(tooltip);

// Evento mousemove para actualizar posición del mouse y tooltip
window.addEventListener('mousemove', (event) => {
	const rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

	tooltip.style.left = (event.clientX + 12) + 'px';
	tooltip.style.top = (event.clientY + 12) + 'px';
});

//POSTPROCESAMIENTO
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

//POSTPROCESAMIENTO - BOKEH
const bokehPass = new BokehPass(scene, camera, {
  focus: 0.5,           // distancia focal al plano enfocado
  aperture: 0.025,      // cantidad de desenfoque (apertura del lente)
  maxblur: 0.18,        // máximo nivel de blur general
  width: window.innerWidth,
  height: window.innerHeight
});
composer.addPass(bokehPass);

// Controles para rotar la cámara
const controls = new OrbitControls(camera, renderer.domElement);

// Crear nodos con posición inicial aleatoria 3D simple
for (let i = 1; i <= N; i++) {
	nodes.push({
		id: i,
		position: new THREE.Vector3(
			(Math.random() - 0.5) * 20,
			(Math.random() - 0.5) * 20,
			(Math.random() - 0.5) * 20
		),
		infected: false,
		velocity: new THREE.Vector3()
	});
}

// Crear conexiones aleatorias
for (let i = 0; i < N; i++) {
	const numConexiones = Math.floor(Math.random() * N *.01) + 2;
	for (let j = 0; j < numConexiones; j++) {
		const targetIndex = Math.floor(Math.random() * N);
		if (
			targetIndex !== i &&
			!edges.some(e => (e.source === nodes[i].id && e.target === nodes[targetIndex].id) ||
						  (e.source === nodes[targetIndex].id && e.target === nodes[i].id))
		) {
			edges.push({ source: nodes[i].id, target: nodes[targetIndex].id });
		}
	}
}

// Crear geometría para nodos (esferas)
const sphereGeometry = new THREE.SphereGeometry(0.3, 8, 8);

// Crear nodos
nodes.forEach(node => {
	const colorStr = getRandomNodeColor();
	const color = new THREE.Color(colorStr);
	node.baseColor = color.clone();

	// --- MODIFICACIÓN: usar material físico para permitir brillo / transmisión y más propiedades visuales
	const material = new THREE.MeshPhysicalMaterial({
	    color: color,
	    roughness: 0.35,
	    metalness: 0,
	    transmission: 0.0,    // dejamos 0 para no romper visibilidad; si quieres translúcido sube a 0.6
	    thickness: 0.8,
	    clearcoat: 0.6,
	    clearcoatRoughness: 0.15,
	    // Añadimos una propiedad extra para highlight (usaremos color/emissive)
	    emissive: new THREE.Color(0x000000),
	    emissiveIntensity: 0
	});

	node.mesh = new THREE.Mesh(sphereGeometry, material);
	node.mesh.position.copy(node.position);

	// Guardar escala objetivo y escala base para suavizar transformaciones
	node.targetScale = 1;
	node.currentScale = 1;

	scene.add(node.mesh);
});
  
// Crear líneas para conexiones
edges.forEach(edge => {
	const material = new THREE.LineBasicMaterial({ color: getEdgeColor(), transparent: true, opacity: 0.7 });
	const points = [new THREE.Vector3(), new THREE.Vector3()];
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const line = new THREE.Line(geometry, material);
	edge.line = line;
	scene.add(line);
});

camera.position.z = 10;

//Inicializar infectados y curadores
infectNode(nodes[0]);
curadores.push(nodes[N-1]);

// Crear geometría de partículas
const particleCount = 200;
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 30; // x
  positions[i * 3 + 1] = (Math.random() - 0.5) * 30; // y
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30; // z
}

// ---------------------------------------------------------------------------------
//PARTÍCULAS PARA EL FONDO
const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// Textura circular difusa para las partículas
const loader = new THREE.TextureLoader();
let particleTexture;
try {
  particleTexture = loader.load('public/bacteria.png'); // si existe
} catch(e){
  particleTexture = null;
}

// Material para partículas con transparencia y blending
const particlesMaterial = new THREE.PointsMaterial({
  size: 0.3,
  map: particleTexture,
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xffffff
});

// Crear sistema de partículas y añadir a la escena
const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particleSystem);

// Para el movimiento suave, guarda posiciones base y aplica oscilación
const basePositions = positions.slice();

// ---------------------------------------------------------------------------------
// FUNCIÓN DE ANIMACIÓN
function animate(timestamp) {
	
	// timestamp proviene de requestAnimationFrame
	const elapsedTime = timestamp * 0.0001; // convertir milisegundos a segundos (mantuve tu factor original)
	
	requestAnimationFrame(animate);

	// Aplicar fuerzas para actualizar posiciones lógicas
	applyForces();

	// Actualizar o decrementar cooldowns en cada curador
	curadores.forEach(node => {
		if (node.curadorActiveCycles > 0) node.curadorActiveCycles--;
	});

	// Filtrar curadores para mantener solo los activos
	curadores = curadores.filter(node => node.curadorActiveCycles > 0);
	
	// Mantener mínimo número de curadores siempre
	maintainMinCuradores();

	//Propagar y curar desinformación
	if (timestamp - lastPropagationTime > params.propagationInterval) {
		propagateDisinformation(); // la infección primero dispone de oportunidad para expandirse
		propagateCure();           // luego la cura intenta contenerla
		lastPropagationTime = timestamp;
	}
	
	if (timestamp - lastInfectionTime > infectionInterval) {
		infectRandomNode();
		lastInfectionTime = timestamp;
	}
	
	updateMaxCuradores(timestamp);
	
	updateEdgeColors();
	
	applyOrganicMovement();
	
	animateParticles(timestamp);

	// Actualizar posiciones de nodos (meshes)
	nodes.forEach(node => {
		node.mesh.position.copy(node.position);
	});
	
	nodes.forEach((node, index) => {
		// Oscilación senoidal base con fase diferente para cada nodo para no sincronizarlos todos igual
		const frequency = 10; // latidos por segundo
		const amplitude = 0.2; // variación máxima de escala (15%)
		const baseScale = 1;   // escala base sin variación
		
		// La fase puede variar para distribuir el latido en la red uniformemente
		const phase = (index / nodes.length) * Math.PI * 2;
		
		let scale = 1;
		if(node.infected == true){
			scale = baseScale + amplitude * Math.sin(2 * Math.PI * frequency * elapsedTime + phase);
		} else {
			scale = baseScale + amplitude * Math.sin(2 * Math.PI * frequency/4.0 * elapsedTime + phase);
		}
		
		// --- HOVER: aplicar targetScale suavizado hacia node.targetScale
		// node.targetScale puede ser modificado por la lógica de hover
		// la escala final combina latido natural + target (hover)
		const finalTarget = scale * node.targetScale;
		node.currentScale = THREE.MathUtils.lerp(node.currentScale, finalTarget, 0.15);
		node.mesh.scale.set(node.currentScale, node.currentScale, node.currentScale);

		// Actualizar posición si trabajas con fuerzas u otras dinámicas
		node.mesh.position.copy(node.position);
	});
	
	if (timestamp - lastLinkUpdateTime > 3000) { // cada 3 segundos por ejemplo
		updateLinks();
		lastLinkUpdateTime = timestamp;
	}

	// Actualizar geometría de líneas según posiciones nodos conectados
	edges.forEach(edge => {
		const sourceNode = nodes.find(n => n.id === edge.source);
		const targetNode = nodes.find(n => n.id === edge.target);
		const positions = edge.line.geometry.attributes.position.array;

		// Actualiza las posiciones de los vértices de la línea
		positions[0] = sourceNode.position.x;
		positions[1] = sourceNode.position.y;
		positions[2] = sourceNode.position.z;

		positions[3] = targetNode.position.x;
		positions[4] = targetNode.position.y;
		positions[5] = targetNode.position.z;

		edge.line.geometry.attributes.position.needsUpdate = true;
	});

	// --- HOVER: raycast para detectar nodo bajo el cursor
	raycaster.setFromCamera(mouse, camera);
	// construir lista de meshes para optimizar: todos los meshes de nodos
	const nodeMeshes = nodes.map(n => n.mesh);
	const intersects = raycaster.intersectObjects(nodeMeshes, false);

	if (intersects.length > 0) {
		const first = intersects[0].object;
		const node = nodes.find(n => n.mesh === first);
		if (node && node !== hoveredNode) {
			// quitar highlight anterior si existe
			if (hoveredNode) {
				// restaurar targetScale y emissive suavemente
				hoveredNode.targetScale = 1;
				hoveredNode.mesh.material.emissiveIntensity = 0;
			}
			hoveredNode = node;
			// nuevo hover: agrandar un poco y activar emissive
			node.targetScale = 1.6;
			// si el material tiene emissive, ajustarlo
			if ('emissive' in node.mesh.material) {
				node.mesh.material.emissive = new THREE.Color(0xffbbbb);
				node.mesh.material.emissiveIntensity = 0.7;
			}
			// mostrar tooltip
			tooltip.style.opacity = '1';
			tooltip.innerText = `Nodo ${node.id}\nEstado: ${node.infected ? 'infectado' : 'sano'}`;
		} else {
			// mantener hover (ya está en hoveredNode)
			// actualizar tooltip por si cambió el estado
			if (hoveredNode) tooltip.innerText = `Nodo ${hoveredNode.id}\nEstado: ${hoveredNode.infected ? 'infectado' : 'sano'}`;
		}
	} else {
		// no hay intersecciones
		if (hoveredNode) {
			hoveredNode.targetScale = 1;
			// desactivar emissive
			if ('emissive' in hoveredNode.mesh.material) {
				hoveredNode.mesh.material.emissive = new THREE.Color(0x000000);
				hoveredNode.mesh.material.emissiveIntensity = 0;
			}
			hoveredNode = null;
		}
		tooltip.style.opacity = '0';
	}

	//CONTROL DE CÁMARA
	// Oscilación seno para zoom (distancia cámara - target)
	const radius = radiusMin + (radiusMax - radiusMin) * (0.5 + 0.5 * Math.sin(elapsedTime * zoomSpeed));

	// Ángulo actual para rotación horizontal
	const angle = elapsedTime * rotationSpeed;

	// Calcular posición circular (X, Z), manteniendo Y fijo para altura cómoda
	const cameraY = 10; // altura cámara constante (puedes ajustar)

	const x = radius * Math.cos(angle);
	const z = radius * Math.sin(angle);

	// Actualizar posición de la cámara (objeto controlado por OrbitControls)
	controls.object.position.set(x, cameraY, z);

	// El objeto controlado es la cámara, llamar lookAt en ella
	camera.lookAt(controls.target);

	controls.update();
	
	composer.render(scene, camera);
}
animate();

// Ajuste al redimensionar la ventana
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
 
function applyForces() {
  const baseRepulsion = 0.01;
  const infectedRepulsion = params.infectedRepulsion;
  const attractionForce = params.attractionForce;
  const maxForce = 2;
  const maxForceIncrement = params.maxForceIncrement;   // límite de incremento por paso para suavidad
  const minDistance = 5;
  const frictionBase = params.frictionBase;
  const frictionHigh = params.frictionHigh; 			// mayor fricción si la velocidad es alta
  const maxRadius = params.maxGraphRadius || 50;        // radio máximo permitido para el grafo
  const maxCenteringForce = params.maxCenteringForce || 0.05; // fuerza centrípeta máxima

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let nodeA = nodes[i];
      let nodeB = nodes[j];
      let dir = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
      let dist = dir.length();
      if (dist > 0) {
        let repulsionA = nodeA.infected ? infectedRepulsion : baseRepulsion;
        let repulsionB = nodeB.infected ? infectedRepulsion : baseRepulsion;
        let repulsion = (repulsionA + repulsionB) / 2;

        let forceMag = 0;
        if (dist < minDistance) {
          forceMag = repulsion * (minDistance - dist);
        } else {
          forceMag = repulsion / (dist * dist);
        }
        forceMag = Math.min(forceMag, maxForce);

        dir.normalize();

        // Limitar incremento de velocidad para suavidad
        let incrementA = dir.clone().multiplyScalar(forceMag);
        if (incrementA.length() > maxForceIncrement) {
          incrementA.setLength(maxForceIncrement);
        }
        let incrementB = dir.clone().multiplyScalar(-forceMag);
        if (incrementB.length() > maxForceIncrement) {
          incrementB.setLength(maxForceIncrement);
        }

        nodeA.velocity.add(incrementA);
        nodeB.velocity.add(incrementB);
      }
    }
  }

  edges.forEach(edge => {
    let sourceNode = nodes.find(n => n.id === edge.source);
    let targetNode = nodes.find(n => n.id === edge.target);
    let dir = new THREE.Vector3().subVectors(targetNode.position, sourceNode.position);
    let dist = dir.length();
    let forceMag = attractionForce * (dist * dist);
    forceMag = Math.min(forceMag, maxForce);
    dir.normalize();

    let incrementS = dir.clone().multiplyScalar(forceMag);
    if (incrementS.length() > maxForceIncrement) incrementS.setLength(maxForceIncrement);
    let incrementT = dir.clone().multiplyScalar(-forceMag);
    if (incrementT.length() > maxForceIncrement) incrementT.setLength(maxForceIncrement);

    sourceNode.velocity.add(incrementS);
    targetNode.velocity.add(incrementT);
  });

  nodes.forEach(node => {
    // Fuerza centrípeta para mantener el nodo dentro de la esfera de radio maxRadius
    const toCenter = node.position.clone().negate(); // vector hacia el origen
    const distToCenter = node.position.length();

    if (distToCenter > maxRadius) {
      let excess = distToCenter - maxRadius;
      let centeringForceMag = Math.min(excess * 0.1, maxCenteringForce); // fuerza proporcional al exceso
      toCenter.normalize().multiplyScalar(centeringForceMag);
      node.velocity.add(toCenter);
    }

    // Amortiguar la velocidad con fricción adaptativa
    const vLength = node.velocity.length();
    if (vLength > 0.1) {
      node.velocity.multiplyScalar(frictionHigh);
    } else {
      node.velocity.multiplyScalar(frictionBase);
    }

    // Actualizar posición suavemente con lerp
    const newPos = node.position.clone().add(node.velocity);
    node.position.lerp(newPos, 0.5);
  });
}

//Propagar desinformación
function propagateDisinformation() {
  let newInfections = [];

  nodes.forEach(node => {
    if (node.infected) {
      edges.forEach(edge => {
        let neighborId = null;
        if (edge.source === node.id) neighborId = edge.target;
        else if (edge.target === node.id) neighborId = edge.source;

        if (neighborId !== null) {
          let neighbor = nodes.find(n => n.id === neighborId);

          // Evitar infectar curadores
          if (!neighbor.infected && !curadores.includes(neighbor) && Math.random() < params.propagationProbability) {
            newInfections.push(neighbor);
          }
        }
      });
    }
  });

  newInfections.forEach(node => {
    node.infected = true;
    // --- MEJORA VISUAL: usar color más evidente y reducir transmisión si existe
    if (node.mesh && node.mesh.material) {
      node.mesh.material.color.set(0xaa8888);
      if ('transmission' in node.mesh.material) node.mesh.material.transmission = 0.0;
    }
  });
}

// Propagar cura: los nuevos curadores tienen cooldown antes de ser activos
function propagateCure() {
  let newCures = [];
  let newCuradores = [];

  curadores.forEach(curador => {
    edges.forEach(edge => {
      if (edge.source === curador.id || edge.target === curador.id) {
        let neighborId = (edge.source === curador.id) ? edge.target : edge.source;
        let neighbor = nodes.find(n => n.id === neighborId);
        if (neighbor.infected && Math.random() < params.cureProbability) {
          // Solo cura una vez por ciclo
          if (!newCures.includes(neighbor)) {
            newCures.push(neighbor);

            // Nueva conversión a curador con cooldown
            if (Math.random() < (params.curadorConversionProbability || 0.1)) {
              neighbor.curadorActiveCycles = params.curadorCooldown || 5; // Ejemplo: 5 ciclos antes de ser curador activo
              if (!curadores.includes(neighbor)) newCuradores.push(neighbor);
            }
          }
        }
      }
    });
  });

  newCures.forEach(node => {
    node.infected = false;
    // --- MEJORA VISUAL: restaurar propiedades si existen
    if (node.mesh && node.mesh.material) {
      node.mesh.material.color.copy(node.baseColor);
      if ('transmission' in node.mesh.material) node.mesh.material.transmission = 0.0;
    }
  });

  // Limitar crecimiento de curadores, pero solo entran los activos
  if (curadores.length < params.maxCuradores) {
    const spaceLeft = params.maxCuradores - curadores.length;
    curadores = curadores.concat(newCuradores.slice(0, spaceLeft));
  }
}

	// En animación, decrementa cooldown de curadores y filtra los activos
	curadores.forEach(node => {
		if (node.curadorActiveCycles > 0) node.curadorActiveCycles--;
});

function maintainMinCuradores() {
	// Si hay menos curadores activos que el mínimo
	while (curadores.length < params.minCuradores) {
		// Buscar candidato limpio que no esté infectado ni curador
		const candidates = nodes.filter(n => !n.infected && !curadores.includes(n));
		if (candidates.length === 0) break; // no hay candidatos

		const candidate = candidates[Math.floor(Math.random() * candidates.length)];
		candidate.curadorActiveCycles = params.curadorCooldown || 5;
		curadores.push(candidate);

		// Marcar su color de curador si quieres
		candidate.mesh.material.color.set(0x0077ff); // azul para curador (ejemplo)
	}
}


//Infectar un nodo
function infectNode(node) {
	if (node.mesh && node.mesh.material) {
		node.mesh.material.color.set(0x664444); // rojo para infectado
		// si el material soporta transmission, disminuirla para verse opaco
		if ('transmission' in node.mesh.material) node.mesh.material.transmission = 0.0;
		node.infected = true;
	}
}

//Infectar cada cierto tiempo un nodo aleatorio
function infectRandomNode() {
  // Filtrar nodos que no estén infectados ni curadores
  const candidates = nodes.filter(node => !node.infected && !curadores.includes(node));
  if (candidates.length === 0) return; // todos están infectados o son curadores

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const node = candidates[randomIndex];

  node.infected = true;
  if (node.mesh && node.mesh.material) {
    node.mesh.material.color.set(0x886666); // rojo para infectado
    if ('transmission' in node.mesh.material) node.mesh.material.transmission = 0.0;
  }
}

function updateLinks() {
  const removalProbability = 0.1;
  const creationProbability = 0.05;
  const maxDistanceNewLink = 5;

  // Define máximo total de aristas según N, por ejemplo tiene sentido 3*N (promedio 3 conexiones por nodo)
  const maxTotalEdges = Math.floor(N * 3);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const hasEdge = new Set(edges.map(e => `${Math.min(e.source, e.target)}_${Math.max(e.source, e.target)}`));

  const edgesToRemove = [];

  // Romper vínculos
  for (let i = edges.length -1; i >= 0; i--) {
    const edge = edges[i];
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if ((sourceNode.infected !== targetNode.infected) && Math.random() < removalProbability) {
      edgesToRemove.push(i);
    }
  }

  // Eliminar marcados
  for (let k = edgesToRemove.length - 1; k >= 0; k--) {
    const idx = edgesToRemove[k];
    const edge = edges[idx];
    scene.remove(edge.line);
    hasEdge.delete(`${Math.min(edge.source, edge.target)}_${Math.max(edge.source, edge.target)}`);
    edges.splice(idx, 1);
  }

  // Limitar cantidad máxima de nuevas conexiones creadas en esta actualización
  const maxNewEdgesPerCycle = 50; 
  let newEdgesCreated = 0;

  // Crear vínculos nuevos
  for (let i = 0; i < nodes.length && newEdgesCreated < maxNewEdgesPerCycle && edges.length < maxTotalEdges; i++) {
    const nodeA = nodes[i];
    if (nodeA.infected) continue;

    for (let j = i + 1; j < nodes.length && newEdgesCreated < maxNewEdgesPerCycle && edges.length < maxTotalEdges; j++) {
      const nodeB = nodes[j];
      if (nodeB.infected) continue;

      const key = `${Math.min(nodeA.id, nodeB.id)}_${Math.max(nodeA.id, nodeB.id)}`;
      if (hasEdge.has(key)) continue;

      const dist = nodeA.position.distanceTo(nodeB.position);

      if (dist < maxDistanceNewLink && Math.random() < creationProbability) {
        const material = new THREE.LineBasicMaterial({ color: getEdgeColor(), transparent: true, opacity: 0.7 });
        const points = [nodeA.position.clone(), nodeB.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        scene.add(line);

        edges.push({ source: nodeA.id, target: nodeB.id, line });
        hasEdge.add(key);

        newEdgesCreated++;
      }
    }
  }
}

//Colores agradables para nodos
function getRandomNodeColor() {
	// Usar un tono aleatorio pero saturación 60-80% y luminosidad 50-70%
	const hue = 180 + Math.random() * 30; // 0 a 30 grados en la rueda de color
	const saturation = 30 + Math.random() * 20;
	const lightness = 70 + Math.random() * 20;
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

//Colores agradables para aristas
function getEdgeColor() {
	const baseHue = 210; // azul grisáceo
	const saturation = 10 + Math.random() * 20;
	const lightness = 60 + Math.random() * 15;
	return new THREE.Color(`hsl(${baseHue}, ${saturation}%, ${lightness}%)`);
}

//Actualizar colores de aristas
function updateEdgeColors() {
  edges.forEach(edge => {
    let sourceNode = nodes.find(n => n.id === edge.source);
    let targetNode = nodes.find(n => n.id === edge.target);

    // Clonar colores de los nodos
    const colorSource = sourceNode.mesh.material.color.clone();
    const colorTarget = targetNode.mesh.material.color.clone();

    // Mezclar colores 50%-50%
    const mixedColor = colorSource.lerp(colorTarget, 0.5);

    // Actualizar color del material de la línea
    edge.line.material.color.copy(mixedColor);
  });
}

//Los nodos curadores cambian con el tiempo
function updateMaxCuradores(time) {
  if (time - lastChangeTime > curadoresChangeInterval) {
    // Generar el siguiente valor cercano al anterior
    const maxStep = 10; // salto máximo permitido (positivo o negativo)

    // Propuesta de nuevo valor con salto controlado
    let nextMax = params.maxCuradores + (Math.floor(Math.random() * (2 * maxStep + 1)) - maxStep);

    // Restringir dentro del rango permitido
    if (nextMax < params.minCuradores) nextMax = params.minCuradores;
    if (nextMax > params.maxCuradoresLimit) nextMax = params.maxCuradoresLimit;

    params.maxCuradores = nextMax;
	

    console.log('Nuevo maxCuradores:', params.maxCuradores);
    lastChangeTime = time;
  }
}

//Movimiento orgánico
function applyOrganicMovement() {
  nodes.forEach((node, i) => {
    let time = performance.now() * 0.001;
    let nx = noise.perlin3(node.position.x * 0.1, node.position.y * 0.1, time);
    let ny = noise.perlin3(node.position.y * 0.1, node.position.z * 0.1, time);
    let nz = noise.perlin3(node.position.z * 0.1, node.position.x * 0.1, time);

    let organicForce = new THREE.Vector3(nx, ny, nz).multiplyScalar(0.3);

    node.velocity.add(organicForce);
  });
}

//PROPIEDADES DEL FONDO
function createRadialGradientTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(size/2, size/5, size/20, size/2, size/2, size/2);
  gradient.addColorStop(1, '#000000');     // borde negro
  gradient.addColorStop(0, '#222222');     // zona central (color oscuro)

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

scene.background = createRadialGradientTexture();

function animateParticles(time) {
  const elapsed = time * 0.001;
  const positions = particleSystem.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(elapsed + i) * 0.1; // ligera oscilación vertical
    positions[i * 3] = basePositions[i * 3] + Math.cos(elapsed + i * 1.1) * 0.05;  // leve movimiento horizontal X
    positions[i * 3 + 2] = basePositions[i * 3 + 2] + Math.sin(elapsed + i * 1.3) * 0.05; // movimiento Z
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
}
