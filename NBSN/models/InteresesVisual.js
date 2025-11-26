export const coloresIntereses = {
  deporte: 0xff0000,
  musica: 0x0000ff,
  cine: 0x00ff00,
  tecnologia: 0xffff00,
  arte: 0xff00ff,
  lectura: 0x00ffff,
  viajes: 0xffa500
};

export function obtenerColorUsuario(usuario) {
  if (usuario.intereses.size === 0) return 0x888888;
  const primerInteres = usuario.intereses.values().next().value;
  return coloresIntereses[primerInteres] || 0xffffff;
}

export function colorConexion(usuarioA, usuarioB) {
  const interesesComunes = [...usuarioA.intereses].filter(i => usuarioB.intereses.has(i));
  if (interesesComunes.length === 0) return 0xaaaaaa;
  const interesPrincipal = interesesComunes[0];
  return coloresIntereses[interesPrincipal] || 0xffffff;
}
