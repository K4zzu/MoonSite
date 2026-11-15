// Operational windows during the surface stay (sunlight, Earth link, both), with power estimate and report export.
// Tap a window to jump the mission clock to its start.
import { useEffect, useMemo, useState } from 'react';
import LunarSim from '../lib/sim.js';
import { reportCSV, download, openPrintableReport } from '../lib/report.js';

const TXT = 'rgba(243,241,236,.62)', COL = { sun: '#E8B95A', link: '#6FA8F5', both: '#F3F1EC' };
const fmt = t => new Date(t).toLocaleString(LunarSim.locale || 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
const dur = h => h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} d`;
const btn = { background: 'none', border: '1px solid rgba(255,255,255,.25)', color: '#F3F1EC', borderRadius: 999, padding: '7px 13px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };

export default function WindowsPanel({ plan, getTime, onJump, lang }) {
  const w = useMemo(() => LunarSim.windows(plan), [plan]);
  const [t, setT] = useState(getTime());
  const [tab, setTab] = useState('sun');
  useEffect(() => { const id = setInterval(() => setT(getTime()), 400); return () => clearInterval(id); }, [getTime]);
  const list = w[tab], total = list.reduce((a, x) => a + x.hours, 0);
  const tabs = [['sun', 'Sunlight'], ['link', 'Earth link'], ['both', 'Both']];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-lang={lang}>
      <div style={{ fontSize: 12, color: TXT }}>Operational windows</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="ws-tab" style={{ ...btn, padding: '5px 11px', borderColor: tab === k ? COL[k] : 'rgba(255,255,255,.18)', color: tab === k ? COL[k] : '#F3F1EC', background: tab === k ? 'rgba(255,255,255,.06)' : 'none' }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 190, overflow: 'auto' }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: TXT, padding: '8px 0' }}>None during the surface stay.</div>}
        {list.map((x, i) => {
          const now = t >= x.start && t < x.end, k = now ? (t - x.start) / (x.end - x.start) : 0;
          return (
            <button key={i} onClick={() => onJump(x.start)} className="ws-row" title="Jump to the start of this window"
              style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center', background: now ? 'rgba(255,255,255,.07)' : 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', color: '#F3F1EC', padding: '8px 4px', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontVariantNumeric: 'tabular-nums', overflow: 'hidden' }}>
              {now && <span style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${k * 100}%`, background: COL[tab], transition: 'width .4s linear' }} />}
              <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: COL[tab], boxShadow: now ? `0 0 10px ${COL[tab]}` : 'none' }} />
              <span style={{ flex: 1 }}>{fmt(x.start)} → {fmt(x.end)}</span>
              <span style={{ color: TXT }}>{dur(x.hours)}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TXT, fontVariantNumeric: 'tabular-nums' }}>
        <span>{`${list.length} windows · ${dur(total)} total`}</span>
        <span>{`Power ≈ ${Math.round(w.powerW)} W · ${(w.energyWhDay / 1000).toFixed(1)} kWh/day`}</span>
      </div>
      <div style={{ fontSize: 11, color: TXT }}>1 m² vertical sun-tracking panel, 30 % efficient, averaged over the stay.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn} className="ws-btn" onClick={() => openPrintableReport(plan)}>Mission report (PDF)</button>
        <button style={btn} className="ws-btn" onClick={() => download(`moonsite-${plan.site.id}-${new Date(plan.launch).toISOString().slice(0, 10)}.csv`, reportCSV(plan), 'text/csv')}>Windows (CSV)</button>
      </div>
    </div>
  );
}
