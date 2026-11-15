// Cinematic layer: launch countdown, liftoff flash, letterbox bars and milestone call-outs.
const STATUS = n => n > 6 ? 'Go for launch' : n > 3 ? 'Internal power' : n === 3 ? 'Ignition sequence start' : n > 0 ? 'Main engine start' : 'Liftoff';

export default function Cinematic({ countdown, toast, flashKey, dipKey, letterbox, onSkip, reduce }) {
  const cd = countdown != null, n = cd ? countdown : 0;
  return (
    <>
      {/* letterbox */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '9vh', background: '#000', transform: `translateY(${letterbox ? 0 : -101}%)`, transition: reduce ? 'none' : 'transform .9s cubic-bezier(.2,.7,.2,1)', zIndex: 7, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '9vh', background: '#000', transform: `translateY(${letterbox ? 0 : 101}%)`, transition: reduce ? 'none' : 'transform .9s cubic-bezier(.2,.7,.2,1)', zIndex: 7, pointerEvents: 'none' }} />

      {/* countdown */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, pointerEvents: cd ? 'auto' : 'none', opacity: cd ? 1 : 0, transition: 'opacity .6s', zIndex: 8, background: cd ? 'radial-gradient(ellipse at center, rgba(0,0,0,.15), rgba(0,0,0,.55))' : 'none' }}>
        {cd && (
          <>
            <div style={{ fontSize: 13, letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(243,241,236,.7)' }}>Launch countdown</div>
            <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
                <circle key={n} cx="110" cy="110" r="100" fill="none" stroke={n <= 3 ? '#E8B95A' : '#F3F1EC'} strokeWidth="2.5" strokeDasharray="628.3" strokeLinecap="round" style={{ animation: reduce ? 'none' : 'lnring 1s linear forwards' }} />
              </svg>
              <div key={'n' + n} style={{ display: 'flex', alignItems: 'baseline', gap: 6, animation: reduce ? 'none' : 'lnpop .5s cubic-bezier(.2,.9,.3,1.3)' }}>
                <span style={{ fontSize: 28, fontWeight: 300, color: 'rgba(243,241,236,.6)' }}>T−</span>
                <span style={{ fontSize: 120, fontWeight: 200, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: n <= 3 ? '#E8B95A' : '#F3F1EC', textShadow: '0 0 40px rgba(0,0,0,.6)' }}>{n}</span>
              </div>
            </div>
            <div key={'s' + STATUS(n)} style={{ fontSize: 18, animation: reduce ? 'none' : 'lnrise .5s ease-out' }}>{STATUS(n)}</div>
            <button onClick={onSkip} style={{ marginTop: 10, background: 'rgba(12,13,15,.6)', border: '1px solid rgba(255,255,255,.25)', color: '#F3F1EC', borderRadius: 999, padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} className="cin-skip">Skip countdown</button>
          </>
        )}
      </div>

      {/* liftoff flash */}
      {flashKey ? <div key={flashKey} style={{ position: 'absolute', inset: 0, background: '#fff6e6', pointerEvents: 'none', zIndex: 8, animation: reduce ? 'none' : 'lnflash 1.1s ease-out forwards', opacity: 0 }} /> : null}

      {/* dip to black: hides the cut from the onboard camera to the ground camera */}
      {dipKey && !reduce ? <div key={"d" + dipKey} style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", zIndex: 6, animation: "lndip .75s ease-in-out forwards", opacity: 0 }} /> : null}

      {/* milestone call-out */}
      {toast ? (
        <div key={toast.id} style={{ position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: reduce ? 'none' : 'lntoast 3.2s cubic-bezier(.2,.7,.2,1) forwards', textShadow: '0 0 16px #000, 0 0 6px #000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E8B95A' }}>
            <span style={{ width: 28, height: 1, background: '#E8B95A' }} />{toast.time}<span style={{ width: 28, height: 1, background: '#E8B95A' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-.01em' }}>{toast.label}</div>
          {toast.sub ? <div style={{ fontSize: 14, color: 'rgba(243,241,236,.75)' }}>{toast.sub}</div> : null}
        </div>
      ) : null}
    </>
  );
}
