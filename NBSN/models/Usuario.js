// models/usuario.js

export class Usuario {
  constructor(id, tipo = 'humano') {
    this.id = id;
    this.tipo = tipo;
    this.conexiones = new Map();
    this.intereses = new Set();
    this.desintereses = new Set();
    this.activacion = Math.random() * 0.5 + 0.1; // estado inicial
    this.nuevaActivacion = 0;
  }

  agregarConexion(usuarioId, peso = 1.0) {
    // Añade o actualiza una conexión con un peso (por defecto 1.0)
    this.conexiones.set(usuarioId, peso);
  }

  quitarConexion(usuarioId) {
    this.conexiones.delete(usuarioId);
  }

  agregarInteres(interes) {
    this.intereses.add(interes);
  }

  quitarInteres(interes) {
    this.intereses.delete(interes);
  }

  agregarDesinteres(desinteres) {
    this.desintereses.add(desinteres);
  }

  quitarDesinteres(desinteres) {
    this.desintereses.delete(desinteres);
  }

  compartirInteresesCon(otroUsuario) {
    this.intereses.forEach(interes => {
      if (!otroUsuario.intereses.has(interes)) {
        otroUsuario.agregarInteres(interes);
      }
    });
  }

  // Función para calcular una similitud de intereses entre este usuario y otro
  calcularSimilitud(otroUsuario) {
    const interesesComunes = new Set([...this.intereses].filter(i => otroUsuario.intereses.has(i)));
    const unionIntereses = new Set([...this.intereses, ...otroUsuario.intereses]);
    if (unionIntereses.size === 0) return 0;
    return interesesComunes.size / unionIntereses.size; // Jaccard similarity
  }

  // Función de activación sencilla para ponderar conexión basada en similitud de intereses
  activarConexion(otroUsuario) {
    const similitud = this.calcularSimilitud(otroUsuario);
    // Por ejemplo, función sigmoide como función de activación para graduar el peso
    const activacion = 1 / (1 + Math.exp(-10 * (similitud - 0.5)));
    this.agregarConexion(otroUsuario.id, activacion);
    return activacion; // retorna el peso activado
  }

	// Actualiza ponderaciones para todas las conexiones activando cada enlace según similitud
	actualizarPesosConexiones(usuariosMap) {
		this.conexiones.forEach((peso, usuarioId) => {
			const usuarioConectado = usuariosMap.get(usuarioId);
			if (usuarioConectado) {
				const nuevoPeso = this.activarConexion(usuarioConectado);
				this.conexiones.set(usuarioId, nuevoPeso);
			}
		});
	}
 
	actualizarActivacion(usuariosMap) {
		let entrada = 0;
		this.conexiones.forEach((peso, idUsuarioConectado) => {
			const usuarioConectado = usuariosMap.get(idUsuarioConectado);
			if (usuarioConectado) {
				entrada += peso * usuarioConectado.activacion;
			}
		});
		const tamanoRed = this.conexiones.size || 1;
		const entradaNormalize = entrada / tamanoRed;

		const ruido = (Math.random() - 0.5) * 0.1;  // Ruido pequeño

		// Pendiente más suave
		const pendiente = 2.5;
		this.nuevaActivacion = 1 / (1 + Math.exp(-pendiente * (entradaNormalize - 0.5 + ruido)));

		// Limitador de cambio por paso (inercia)
		const maxCambio = 0.05;
		const delta = this.nuevaActivacion - this.activacion;
		if (Math.abs(delta) > maxCambio) {
			this.nuevaActivacion = this.activacion + Math.sign(delta) * maxCambio;
		}
	}

	aplicarNuevaActivacion() {
		this.activacion = this.nuevaActivacion;
	}
}
