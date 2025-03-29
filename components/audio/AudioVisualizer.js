import React, { useEffect, useRef, useMemo } from 'react';
import AudioContext, { LAYERS } from '../../contexts/AudioContext';

const AudioVisualizer = () => {
  const canvasRef = useRef(null);
  const { audioCore } = React.useContext(AudioContext);

  const frequencyRanges = useMemo(() => ({
    [LAYERS.DRONE]: [20, 150],
    [LAYERS.MELODY]: [150, 1000],
    [LAYERS.RHYTHM]: [1000, 8000],
    [LAYERS.NATURE]: [8000, 20000]
  }), []);

  useEffect(() => {
    if (!audioCore || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = audioCore.audioContext.createAnalyser();
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      Object.entries(frequencyRanges).forEach(([layer, range], index) => {
        const [minFreq, maxFreq] = range;
        const barWidth = canvas.width / Object.keys(frequencyRanges).length;
        const barHeight = dataArray.slice(minFreq, maxFreq).reduce((a, b) => a + b, 0) / (maxFreq - minFreq);

        ctx.fillStyle = `rgba(${index * 50}, ${255 - index * 50}, 150, 0.8)`;
        ctx.fillRect(index * barWidth, canvas.height - barHeight, barWidth, barHeight);
      });

      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      analyser.disconnect();
    };
  }, [audioCore, frequencyRanges]);

  return <canvas ref={canvasRef} width="800" height="400" />;
};

export default AudioVisualizer;