import { useRef, useEffect, useState } from "react";
import '../../styles/components/BreathingCircle.module.css';

export default function BreathingCircle() {
  // slider state
  const [inhale,  setInhale]  = useState(4);
  const [hold,    setHold]    = useState(2);
  const [exhale,  setExhale]  = useState(4);

  const canvasRef = useRef(null);
  const startRef  = useRef(null);

  // redraw on every animation frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    const ACCENT = "#ffffff";
    const P_MIN  = 0.30;   // 30 %
    const P_MAX  = 0.90;   // 90 %

    const ease = x => 0.5 * (1 - Math.cos(Math.PI * x));

    // keep canvas square and responsive
    const resize = () => {
      const size = Math.min(canvas.parentElement.clientWidth, 400);
      canvas.width  = size;
      canvas.height = size;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = ts => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;

      const cycleDur = inhale + hold + exhale;
      const tPhase   = elapsed % cycleDur;

      let t; // 0‑1 breathing factor
      if (tPhase < inhale)          t = ease(tPhase / inhale);
      else if (tPhase < inhale+hold) t = 1;
      else {
        const tEx = (tPhase - inhale - hold) / exhale;
        t = 1 - ease(tEx);
      }

      const sizeP = P_MIN + (P_MAX - P_MIN) * t;
      const r  = sizeP * canvas.width * 0.5;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      requestAnimationFrame(frame);
    };
    const id = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
    };
  }, [inhale, hold, exhale]);

  return (
    <div className="enso-panel">
      <div className="enso-info">
        INHALE&nbsp;{inhale}s&nbsp;·&nbsp;HOLD&nbsp;{hold}s&nbsp;·&nbsp;EXHALE&nbsp;{exhale}s
      </div>

      <canvas ref={canvasRef} />

      <div className="enso-controls">
        <label>
          Inhale&nbsp;(s)
          <input
            type="range" min="1" max="10" step="0.5"
            value={inhale}
            onChange={e => setInhale(+e.target.value)}
          />
        </label>

        <label>
          Hold&nbsp;(s)
          <input
            type="range" min="0" max="10" step="0.5"
            value={hold}
            onChange={e => setHold(+e.target.value)}
          />
        </label>

        <label>
          Exhale&nbsp;(s)
          <input
            type="range" min="1" max="10" step="0.5"
            value={exhale}
            onChange={e => setExhale(+e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
