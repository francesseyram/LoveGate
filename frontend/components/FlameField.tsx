"use client";

import { useEffect, useRef } from "react";

/**
 * Live fire for a hero: a wall of flame rising from the bottom edge, smoke
 * curling up off it, and sparks thrown up out of it. Fills its container;
 * give it the whole hero.
 *
 * Two layers, because they want opposite things:
 *
 * - Flame and smoke are a fragment shader (layered, upward-scrolling noise
 *   pushed through a crimson → orange → gold ramp). Neither has hard edges, so
 *   it renders at a fraction of screen resolution and is stretched — nobody
 *   can tell, and it keeps phones cool.
 * - Sparks are points of light, and blurring them would kill them, so they're
 *   a separate full-resolution 2D canvas: a few dozen particles drawn as glowing
 *   additive dots, cooling from white-gold to red as they climb.
 *
 * Deliberately not the drifting embers of `FireBackground`, which Revive wears.
 *
 * With reduced motion: one still frame of flame and smoke, no sparks. Without
 * WebGL: sparks only, over whatever background the parent paints.
 */

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 res;
uniform float t;

// Fraction of the canvas height the flames themselves occupy, from the bottom.
const float FIRE_TOP = 0.72;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;
  float fy = uv.y / FIRE_TOP;            // 0 at the base, 1 at the flame line
  vec2 q = vec2(uv.x * aspect / FIRE_TOP, fy);

  // Two noise layers scrolling upward at different speeds, the second used to
  // warp the first: that warp is what makes tongues instead of fog.
  vec2 warp = vec2(fbm(q * 2.2 + vec2(0.0, -t * 0.55)), fbm(q * 2.2 + vec2(5.2, -t * 0.7)));
  float n = fbm(q * vec2(3.0, 1.6) + warp * 1.4 + vec2(0.0, -t * 0.9));

  // Fire lives at the bottom and thins as it climbs.
  float body = n * 1.35 - fy * 2.1 + 0.12;
  float flame = smoothstep(0.0, 0.6, body);

  // Hot cores only where the noise peaks, so the wall reads as separate
  // tongues with dark gaps between them, not one solid sheet.
  float core = smoothstep(0.55, 0.85, n) * smoothstep(0.15, 0.7, body);

  vec3 crimson = vec3(0.30, 0.02, 0.05);
  vec3 red     = vec3(0.66, 0.06, 0.11);
  vec3 orange  = vec3(0.93, 0.36, 0.12);
  vec3 gold    = vec3(1.00, 0.74, 0.38);

  vec3 fire = mix(crimson, red, smoothstep(0.0, 0.5, flame));
  fire = mix(fire, orange, core * 0.85);
  fire = mix(fire, gold, smoothstep(0.75, 1.0, core) * 0.6);
  float fireA = smoothstep(0.0, 0.3, flame) * 0.92;

  // Smoke: slower, larger, sideways-drifting noise that only shows above the
  // flames. It's lit from below, so it's a warm brown-grey that brightens
  // nearest the fire and fades to nothing as it climbs.
  vec2 sq = vec2(uv.x * aspect, uv.y) * 1.6;
  float s = fbm(sq + warp * 0.8 + vec2(t * 0.04, -t * 0.16));
  float rise = smoothstep(0.25, 0.6, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));
  float smoke = smoothstep(0.42, 0.78, s) * rise;
  float glow = 1.0 - smoothstep(0.35, 0.9, uv.y);
  vec3 smokeCol = mix(vec3(0.16, 0.10, 0.10), vec3(0.42, 0.18, 0.12), glow);
  float smokeA = smoke * 0.42;

  // Flame in front of smoke (premultiplied "over").
  vec3 col = fire * fireA + smokeCol * smokeA * (1.0 - fireA);
  float alpha = fireA + smokeA * (1.0 - fireA);
  gl_FragColor = vec4(col, alpha);
}
`;

/** Fraction of device pixels the shader actually shades. */
const RENDER_SCALE = 0.35;

/** Where sparks are born: the top band of the flames, as a fraction of height. */
const SPARK_BIRTH_TOP = 0.55;
const SPARK_BIRTH_BOTTOM = 0.92;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  sway: number;
  phase: number;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** Sets up the flame/smoke shader. Returns a draw function and a cleanup, or null without WebGL. */
function startFlames(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "res");
  const uTime = gl.getUniformLocation(program, "t");

  return {
    resize(width: number, height: number) {
      const scale = (window.devicePixelRatio || 1) * RENDER_SCALE;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    },
    draw(seconds: number) {
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // Free what this run created, but leave the context alive: a canvas hands
    // back the same context to the next getContext call, so a re-run of the
    // effect (Strict Mode, Fast Refresh) would inherit a dead one and paint
    // the hero white.
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

/** Sets up the spark layer. */
function startSparks(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let sparks: Spark[] = [];
  let target = 0;
  let nextBurst = 2 + Math.random() * 3;

  const spawn = (x?: number, y?: number, hot = false): Spark => {
    const life = 1.6 + Math.random() * 2.6;
    return {
      x: x ?? Math.random() * width,
      y: y ?? height * (SPARK_BIRTH_TOP + Math.random() * (SPARK_BIRTH_BOTTOM - SPARK_BIRTH_TOP)),
      vx: (Math.random() - 0.5) * (hot ? 90 : 30),
      vy: -(hot ? 160 + Math.random() * 220 : 70 + Math.random() * 150),
      age: 0,
      life,
      size: 0.7 + Math.random() * (hot ? 2 : 1.5),
      sway: 10 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
    };
  };

  return {
    resize(w: number, h: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      target = Math.min(110, Math.round(w / 14));
      sparks = Array.from({ length: target }, () => {
        const spark = spawn();
        spark.age = Math.random() * spark.life; // start mid-flight, not all at once
        return spark;
      });
    },
    step(dt: number, seconds: number) {
      // Every few seconds a log shifts: a burst of fast, hot sparks from one spot.
      if (seconds > nextBurst) {
        const bx = width * (0.15 + Math.random() * 0.7);
        const by = height * (0.7 + Math.random() * 0.15);
        for (let i = 0; i < 18; i++) sparks.push(spawn(bx + (Math.random() - 0.5) * 60, by, true));
        nextBurst = seconds + 3 + Math.random() * 4;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const survivors: Spark[] = [];
      for (const spark of sparks) {
        spark.age += dt;
        if (spark.age >= spark.life || spark.y < -20) {
          // After a burst there are more sparks than the steady target; let
          // the extras die out rather than replacing them.
          if (sparks.length > target) continue;
          survivors.push(spawn());
          continue;
        }
        const k = spark.age / spark.life;
        // Rising heat slows them down; the sway is the air they're riding.
        spark.vy *= 1 - 0.35 * dt;
        const swayX = Math.sin(seconds * 2.2 + spark.phase) * spark.sway * dt;
        spark.x += spark.vx * dt + swayX;
        spark.y += spark.vy * dt;

        // Cools from white-gold to orange to deep red, and dims as it dies.
        const r = 255;
        const g = Math.round(225 - 170 * k);
        const b = Math.round(150 - 130 * Math.min(1, k * 1.6));
        const flicker = 0.75 + 0.25 * Math.sin(seconds * 30 + spark.phase * 7);
        const alpha = (1 - k) * (k < 0.08 ? k / 0.08 : 1) * flicker;

        // A bright dot with a wide, soft glow that fades out to nothing, so
        // it has no visible edge.
        const glowR = spark.size * 8;
        const glow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, glowR);
        glow.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.6).toFixed(3)})`);
        glow.addColorStop(0.3, `rgba(${r},${Math.round(g * 0.6)},40,${(alpha * 0.27).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${r},${Math.round(g * 0.4)},20,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();

        survivors.push(spark);
      }
      sparks = survivors;
    },
  };
}

export function FlameField({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const flameCanvas = flameRef.current;
    const sparkCanvas = sparkRef.current;
    if (!wrap || !flameCanvas || !sparkCanvas) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flames = startFlames(flameCanvas);
    const sparks = still ? null : startSparks(sparkCanvas);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      flames?.resize(rect.width, rect.height);
      sparks?.resize(rect.width, rect.height);
      if (still) flames?.draw(4.0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    let frame = 0;
    let visible = true;
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!still) {
      const start = performance.now();
      let last = start;
      const loop = (now: number) => {
        // Clamp dt so a backgrounded tab doesn't come back to one giant step.
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (visible) {
          const seconds = (now - start) / 1000;
          flames?.draw(seconds);
          sparks?.step(dt, seconds);
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      flames?.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className={`pointer-events-none ${className}`}>
      <canvas ref={flameRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={sparkRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
