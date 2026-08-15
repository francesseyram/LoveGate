"use client";

import { useEffect, useRef } from "react";

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  colorIndex: number;
  phase: number;
  freq: number;
}

// Warm palette matching the hero gradient — ember orange, gold, coral-red.
const COLORS: Array<[number, number, number]> = [
  [230, 120, 60],
  [217, 164, 65],
  [200, 70, 60],
];

function spawnEmber(width: number, height: number, atBottom: boolean): Ember {
  return {
    x: Math.random() * width,
    y: atBottom ? height + Math.random() * 40 : Math.random() * height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.25 + Math.random() * 0.6),
    radius: 1 + Math.random() * 2.6,
    baseAlpha: 0.35 + Math.random() * 0.45,
    colorIndex: Math.floor(Math.random() * COLORS.length),
    phase: Math.random() * Math.PI * 2,
    freq: 0.015 + Math.random() * 0.025,
  };
}

/**
 * Rising embers for the Revive hero — small glowing points drifting upward
 * and flickering, suggesting heat/fire without drawing literal flame shapes.
 * Canvas rather than CSS/SVG since it's a generative, continuously-animated
 * particle field. Skipped entirely under prefers-reduced-motion.
 */
export function FireBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let embers: Ember[] = [];
    let frame = 0;
    let raf = 0;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(24, Math.min(70, Math.round((width * height) / 16000)));
      embers = Array.from({ length: count }, () => spawnEmber(width, height, false));
    }

    function tick() {
      frame++;
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.x += e.vx + Math.sin(frame * e.freq + e.phase) * 0.15;
        e.y += e.vy;

        const fadeIn = e.y > height - 50 ? (height - e.y) / 50 : 1;
        const fadeOut = e.y < 60 ? e.y / 60 : 1;
        const flicker = 0.7 + 0.3 * Math.sin(frame * e.freq * 2.2 + e.phase);
        const alpha = Math.max(0, e.baseAlpha * Math.min(fadeIn, fadeOut) * flicker);

        if (e.y < -10) {
          embers[i] = spawnEmber(width, height, true);
          continue;
        }

        const [r, g, b] = COLORS[e.colorIndex];
        ctx!.beginPath();
        ctx!.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.shadowColor = `rgba(${r},${g},${b},${Math.min(1, alpha * 1.5)})`;
        ctx!.shadowBlur = e.radius * 4;
        ctx!.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
