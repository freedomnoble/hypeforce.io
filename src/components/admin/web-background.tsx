import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Edge {
  a: number;
  b: number;
}
interface Wick {
  edge: Edge;
  t: number; // 0..1
  speed: number;
  hue: number;
}

/**
 * Dark spider-web canvas with random light wicks travelling along edges.
 * Respects prefers-reduced-motion.
 */
export function WebBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let wicks: Wick[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWeb();
    };

    const buildWeb = () => {
      nodes = [];
      edges = [];
      const count = Math.max(60, Math.min(220, Math.floor((w * h) / 14000)));
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.04,
        });
      }
      // Connect each node to its 2-3 nearest neighbors
      for (let i = 0; i < nodes.length; i++) {
        const dists: { j: number; d: number }[] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          dists.push({ j, d: dx * dx + dy * dy });
        }
        dists.sort((a, b) => a.d - b.d);
        const k = 2 + Math.floor(Math.random() * 2);
        for (let n = 0; n < k && n < dists.length; n++) {
          const a = i;
          const b = dists[n].j;
          if (a < b) edges.push({ a, b });
        }
      }
    };

    const spawnWick = () => {
      if (edges.length === 0) return;
      const edge = edges[Math.floor(Math.random() * edges.length)];
      wicks.push({
        edge,
        t: 0,
        speed: 0.6 + Math.random() * 1.4, // per second
        hue: Math.random() < 0.5 ? 220 : 285,
      });
    };

    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // gentle drift
      if (!reduced) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }

      // background
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
      grad.addColorStop(0, "rgba(20, 22, 40, 1)");
      grad.addColorStop(1, "rgba(2, 3, 8, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // edges
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(140, 160, 220, 0.10)";
      ctx.beginPath();
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      // nodes
      ctx.fillStyle = "rgba(180, 200, 255, 0.25)";
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // wicks
      if (!reduced) {
        acc += dt;
        if (acc > 0.6 && Math.random() < 0.55) {
          spawnWick();
          acc = 0;
        }
      }
      const remaining: Wick[] = [];
      for (const w of wicks) {
        w.t += dt * w.speed;
        if (w.t >= 1) continue;
        const a = nodes[w.edge.a];
        const b = nodes[w.edge.b];
        const x = a.x + (b.x - a.x) * w.t;
        const y = a.y + (b.y - a.y) * w.t;
        const r = 18;
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
        g2.addColorStop(0, `hsla(${w.hue}, 90%, 75%, 0.9)`);
        g2.addColorStop(0.4, `hsla(${w.hue}, 90%, 65%, 0.35)`);
        g2.addColorStop(1, `hsla(${w.hue}, 90%, 65%, 0)`);
        ctx.fillStyle = g2;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        // bright dot
        ctx.fillStyle = `hsla(${w.hue}, 100%, 90%, 1)`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
        remaining.push(w);
      }
      wicks = remaining;

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
      aria-hidden
    />
  );
}
