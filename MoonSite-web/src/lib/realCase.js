// Real case: Intuitive Machines IM-2 "Athena" (2025), Mons Mouton, 84.8° S.
// Facts (company statements, March 2025): launched 26 Feb 2025, landed 6 Mar 2025 about 250 m from its target inside a
// small crater, on its side; the solar panels could not recharge and the mission ended about 13 hours after landing,
// against roughly ten planned days. Intuitive Machines cited altimeter interference, reduced crater recognition and the
// south-pole lighting conditions.
// What MoonSite adds (JPL Horizons 2025 + LOLA horizon, lunar-data/public/data/mons-mouton-2025.json): the date itself was
// a good window, but the Sun stood only ~2.5° above the horizon, so there was almost no light margin; and the window
// was narrow: the same mission one week late, flown without replanning, gets far less sunlight. That delayed,
// un-replanned mission is the grey ghost route; the user can then replan it (Simulate delay) with the usual alternatives.
import LunarSim from './sim.js';

const S = LunarSim;
export const IM2 = {
  siteId: 'im2',
  landing: Date.UTC(2025, 2, 6, 17, 30), // 6 March 2025 (hour approximate)
  delayDays: 7,
  req: { duration: 10, maxDark: 48, minLink: 50 }, // ~10 planned days on the surface, until lunar night
  lostAfterH: 13,
};

/** The real mission (landing on the real date) and the ghost: the same mission one week late, not replanned. */
export function casePlans(site, req = IM2.req) {
  let launch = IM2.landing - 4.6 * S.DAY;
  for (let i = 0; i < 4; i++) launch += IM2.landing - S.computePlan(launch, site, req).tLand; // our direct transfer, real landing date
  const plan = S.computePlan(launch, site, req), ghost = S.computePlan(launch + IM2.delayDays * S.DAY, site, req);
  return { plan, ghost, req };
}

const T = {
  en: {
    ch: 'Real case · IM-2 Athena',
    launch: 'Intuitive Machines, 2025: a lander heading for Mons Mouton, 84.8° S. The grey route is the same mission one week late, flown without replanning. (Athena launched on 26 Feb on a longer route; our direct route leaves on 2 Mar to land on the real date.)',
    coast: 'Same rocket, same lander: only the date changes. One week later the Moon is elsewhere, and so is the light at Mons Mouton.',
    orbit: 'At 84.8° S the Sun never climbs more than a few degrees. A low hill, or a small crater, is enough to hide it.',
    land: e => `6 March 2025. The Sun was only ${e}° above the horizon. Athena touched down about 250 m off target, inside a crater, and tipped onto its side.`,
    after: (h, p) => `What happened: the panels got no sunlight and the batteries ran out about ${h} hours after landing. The window itself was good: ${p}% of the next 10 days in sunlight.`,
    ghost: (g, v) => `The grey route, one week late without replanning: only ${g}% sunlight, ${v}. Launch slips are common; replanning is what keeps a mission viable. Try Simulate delay.`,
    verdict: { viable: 'viable', marginal: 'marginal', not: 'not viable' },
    ghostLabel: 'IM-2 one week late · not replanned',
    lost: 'End of the real mission', lostSub: 'Batteries depleted: no sunlight on the panels',
    touch: 'Real mission: in a crater, on its side',
    verdictText: 'Good window · real mission lost in 13 h',
  },
  es: {
    ch: 'Caso real · IM-2 Athena',
    launch: 'Intuitive Machines, 2025: un módulo rumbo a Mons Mouton, a 84,8° S. La ruta gris es la misma misión con una semana de retraso y sin replanificar. (Athena despegó el 26 de febrero por una ruta más larga; nuestra ruta directa sale el 2 de marzo para alunizar el día real.)',
    coast: 'Mismo cohete, mismo módulo: solo cambia la fecha. Una semana después la Luna está en otro lugar, y la luz en Mons Mouton también.',
    orbit: 'A 84,8° S el Sol nunca sube más de unos pocos grados. Una colina baja, o un cráter pequeño, basta para taparlo.',
    land: e => `6 de marzo de 2025. El Sol estaba a solo ${e}° sobre el horizonte. Athena se posó a unos 250 m del objetivo, dentro de un cráter, y quedó de lado.`,
    after: (h, p) => `Lo que pasó: los paneles no recibieron luz y las baterías se agotaron unas ${h} horas después del alunizaje. La ventana era buena: ${p} % de los 10 días siguientes con Sol.`,
    ghost: (g, v) => `La ruta gris, una semana tarde y sin replanificar: solo ${g} % de horas con Sol, ${v}. Los retrasos son habituales; replanificar es lo que mantiene viable una misión. Prueba «Simular retraso».`,
    verdict: { viable: 'viable', marginal: 'marginal', not: 'no viable' },
    ghostLabel: 'IM-2 una semana tarde · sin replanificar',
    lost: 'Fin de la misión real', lostSub: 'Baterías agotadas: sin luz en los paneles',
    touch: 'Misión real: en un cráter, de lado',
    verdictText: 'Buena ventana · misión real perdida en 13 h',
  },
};
export const caseText = lang => T[lang === 'es' ? 'es' : 'en'];

/** Story line while the real case plays: [chapter, text], or null to fall back to the normal story. */
export function caseStory(cs, pl, t, lang) {
  if (!cs || cs.plan !== pl) return null;
  const L = caseText(lang), M = 60000, H = S.HOUR, s = (pl.tLand - t) / 1000;
  if (t < pl.launch + 10 * M) return [L.ch, L.launch];
  if (t < pl.tA - 10 * M) return [L.ch, L.coast];
  if (s > 150) return [L.ch, L.orbit];
  const el = S.sky(pl.tLand, pl.site).sunEl.toFixed(1).replace('.', lang === 'es' ? ',' : '.');
  if (s > -60) return [L.ch, L.land(el)];
  if (t < pl.tLand + IM2.lostAfterH * H) return [L.ch, L.after(IM2.lostAfterH, Math.round(pl.sunPct))];
  return [L.ch, L.ghost(Math.round(cs.ghost.sunPct), L.verdict[cs.ghost.verdict])];
}

/** Extra call-out for the real case. */
export function caseMilestones(cs, pl) {
  if (!cs || cs.plan !== pl) return [];
  return [{ t: pl.tLand + IM2.lostAfterH * S.HOUR, label: 'End of the real mission', sub: 'Batteries depleted: no sunlight on the panels' }];
}
