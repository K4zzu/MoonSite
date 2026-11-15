// Inline style strings from the design -> React style objects (cached per string).
const cache = new Map();
const camel = p => p.startsWith('--') ? p : p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export function css(str) {
  let o = cache.get(str);
  if (o) return o;
  o = {};
  for (const decl of str.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim(), val = decl.slice(i + 1).trim();
    if (k) o[camel(k)] = val;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(str, o);
  return o;
}
export const asset = name => import.meta.env.BASE_URL + name;
