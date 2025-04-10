// src/components/audio/BreathingCircle.js
import React, { useRef, useEffect, useState } from "react";
import styles from '../../styles/components/BreathingCircle.module.css';

const BreathingCircle = () => {
  console.log('[BreathingCircle] Component rendering');
  
  // slider state
  const [inhale, setInhale] = useState(4);
  const [hold, setHold] = useState(2);
  const [exhale, setExhale] = useState(4);

  const canvasRef = useRef(null);
  const startRef = useRef(null);

  // redraw on every animation frame
  useEffect(() => {
    console.log('[BreathingCircle] Setting up animation effect');
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('[BreathingCircle] Canvas not found');
      return;
    }
    
    const ctx = canvas.getContext("2d");

    const ACCENT = "#ffffff";
    const P_MIN = 0.30;   // 30 %
    const P_MAX = 0.90;   // 90 %

    const ease = x => 0.5 * (1 - Math.cos(Math.PI * x));

    // keep canvas square and responsive
    const resize = () => {
      console.log('[BreathingCircle] Resizing canvas');
      if (!canvas.parentElement) return;
      
      const size = Math.min(canvas.parentElement.clientWidth, 280);
      canvas.width = size;
      canvas.height = size;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = ts => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;

      const cycleDur = inhale + hold + exhale;
      const tPhase = elapsed % cycleDur;

      let t; // 0‑1 breathing factor
      if (tPhase < inhale) t = ease(tPhase / inhale);
      else if (tPhase < inhale+hold) t = 1;
      else {
        const tEx = (tPhase - inhale - hold) / exhale;
        t = 1 - ease(tEx);
      }

      const sizeP = P_MIN + (P_MAX - P_MIN) * t;
      const r = sizeP * canvas.width * 0.5;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(frame);
    };
    let animationId = requestAnimationFrame(frame);

    return () => {
      console.log('[BreathingCircle] Cleaning up animation');
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [inhale, hold, exhale]);

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        {inhale}s&nbsp;·&nbsp;{hold}s&nbsp;·&nbsp;{exhale}s
      </div>

      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.controls}>
        <label className={styles.label}>
          Inhale
          <input
            type="range" min="1" max="10" step="0.5"
            value={inhale}
            onChange={e => setInhale(+e.target.value)}
            className={styles.slider}
          />
        </label>

        <label className={styles.label}>
          Hold
          <input
            type="range" min="0" max="10" step="0.5"
            value={hold}
            onChange={e => setHold(+e.target.value)}
            className={styles.slider}
          />
        </label>

        <label className={styles.label}>
          Exhale
          <input
            type="range" min="1" max="10" step="0.5"
            value={exhale}
            onChange={e => setExhale(+e.target.value)}
            className={styles.slider}
          />
        </label>
      </div>
    </div>
  );
};

export default BreathingCircle;