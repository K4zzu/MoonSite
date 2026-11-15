// LunarExtras (scene detail helpers) + LunarUI (language, storytelling, small effects).
import * as THREE from 'three';
import LunarSim from './sim.js';
import { caseStory } from './realCase.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function hash(x, y, s) { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; }
// tileable grey detail texture (fine relief seen close up); craters = lunar version
function detailTex(craters) {
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W; const ctx = c.getContext('2d'), img = ctx.createImageData(W, W), d = img.data;
  const pn = (x, y, per, s) => { const xi = Math.floor(x), yi = Math.floor(y), u0 = x - xi, v0 = y - yi, u = u0 * u0 * (3 - 2 * u0), v = v0 * v0 * (3 - 2 * v0), h = (i, j) => hash(((i % per) + per) % per, ((j % per) + per) % per, s), a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), dd = h(xi + 1, yi + 1); return a + (b - a) * u + (cc - a) * v + (a - b - cc + dd) * u * v; };
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { let v = 0, a = .5; for (let o = 0; o < 5; o++) { const per = 6 << o; v += a * pn(x / W * per, y / W * per, per, 50 + o); a *= .5; } const g = clamp(128 + (v - .485) * 620, 0, 255), o2 = (y * W + x) * 4; d[o2] = d[o2 + 1] = d[o2 + 2] = g; d[o2 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  if (craters) { let a = 777; const r = () => { a = Math.imul(a, 1664525) + 1013904223 | 0; return (a >>> 0) / 4294967296; };
    for (let i = 0; i < 110; i++) { const cx = r() * W, cy = r() * W, rad = 3 + 44 * Math.pow(r(), 4), al = .5 + .5 * r();
      for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) { const x = cx + ox, y = cy + oy; if (x < -rad * 2 || x > W + rad * 2 || y < -rad * 2 || y > W + rad * 2) continue; const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 1.5);
        g.addColorStop(0, 'rgba(0,0,0,' + .3 * al + ')'); g.addColorStop(.5, 'rgba(0,0,0,' + .24 * al + ')'); g.addColorStop(.62, 'rgba(0,0,0,' + .06 * al + ')'); g.addColorStop(.67, 'rgba(255,255,255,' + .34 * al + ')'); g.addColorStop(.76, 'rgba(255,255,255,' + .08 * al + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 1.5, 0, 6.2832); ctx.fill(); } } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// triplanar detail multiplied into a standard material (no pole pinching)
function addDetail(mat, tex, k1, k2, amt) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.detailT = { value: tex }; sh.uniforms.dAmt = mat.userData.dAmt = { value: 1 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nuniform sampler2D detailT;\nuniform float dAmt;\nfloat triD(vec3 p){ vec3 n = abs(normalize(vOP)); n = n*n; n /= (n.x+n.y+n.z); return texture2D(detailT,p.yz).r*n.x + texture2D(detailT,p.xz).r*n.y + texture2D(detailT,p.xy).r*n.z; }')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat dF = ' + (1 - amt / 2).toFixed(3) + ' + ' + amt.toFixed(3) + ' * (0.5*triD(vOP*' + k1.toFixed(3) + ') + 0.5*triD(vOP.zxy*' + k2.toFixed(3) + ' + 0.37));\ndF = mix(1.0, dF, dAmt);\ndiffuseColor.rgb *= dF;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= dF;');
  };
}
// Equirectangular colour + bump lookups computed per fragment from the object-space position instead of the
// sphere's vertex UVs. Vertex UVs pinch into a triangle fan within ~1.4° of each pole, which smears the
// south-polar landing region; this samples it correctly. Call after addDetail (it reuses its vOP varying).
function sphericalMapping(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    prev?.(sh);
    const helpers = `
vec2 sphUv() { vec3 p = normalize(vOP); return vec2(atan(-p.z, p.x) / 6.28318530718 + 0.5, asin(clamp(p.y, -1.0, 1.0)) / 3.14159265359 + 0.5); }
vec2 wrapD(vec2 d) { d.x -= floor(d.x + 0.5); return d; }`;
    sh.fragmentShader = sh.fragmentShader
      .replace('uniform float dAmt;', 'uniform float dAmt;' + helpers)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec2 sUv = sphUv();
  diffuseColor *= textureGrad(map, sUv, wrapD(dFdx(sUv)), wrapD(dFdy(sUv)));
#endif`)
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment
        .replace('vec2 dSTdx = dFdx( vUv );', 'vec2 bUv = sphUv(); vec2 dSTdx = wrapD(dFdx( bUv ));')
        .replace('vec2 dSTdy = dFdy( vUv );', 'vec2 dSTdy = wrapD(dFdy( bUv ));')
        // equirect bump is meaningless within a few degrees of the pole: fade it out there
        .replace('return vec2( dBx, dBy );', 'vec3 nP = normalize(vOP); return vec2( dBx, dBy ) * smoothstep(0.03, 0.14, length(nP.xz));')
        .replace(/texture2D\( bumpMap, vUv/g, 'textureGrad( bumpMap, bUv').replace(/\)\.x/g, ', dSTdx, dSTdy).x'));
  };
  mat.customProgramCacheKey = () => 'spherical-' + key;
}
export const LunarExtras = { detailTex, addDetail, sphericalMapping };

// ---------------- language
const MISSIONS = [
  { site: 'shackleton', date: Date.UTC(2027, 11, 31), title: 'South pole, on time', desc: 'Shackleton Rim. The reference plan: a crater rim with long sunlight.' },
  { site: 'shackleton', date: Date.UTC(2028, 0, 3), title: 'South pole, 3 days late', desc: 'Same site after a launch delay. See how a small slip changes everything.' },
  { site: 'nobile', date: Date.UTC(2027, 11, 25), title: 'Nobile Rim', desc: 'A polar site further from the pole: more Sun, a different view of Earth.' },
  { site: 'a11', date: Date.UTC(2027, 11, 25), title: 'Tranquility Base', desc: 'Where Apollo 11 landed. Near the equator: Earth always overhead, two weeks of day, then two of night.' },
  { site: 'ce4', date: Date.UTC(2027, 11, 25), title: 'Far side', desc: 'Von Kármán crater. Earth never rises here, so there is no direct link.' }
];
const TUTORIAL = [
  { sel: null, title: 'What this is for', text: 'A lander on the Moon needs two things: sunlight for power and a clear view of Earth to communicate. Near the south pole both come and go. This tool shows, for a landing site and a launch date, whether you get both, and what to do if the launch slips.' },
  { sel: '[data-tut=where]', title: 'Where and when', text: 'This is the landing site and the launch date. Tap either one to change it and the whole mission is replanned.' },
  { sel: '[data-tut=scales]', title: 'Three scales, one scene', text: 'Earth to Moon shows the journey. Moon lets you pick a site: gold dots have Sun, blue threads can see Earth. Surface puts you standing at the site.' },
  { sel: '[data-story=box]', title: 'The story', text: 'This line always tells you what is happening right now, in plain words.' },
  { sel: '[data-tut=timeline]', title: 'The mission timeline', text: 'Press play or drag. Tap a milestone to jump there. On the right, the gold band shows when the site has Sun and the blue band when it can talk to Earth. Dark means neither.' },
  { sel: '[data-verdict]', title: 'The verdict', text: 'One colour and one sentence: green is viable, red is not. After a change it also shows what got better or worse.' },
  { sel: '[data-actions]', title: 'Try a delay', text: 'Simulate delay moves the launch 3 days and replans the route in front of you. If the plan fails, numbered alternatives appear: tap one to take it. Compare shows missions side by side, Details has the exact numbers, Explain adds notes.' },
  { sel: '[data-tut=camera]', title: 'Look around', text: 'Drag to turn the camera and scroll to zoom. This button switches between following the spacecraft, riding on board, and a free camera. Keys: Space play, ← → step an hour, 1 2 3 scales, D details, M sound.' },
  { sel: '[data-tut=footer]', title: 'Anytime', text: 'Change language, replay this tutorial or reduce motion from here. Now press play and watch the mission.' }
];
const ES = {
  'When and where can a lander survive?': '¿Cuándo y dónde puede sobrevivir un módulo?', 'Each cell is one mission: a landing site and a launch date. It is viable only if the lander gets enough sunlight for power and enough contact with Earth. Pick one to fly it, or up to four to compare them from launch to landing.': 'Cada celda es una misión: un sitio de alunizaje y una fecha de despegue. Solo es viable si el módulo recibe suficiente luz solar para tener energía y suficiente contacto con la Tierra. Elige una para volarla, o hasta cuatro para compararlas del despegue al alunizaje.', 'Landing site ↓  Launch date →': 'Sitio de alunizaje ↓  Fecha de despegue →', 'Not viable': 'No viable', 'No night': 'Sin noche', 'Hours with Sun': 'Horas con Sol', 'Longest stretch without Sun': 'Tramo más largo sin Sol', 'Full mission': 'Misión completa', 'Apollo': 'Apollo',
  'This is the landing site and the launch date. Tap either one to change it and the whole mission is replanned.': 'Este es el sitio de alunizaje y la fecha de despegue. Toca cualquiera para cambiarlo y toda la misión se replanifica.',
  'Can a lander survive at this site, on this date?': '¿Puede un módulo sobrevivir en este sitio, en esta fecha?', 'A lander on the Moon needs sunlight for power and a clear view of Earth to communicate. Near the south pole both come and go. Fly a mission from launch to landing and see whether it gets both.': 'Un módulo en la Luna necesita luz solar para tener energía y ver la Tierra para comunicarse. Cerca del polo sur ambas van y vienen. Vuela una misión del despegue al alunizaje y mira si consigue las dos.',
  'Sunlight for power': 'Luz solar para la energía', 'A link to Earth to communicate': 'Un enlace con la Tierra para comunicarse', 'Start with a short tutorial': 'Empezar con un tutorial breve', 'Skip tutorial': 'Saltar tutorial', 'Replay tutorial': 'Repetir tutorial', 'Menu': 'Menú',
  'Choose a mission to watch': 'Elige una misión para ver', 'A lander on the Moon needs sunlight for power and a view of Earth to communicate. Pick a mission and watch whether it gets both.': 'Un módulo en la Luna necesita luz solar para tener energía y ver la Tierra para comunicarse. Elige una misión y mira si consigue ambas.',
  'Pick one to fly it, or up to four to compare them side by side.': 'Elige una para volarla, o hasta cuatro para compararlas lado a lado.', 'Start mission': 'Iniciar misión', 'How it works': 'Cómo funciona', 'Your own site and date': 'Tu propio sitio y fecha', 'Choose any site on the Moon and any launch date.': 'Elige cualquier sitio de la Luna y cualquier fecha de despegue.',
  'Missions': 'Misiones', 'Tutorial': 'Tutorial', 'Skip': 'Saltar', 'Back': 'Atrás', 'Next': 'Siguiente', 'Done': 'Listo',
  'South pole, on time': 'Polo sur, a tiempo', 'Shackleton Rim. The reference plan: a crater rim with long sunlight.': 'Shackleton Rim. El plan de referencia: el borde de un cráter con mucha luz solar.',
  'South pole, 3 days late': 'Polo sur, 3 días tarde', 'Same site after a launch delay. See how a small slip changes everything.': 'El mismo sitio tras un retraso del despegue. Mira cómo un pequeño retraso lo cambia todo.',
  'A polar site further from the pole: more Sun, a different view of Earth.': 'Un sitio polar más alejado del polo: más Sol y otra vista de la Tierra.',
  'Where Apollo 11 landed. Near the equator: Earth always overhead, two weeks of day, then two of night.': 'Donde alunizó el Apolo 11. Cerca del ecuador: la Tierra siempre arriba, dos semanas de día y luego dos de noche.',
  'Far side': 'Cara oculta', 'Von Kármán crater. Earth never rises here, so there is no direct link.': 'Cráter Von Kármán. Aquí la Tierra nunca sale, así que no hay enlace directo.',
  'What this is for': 'Para qué sirve', 'A lander on the Moon needs two things: sunlight for power and a clear view of Earth to communicate. Near the south pole both come and go. This tool shows, for a landing site and a launch date, whether you get both, and what to do if the launch slips.': 'Un módulo en la Luna necesita dos cosas: luz solar para tener energía y ver la Tierra para comunicarse. Cerca del polo sur ambas van y vienen. Esta herramienta muestra, para un sitio de alunizaje y una fecha de despegue, si tienes las dos, y qué hacer si el despegue se retrasa.',
  'Where and when': 'Dónde y cuándo', 'This is the landing site and the launch date. Tap either one to change it. Missions takes you back to the mission list.': 'Este es el sitio de alunizaje y la fecha de despegue. Toca cualquiera para cambiarlo. Misiones te lleva de vuelta a la lista de misiones.',
  'Three scales, one scene': 'Tres escalas, una escena', 'Earth to Moon shows the journey. Moon lets you pick a site: gold dots have Sun, blue threads can see Earth. Surface puts you standing at the site.': 'Tierra a Luna muestra el viaje. Luna te deja elegir un sitio: los puntos dorados tienen Sol, los hilos azules ven la Tierra. Superficie te pone de pie en el sitio.',
  'The story': 'La historia', 'This line always tells you what is happening right now, in plain words.': 'Esta línea siempre te dice qué está pasando ahora mismo, en palabras simples.',
  'The mission timeline': 'La línea de tiempo de la misión', 'Press play or drag. Tap a milestone to jump there. On the right, the gold band shows when the site has Sun and the blue band when it can talk to Earth. Dark means neither.': 'Pulsa reproducir o arrastra. Toca un hito para saltar a él. A la derecha, la banda dorada muestra cuándo el sitio tiene Sol y la azul cuándo puede hablar con la Tierra. Oscuro significa ninguna de las dos.',
  'The verdict': 'El veredicto', 'One colour and one sentence: green is viable, red is not. After a change it also shows what got better or worse.': 'Un color y una frase: verde es viable, rojo no. Tras un cambio también muestra qué mejoró o empeoró.',
  'Try a delay': 'Prueba un retraso', 'Simulate delay moves the launch 3 days and replans the route in front of you. If the plan fails, numbered alternatives appear: tap one to take it. Compare shows missions side by side, Details has the exact numbers, Explain adds notes.': 'Simular retraso mueve el despegue 3 días y replanifica la ruta ante tus ojos. Si el plan falla, aparecen alternativas numeradas: toca una para tomarla. Comparar muestra misiones lado a lado, Detalles tiene los números exactos, Explicar añade notas.',
  'Look around': 'Mira alrededor', 'Drag to turn the camera and scroll to zoom. This button switches between following the spacecraft, riding on board, and a free camera. Keys: Space play, ← → step an hour, 1 2 3 scales, D details, M sound.': 'Arrastra para girar la cámara y usa la rueda para acercar. Este botón alterna entre seguir la nave, ir a bordo y una cámara libre. Teclas: Espacio reproducir, ← → una hora, 1 2 3 escalas, D detalles, M sonido.',
  'Anytime': 'En cualquier momento', 'Change language, replay this tutorial or reduce motion from here. Now press play and watch the mission.': 'Cambia el idioma, repite este tutorial o reduce el movimiento desde aquí. Ahora pulsa reproducir y mira la misión.',
  'Earth': 'Tierra', 'Moon': 'Luna', 'Sun': 'Sol', 'Moon at arrival ·': 'Luna al llegar ·', 'Old arrival': 'Llegada anterior', 'Replanning…': 'Replanificando…', 'Replanning': 'Replanificando', 'Mission time': 'Tiempo de misión', 'To the Moon': 'Hasta la Luna', 'Speed': 'Velocidad',
  'Sunlight': 'Luz solar', 'Link to Earth': 'Enlace con la Tierra', 'Smooth horizon — no terrain data': 'Horizonte liso — sin datos de terreno', 'change': 'cambiar', 'Launch': 'Despegue', 'Your own coordinates': 'Tus propias coordenadas', 'Go': 'Ir',
  '− 1 day': '− 1 día', '+ 1 day': '+ 1 día', '10 days earlier': '10 días antes', '21 days later': '21 días después', 'Current date': 'Fecha actual', 'Drag to watch the route change. Release to replan.': 'Arrastra para ver cambiar la ruta. Suelta para replanificar.',
  'Earth to Moon': 'Tierra a Luna', 'Surface': 'Superficie', 'Explain': 'Explicar', 'Compare': 'Comparar', 'Details': 'Detalles', 'Simulate delay': 'Simular retraso', 'Sun height': 'Altura del Sol', 'Direct transfer, two-body model': 'Transferencia directa, modelo de dos cuerpos',
  'In sunlight now': 'Con Sol ahora', 'In shadow': 'En sombra', 'Can see Earth': 'Ve la Tierra', 'Tap a site': 'Toca un sitio', 'Earth vs Moon': 'Tierra vs Luna', 'On Earth, in one day': 'En la Tierra, en un día', 'The Sun rises, climbs high and sets within hours.': 'El Sol sale, sube alto y se pone en pocas horas.',
  'At the lunar south pole, in one month': 'En el polo sur lunar, en un mes', 'The Sun slides along the horizon, never more than about 1.5° up. Any hill can hide it for days.': 'El Sol se desliza por el horizonte, nunca más de unos 1,5° de altura. Cualquier colina puede taparlo durante días.',
  '+ Add view': '+ Añadir vista', 'Close': 'Cerrar', 'Surface operations': 'Operaciones en superficie', 'Burns, change in velocity': 'Encendidos, cambio de velocidad', 'Mission requirements': 'Requisitos de la misión', 'Export plan (JSON)': 'Exportar plan (JSON)',
  'Data: NASA/JPL Horizons, LRO LOLA. Not an official NASA product.': 'Datos: NASA/JPL Horizons, LRO LOLA. No es un producto oficial de la NASA.', 'Prototype: analytic ephemerides, procedural terrain.': 'Prototipo: efemérides analíticas, terreno procedural.', 'Reduce motion:': 'Reducir movimiento:', 'on': 'sí', 'off': 'no',
  'The Moon keeps moving. We aim at where it will be in 3 days, not where it is now.': 'La Luna sigue moviéndose. Apuntamos a donde estará en 3 días, no a donde está ahora.',
  'The edge between day and night is called the terminator. At the south pole sunlight always arrives sideways, so crater floors stay dark.': 'El borde entre el día y la noche se llama terminador. En el polo sur la luz siempre llega de lado, así que el fondo de los cráteres queda a oscuras.',
  'Here the Sun never climbs. It circles the horizon once a month, so one ridge is enough to block it.': 'Aquí el Sol nunca sube. Rodea el horizonte una vez al mes, así que una sola cresta basta para taparlo.',
  'Earth stays almost still in the sky. The blue beam is the radio link home.': 'La Tierra casi no se mueve en el cielo. El haz azul es el enlace de radio con casa.',
  'Following spacecraft': 'Siguiendo la nave', 'Free camera': 'Cámara libre', 'Onboard view': 'Vista a bordo', 'Stand here': 'Ir a este sitio', 'Land here': 'Alunizar aquí', 'Yes, now': 'Sí, ahora', 'Not visible': 'No visible', 'No link': 'Sin enlace',
  'Night begins in': 'La noche empieza en', 'Sunrise in': 'Amanece en', 'Earth link lost in': 'Se pierde el enlace en', 'Earth link back in': 'Vuelve el enlace en', 'Sun behind terrain': 'Sol tras el terreno', 'Night': 'Noche', 'Earth behind terrain': 'Tierra tras el terreno', 'No link to Earth': 'Sin enlace con la Tierra',
  'Parking orbit': 'Órbita de aparcamiento', 'Coast': 'Travesía', 'Lunar orbit': 'Órbita lunar', 'Descent': 'Descenso', 'Translunar burn': 'Encendido translunar', 'Landing': 'Alunizaje', 'Viable': 'Viable', 'Marginal': 'Marginal', 'Still viable': 'Sigue siendo viable', 'Not viable — lands in darkness': 'No viable — aluniza a oscuras',
  'Original plan': 'Plan original', 'Site': 'Sitio', 'Arrival': 'Llegada', 'Earth link': 'Enlace', 'Hours with sunlight': 'Horas con Sol', 'Hours with Earth link': 'Horas con enlace', 'Hours with both': 'Horas con ambos', 'Longest night': 'Noche más larga', 'Highest Sun elevation': 'Elevación solar máxima',
  'Lunar orbit insertion': 'Inserción en órbita lunar', 'Descent and landing': 'Descenso y alunizaje', 'Total': 'Total', 'Coast time': 'Tiempo de travesía', 'Surface stay': 'Estancia en superficie', 'Longest time without Sun': 'Máximo tiempo sin Sol', 'Minimum Earth link': 'Enlace mínimo',
  'South pole candidates': 'Candidatos del polo sur', 'International': 'Internacional', 'Custom': 'Personalizado', 'Latitude −90 to 90, longitude −180 to 180': 'Latitud de −90 a 90, longitud de −180 a 180',
  'Starting': 'Iniciando', 'Loading lunar data': 'Cargando datos lunares', 'Placing the stars': 'Colocando las estrellas', 'Painting the Earth': 'Pintando la Tierra', 'Sculpting the Moon': 'Esculpiendo la Luna', 'Plotting the route': 'Trazando la ruta', 'Surveying the landing site': 'Explorando el sitio de alunizaje', 'Ready': 'Listo',
  'click to choose a site': 'haz clic para elegir un sitio', 'Spacecraft': 'Nave', 'click to follow': 'haz clic para seguirla', 'slowed down': 'a cámara lenta', 'Plan updated': 'Plan actualizado',
  'The plan changed. The old route stays as a grey line so you can compare.': 'El plan cambió. La ruta anterior queda como línea gris para que puedas comparar.',
  'A new launch date means the Moon will be somewhere else on arrival. Watch its meeting point slide along the orbit.': 'Con otra fecha de despegue, la Luna estará en otro lugar al llegar. Mira cómo el punto de encuentro se desliza por la órbita.',
  'Same launch, new target on the Moon. The route is recalculated.': 'Mismo despegue, nuevo destino en la Luna. La ruta se recalcula.',
  'The new route is drawn from Earth to the new meeting point.': 'La nueva ruta se dibuja desde la Tierra hasta el nuevo punto de encuentro.',
  'Checking sunlight and Earth link at the landing site.': 'Comprobando la luz solar y el enlace con la Tierra en el sitio de alunizaje.',
  'The new plan works: enough sunlight for power and enough contact with Earth.': 'El nuevo plan funciona: suficiente luz para energía y suficiente contacto con la Tierra.',
  'The new plan is on the edge. It works only with little margin for night or lost contact.': 'El nuevo plan está al límite. Funciona, pero con poco margen de noche o de pérdida de contacto.',
  'The new plan fails. Tap one of the numbered routes to try an alternative.': 'El nuevo plan falla. Toca una de las rutas numeradas para probar una alternativa.',
  'The new plan fails at this site and date.': 'El nuevo plan falla en este sitio y fecha.',
  '1 · Launch': '1 · Despegue', 'The rocket climbs out of the atmosphere and tilts over to gain speed. In about nine minutes it is in orbit.': 'El cohete sale de la atmósfera y se inclina para ganar velocidad. En unos nueve minutos está en órbita.',
  '2 · Parking orbit': '2 · Órbita de aparcamiento', 'The spacecraft circles Earth 185 km up, waiting for the exact moment to leave.': 'La nave rodea la Tierra a 185 km de altura, esperando el momento exacto para partir.',
  '3 · Translunar burn': '3 · Encendido translunar', 'The engine fires for a few minutes. The orbit stretches into a long ellipse that reaches the Moon’s path.': 'El motor se enciende unos minutos. La órbita se estira en una elipse larga que alcanza el camino de la Luna.',
  '4 · Coast': '4 · Travesía', 'Engine off. The spacecraft coasts towards where the Moon will be, slowing down as Earth pulls it back.': 'Motor apagado. La nave viaja hacia donde estará la Luna, frenándose porque la Tierra tira de ella.',
  'The Moon’s gravity is taking over. The spacecraft speeds up again as it falls towards it.': 'La gravedad de la Luna empieza a dominar. La nave vuelve a acelerar mientras cae hacia ella.',
  '5 · Lunar orbit insertion': '5 · Inserción en órbita lunar', 'A braking burn lets the Moon capture the spacecraft. Without it, it would fly past.': 'Un encendido de frenado permite que la Luna capture la nave. Sin él, pasaría de largo.',
  '5 · Lunar orbit': '5 · Órbita lunar', 'The spacecraft circles the Moon 100 km up, passing over the poles, until the landing site comes around.': 'La nave rodea la Luna a 100 km de altura, pasando sobre los polos, hasta que el sitio de alunizaje queda debajo.',
  '6 · Descent': '6 · Descenso', 'It leaves orbit and drops towards the landing site.': 'Deja la órbita y cae hacia el sitio de alunizaje.',
  '6 · Landing': '6 · Alunizaje', 'The engine burns against the fall. Dust flies as the lander touches down.': 'El motor frena la caída. El polvo vuela cuando el módulo toca el suelo.',
  '7 · Surface operations': '7 · Operaciones en superficie',
  'On the ground. The Sun gives power and Earth is in view, so the lander can work and talk.': 'En el suelo. El Sol da energía y la Tierra está a la vista: el módulo puede trabajar y comunicarse.',
  'There is power, but terrain hides Earth. No contact until Earth rises above the ridge.': 'Hay energía, pero el terreno tapa la Tierra. No hay contacto hasta que la Tierra suba sobre la cresta.',
  'The Sun is behind terrain. The lander runs on batteries and waits for sunrise.': 'El Sol está tras el terreno. El módulo funciona con baterías y espera el amanecer.',
  'No Sun and no Earth. This is the hardest moment of the mission.': 'Sin Sol y sin Tierra. Es el momento más difícil de la misión.',
  'Ephemerides: JPL Horizons.': 'Efemérides: JPL Horizons.', 'Ephemerides: analytic model (lunar-data files are mock).': 'Efemérides: modelo analítico (los archivos de lunar-data son de prueba).', 'Terrain: LOLA horizons.': 'Terreno: horizontes LOLA.', 'Terrain: procedural.': 'Terreno: procedural.', 'Launch countdown': 'Cuenta regresiva', 'Go for launch': 'Listos para despegar', 'Internal power': 'Energía interna', 'Ignition sequence start': 'Inicia secuencia de ignición', 'Main engine start': 'Encendido de motores', 'Liftoff': 'Despegue', 'Skip countdown': 'Saltar cuenta regresiva', 'Max-Q': 'Max-Q', 'Maximum aerodynamic pressure': 'Máxima presión aerodinámica', 'Booster separation': 'Separación de propulsores', 'Fairing separation': 'Separación de la cofia', 'The lander unfolds its solar panels': 'El módulo despliega sus paneles solares', 'Main engine cut-off': 'Apagado del motor principal', 'Stage separation': 'Separación de etapa', 'Orbit insertion': 'Inserción en órbita', '185 km parking orbit': 'Órbita de aparcamiento a 185 km', 'Translunar injection': 'Inyección translunar', 'Leaving Earth orbit': 'Saliendo de la órbita terrestre', 'Upper stage separation': 'Separación de la etapa superior', 'Powered descent': 'Descenso propulsado', 'Touchdown': 'Contacto con la superficie', 'Sound: ': 'Sonido: ', 'Operational windows': 'Ventanas operativas', 'Both': 'Ambos', 'None during the surface stay.': 'Ninguna durante la estancia.', '1 m² vertical sun-tracking panel, 30 % efficient, averaged over the stay.': 'Panel vertical de 1 m² que sigue al Sol, 30 % de eficiencia, promedio de la estancia.', 'Mission report (PDF)': 'Reporte de misión (PDF)', 'Windows (CSV)': 'Ventanas (CSV)', 'Sky from the landing site': 'Cielo desde el sitio de alunizaje', 'Dotted lines: paths during the surface stay. Filled dot: above the terrain.': 'Líneas punteadas: trayectorias durante la estancia. Punto relleno: sobre el terreno.', 'Open in NASA Moon Trek': 'Abrir en NASA Moon Trek', 'Analytic model': 'Modelo analítico', 'Procedural': 'Procedural', 'Ephemerides: JPL Horizons. Terrain: LOLA horizons.': 'Efemérides: JPL Horizons. Terreno: horizontes LOLA.'
};
// strings added with the landing sequence and the real case
Object.assign(ES, {
  '6 · Powered descent': '6 · Descenso propulsado', '6 · Final approach': '6 · Aproximación final',  'A short braking burn half an orbit before the site. The lander now falls from 100 km to 15 km without the engine.': 'Un breve encendido de frenado media órbita antes del sitio. Ahora el módulo cae de 100 km a 15 km sin motor.',  'The engine fires forward to cancel 1.7 km/s of orbital speed. The lander crosses 450 km of ground in 12 minutes.': 'El motor empuja hacia delante para anular 1,7 km/s de velocidad orbital. El módulo recorre 450 km de terreno en 12 minutos.',  'The lander pitches upright so its sensors can see the ground, and picks a safe spot to land.': 'El módulo se endereza para que sus sensores vean el suelo y elige un lugar seguro para posarse.',  'The engine blasts the dust away. With no air, it flies out in straight lines and nothing hangs in the sky.': 'El motor barre el polvo. Sin aire, sale disparado en línea recta y nada queda flotando.',  'Tower cleared': 'Torre despejada', 'Deorbit burn': 'Encendido de desorbitación', 'Perilune lowered to 15 km': 'Perilunio rebajado a 15 km', 'Braking from 1.7 km/s': 'Frenando desde 1,7 km/s',  'High gate': 'Puerta alta', 'The lander pitches upright': 'El módulo se endereza', 'Engine cut-off': 'Apagado del motor', 'Altitude': 'Altitud',  'Main engine cut-off · second stage ignition': 'Apagado del motor principal · encendido de la segunda etapa', 'Ground camera': 'Cámara en tierra',
  'Real case · 2025': 'Caso real · 2025', 'IM-2 Athena at Mons Mouton: what a one-week slip would have done': 'IM-2 Athena en Mons Mouton: qué habría pasado con una semana de retraso',
  'A real south-pole landing with almost no light margin. Watch it next to the same mission one week late, without replanning, then replan it yourself.': 'Un alunizaje real en el polo sur con casi nada de margen de luz. Míralo junto a la misma misión una semana tarde y sin replanificar, y luego replanifícala tú.',
  'One day later': 'Un día después', 'Waiting in lunar orbit for the landing site to pass below': 'Esperando en órbita lunar a que el sitio de alunizaje pase por debajo',
  'Watch the case': 'Ver el caso', 'Real mission: in a crater, on its side': 'Misión real: en un cráter, de lado', 'End of the real mission': 'Fin de la misión real',
  'Batteries depleted: no sunlight on the panels': 'Baterías agotadas: sin luz en los paneles', 'Good window · real mission lost in 13 h': 'Buena ventana · misión real perdida en 13 h',
});
const gain = s => s.replace('sunlight', 'luz solar').replace('full Earth link', 'enlace total con la Tierra').replace('Earth link', 'enlace con la Tierra');
const RULES = [
  [/^Not viable — Sun sets (\d+) h after landing$/, m => 'No viable — el Sol se pone ' + m[1] + ' h después de alunizar'],
  [/^Not viable — (\d+) h without Sun$/, m => 'No viable — ' + m[1] + ' h sin Sol'],
  [/^Not viable — Earth link only (\d+)% of the time$/, m => 'No viable — enlace con la Tierra solo el ' + m[1] + '% del tiempo'],
  [/^Land (\d+) days? later: (.+)$/, m => 'Alunizar ' + m[1] + (m[1] === '1' ? ' día' : ' días') + ' después: ' + gain(m[2])],
  [/^Same date at (.+): (.+)$/, m => 'Misma fecha en ' + m[1] + ': ' + gain(m[2])],
  [/^Launch (.+)$/, m => 'Despegue ' + m[1]], [/^Night (\d+) h$/, m => 'Noche ' + m[1] + ' h'], [/^(\d) — (.+)$/, m => m[1] + ' — ' + m[2]], [/^Compare (\d) missions$/, m => 'Comparar ' + m[1] + ' misiones'], [/^Sunlight (\d+)%$/, m => 'Luz solar ' + m[1] + '%'], [/^Earth link (\d+)%$/, m => 'Enlace ' + m[1] + '%'], [/^Arrives (.+)$/, m => 'Llega ' + m[1]],
  [/^([\d,]+) km from the Moon$/, m => 'a ' + m[1].replace(/,/g, '.') + ' km de la Luna'], [/^(-?[\d.]+)° above the horizon$/, m => m[1] + '° sobre el horizonte'], [/^([\d.]+) million km away$/, m => 'a ' + m[1] + ' millones de km'],
  [/^(\d+) windows · (.+) total$/, m => m[1] + ' ventanas · ' + m[2] + ' en total'], [/^Power ≈ (.+) W · (.+) kWh\/day$/, m => 'Potencia ≈ ' + m[1] + ' W · ' + m[2] + ' kWh/día'], [/^Sun and Earth: (.+)$/, m => 'Sol y Tierra: ' + (ES[m[1]] || m[1])], [/^Horizon: (.+)$/, m => 'Horizonte: ' + (ES[m[1]] || m[1])], [/^horizon (.+)$/, m => 'horizonte ' + m[1]],
  [/^‹ (.+)$/, m => '‹ ' + (ES[m[1]] || m[1])], [/^(.+) ›$/, m => (ES[m[1]] || m[1]) + ' ›']
];
function tr(lang, s) {
  if (lang !== 'es' || !s) return s; const k = s.trim(); if (!k) return s;
  const one = x => { if (ES[x]) return ES[x]; for (const r of RULES) { const m = x.match(r[0]); if (m) return r[1](m); } return x; };
  const out = ES[k] || (k.indexOf(' · ') >= 0 ? k.split(' · ').map(one).join(' · ') : one(k));
  return out === k ? s : s.replace(k, out);
}
function applyLang(c) {
  const root = c.root.current; if (!root) return; const lang = c.lang(); if (c._lastLang !== lang) { c._lastLang = lang; c._storyKey = null; c._force = true; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('[data-roll],[data-txt],[data-story],[data-edge]')) continue; const cur = n.nodeValue; if (n._out !== cur) n._src = cur; const out = tr(lang, n._src); if (out !== cur) n.nodeValue = out; n._out = out; }
}
// ---------------- storytelling: what is happening right now, in one sentence
function storyOf(c, pl, t, sk) {
  const S = LunarSim, M = 60000, r = c.rp;
  if (r) return ['Replanning', r.k < .12 ? 'The plan changed. The old route stays as a grey line so you can compare.' : r.k < .55 ? (r.slide ? 'A new launch date means the Moon will be somewhere else on arrival. Watch its meeting point slide along the orbit.' : 'Same launch, new target on the Moon. The route is recalculated.') : r.k < .95 ? 'The new route is drawn from Earth to the new meeting point.' : 'Checking sunlight and Earth link at the landing site.'];
  if (c.hold && performance.now() < c.hold.until) return [c.hold.ch, c.hold.tx];
  const cs = caseStory(c.realCase, pl, t, c.lang()); if (cs) return cs; // real case (IM-2): its own story line, already localized
  if (t < pl.launch + 10 * M) return ['1 · Launch', 'The rocket climbs out of the atmosphere and tilts over to gain speed. In about nine minutes it is in orbit.'];
  if (t < pl.tTLI - 4 * M) return ['2 · Parking orbit', 'The spacecraft circles Earth 185 km up, waiting for the exact moment to leave.'];
  if (t < pl.tTLI + 6 * M) return ['3 · Translunar burn', 'The engine fires for a few minutes. The orbit stretches into a long ellipse that reaches the Moon’s path.'];
  if (t < pl.tA - 10 * M) return ['4 · Coast', (t - pl.tTLI) / (pl.tA - pl.tTLI) < .82 ? 'Engine off. The spacecraft coasts towards where the Moon will be, slowing down as Earth pulls it back.' : 'The Moon’s gravity is taking over. The spacecraft speeds up again as it falls towards it.'];
  if (t < pl.tA + 10 * M) return ['5 · Lunar orbit insertion', 'A braking burn lets the Moon capture the spacecraft. Without it, it would fly past.'];
  const s = (pl.tLand - t) / 1000;
  if (s > S.DEORBIT_S + 30) return ['5 · Lunar orbit', 'The spacecraft circles the Moon 100 km up, passing over the poles, until the landing site comes around.'];
  if (s > S.PDI_S) return ['6 · Descent', 'A short braking burn half an orbit before the site. The lander now falls from 100 km to 15 km without the engine.'];
  if (s > 200) return ['6 · Powered descent', 'The engine fires forward to cancel 1.7 km/s of orbital speed. The lander crosses 450 km of ground in 12 minutes.'];
  if (s > 40) return ['6 · Final approach', 'The lander pitches upright so its sensors can see the ground, and picks a safe spot to land.'];
  if (s > -60) return ['6 · Landing', 'The engine blasts the dust away. With no air, it flies out in straight lines and nothing hangs in the sky.'];
  const lit = sk.lit > .5;
  return ['7 · Surface operations', lit && sk.link ? 'On the ground. The Sun gives power and Earth is in view, so the lander can work and talk.' : lit ? 'There is power, but terrain hides Earth. No contact until Earth rises above the ridge.' : sk.link ? 'The Sun is behind terrain. The lander runs on batteries and waits for sunrise.' : 'No Sun and no Earth. This is the hardest moment of the mission.'];
}
function updateStory(c, pl, t, sk) {
  const root = c.root.current, box = root && root.querySelector('[data-story=box]'); if (!box) return;
  const st = storyOf(c, pl, t, sk), slow = c.state.playing && c.slow, key = st[0] + '|' + st[1] + '|' + slow; if (key === c._storyKey) return; c._storyKey = key;
  const lang = c.lang(), ch = tr(lang, st[0]) + (slow ? ' · ' + tr(lang, 'slowed down') : ''), tx = tr(lang, st[1]), chEl = box.querySelector('[data-story=ch]'), txEl = box.querySelector('[data-story=tx]');
  if (txEl.textContent === tx) { chEl.textContent = ch; return; }
  box.style.opacity = 0; box.style.transform = 'translateY(6px)'; clearTimeout(c._stT);
  c._stT = setTimeout(() => { chEl.textContent = ch; txEl.textContent = tx; box.style.opacity = 1; box.style.transform = 'translateY(0)'; }, c.reduce() ? 0 : 280);
}
function ping(c, x, y, color) {
  const root = c.root.current, el = root && root.querySelector('[data-ping]'); if (!el || c.reduce()) return; const base = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) ';
  el.style.transition = 'none'; el.style.borderColor = color; el.style.transform = base + 'scale(.25)'; el.style.opacity = .95; el.getBoundingClientRect();
  el.style.transition = 'transform 1s cubic-bezier(.2,.7,.2,1), opacity 1s'; el.style.transform = base + 'scale(3.4)'; el.style.opacity = 0;
}
// cinematic time: playback slows down for the moments worth watching (seconds of mission per second)
// Launch: the first seconds near real time so the rocket feels heavy, then faster, easing off around each staging event.
// Landing: deorbit, powered descent, then the final 150 s seen from the ground, and a short hold after touchdown.
function eventRate(pl, t) {
  const M = 60000, d = (t - pl.launch) / 1000, s = (pl.tLand - t) / 1000, near = (x, c, w) => Math.abs(x - c) < w;
  if (d >= 0 && d < 600) return d < 10 ? 2.5 : d < 40 ? 10 : near(d, 72, 5) || near(d, 150, 7) || near(d, 210, 7) || (d > 498 && d < 520) ? 12 : 40;
  if (d >= 600 && t < pl.tTLI - 4 * M) return 800; // parking orbit, seen from on board: about six seconds for most of a lap
  if (Math.abs(t - pl.tTLI) < 4 * M) return 30;
  // lunar arrival: a steady pace for the swing past the Moon, the insertion burn, the first minutes in orbit
  if (t > pl.tA - 90 * M && t < pl.tA - 4 * M) return 500; if (Math.abs(t - pl.tA) < 4 * M) return 60; if (t > pl.tA && t < pl.tA + 15 * M) return 120;
  if (near(s, LunarSim.DEORBIT_S, 40)) return 20; if (s > 840 && s < LunarSim.DEORBIT_S) return 600; // coast down from 100 km to 15 km
  if (s > 0 && s < 40) return 4.5; if (s > 0 && s < 150) return 9; if (s > 0 && s < 840) return 45;
  if (s <= 0 && s > -20) return 4; if (s <= 0 && s > -90) return 15; return 1e9;
}
export const LunarUI = { MISSIONS, TUTORIAL, tr, applyLang, updateStory, ping, eventRate };
