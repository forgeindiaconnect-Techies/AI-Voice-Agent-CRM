import { useEffect, useRef } from "react";

interface GalaxyBackground3DProps {
  darkMode?: boolean;
}

export default function GalaxyBackground3D({ darkMode = false }: GalaxyBackground3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse parallax positions
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX - width / 2) * 0.0008;
      targetMouseY = (e.clientY - height / 2) * 0.0008;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    // ── 3D Starfield & Particle Engine ──
    const NUM_STARS = darkMode ? 650 : 320;
    const STARS: {
      x: number;
      y: number;
      z: number;
      size: number;
      color: string;
      alpha: number;
      twinkleSpeed: number;
      glow: boolean;
    }[] = [];

    // Colors: Forge Royal Blue (#2563EB / #60A5FA), Forge Gold (#F4B400 / #FFD54A), Luminous White
    const colorsDark = ["#3B82F6", "#60A5FA", "#2563EB", "#F4B400", "#FFD54A", "#FFFFFF", "#93C5FD"];
    const colorsLight = ["#2563EB", "#3B82F6", "#F4B400", "#93C5FD"];

    for (let i = 0; i < NUM_STARS; i++) {
      const isGold = Math.random() < 0.35;
      const isBlue = Math.random() < 0.45;
      const colorArr = darkMode ? colorsDark : colorsLight;

      STARS.push({
        x: (Math.random() - 0.5) * 2400,
        y: (Math.random() - 0.5) * 2400,
        z: Math.random() * 1000 + 1,
        size: Math.random() * 2.6 + 0.8,
        color: isGold ? "#F4B400" : isBlue ? "#3B82F6" : colorArr[Math.floor(Math.random() * colorArr.length)],
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        glow: Math.random() < 0.25,
      });
    }

    // ── Floating 3D Nebula Orbs ──
    const NEBULAE = [
      { x: -350, y: -220, z: 450, radius: 480, color: "#1D4ED8", alpha: darkMode ? 0.16 : 0.04 },
      { x: 420, y: 180, z: 520, radius: 420, color: "#F4B400", alpha: darkMode ? 0.12 : 0.03 },
      { x: 50, y: 380, z: 320, radius: 520, color: "#2563EB", alpha: darkMode ? 0.14 : 0.03 },
    ];

    // ── Holographic Orbit Rings ──
    const ORBIT_RINGS = [
      { rx: 340, ry: 120, rot: 0.25, color: "#2563EB", speed: 0.0003 },
      { rx: 520, ry: 190, rot: -0.4, color: "#F4B400", speed: -0.0002 },
    ];

    // ── Shooting Stars ──
    let shootingStar: {
      x: number;
      y: number;
      dx: number;
      dy: number;
      length: number;
      life: number;
      maxLife: number;
      color: string;
    } | null = null;

    const spawnShootingStar = () => {
      shootingStar = {
        x: Math.random() * width * 0.75,
        y: Math.random() * height * 0.35,
        dx: Math.random() * 9 + 7,
        dy: Math.random() * 5 + 3,
        length: Math.random() * 90 + 70,
        life: 0,
        maxLife: Math.random() * 45 + 30,
        color: Math.random() < 0.5 ? "#F4B400" : "#60A5FA",
      };
    };

    let shootingStarTimer = 0;
    let rotationAngle = 0;

    // ── Render Loop ──
    const render = () => {
      // Lerp mouse parallax
      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      rotationAngle += 0.0004;

      ctx.clearRect(0, 0, width, height);

      // Deep space gradient background (#050816 → #0B1220 → #132238)
      if (darkMode) {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#050816");
        bgGrad.addColorStop(0.5, "#0B1220");
        bgGrad.addColorStop(1, "#132238");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#F8FAFC");
        bgGrad.addColorStop(0.5, "#EEF5FF");
        bgGrad.addColorStop(1, "#F8FAFC");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      const fov = 420;

      // ── Render Volumetric Light Shafts ──
      ctx.save();
      ctx.globalAlpha = darkMode ? 0.03 : 0.015;
      const lightGrad = ctx.createLinearGradient(width * 0.7, 0, width * 0.3, height);
      lightGrad.addColorStop(0, "#3B82F6");
      lightGrad.addColorStop(0.5, "#F4B400");
      lightGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(width * 0.5, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width * 0.6, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ── Render 3D Rotating Nebula Clouds ──
      NEBULAE.forEach((neb, idx) => {
        const angleOffset = idx * 2.1;
        const cosN = Math.cos(rotationAngle * 0.5 + angleOffset);
        const sinN = Math.sin(rotationAngle * 0.5 + angleOffset);

        const nx = (neb.x * cosN - neb.y * sinN) + mouseX * width * 0.8;
        const ny = (neb.x * sinN + neb.y * cosN) + mouseY * height * 0.8;
        const nk = fov / (neb.z + fov);
        const npx = nx * nk + width / 2;
        const npy = ny * nk + height / 2;
        const nr = neb.radius * nk;

        ctx.save();
        const radGrad = ctx.createRadialGradient(npx, npy, 0, npx, npy, nr);
        radGrad.addColorStop(0, neb.color);
        radGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.globalAlpha = neb.alpha;
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(npx, npy, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Render 3D Holographic Orbit Rings ──
      ORBIT_RINGS.forEach((ring, idx) => {
        ctx.save();
        ctx.globalAlpha = darkMode ? 0.05 : 0.02;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([8, 12]);

        const cx = width / 2 + mouseX * 60 * (idx + 1);
        const cy = height / 2 + mouseY * 60 * (idx + 1);

        ctx.translate(cx, cy);
        ctx.rotate(ring.rot + rotationAngle * (idx === 0 ? 1 : -1));
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting Planet Sphere on ring
        const planetAngle = rotationAngle * (idx === 0 ? 2 : -1.5);
        const px = Math.cos(planetAngle) * ring.rx;
        const py = Math.sin(planetAngle) * ring.ry;

        ctx.fillStyle = ring.color;
        ctx.globalAlpha = darkMode ? 0.35 : 0.15;
        ctx.shadowBlur = 12;
        ctx.shadowColor = ring.color;
        ctx.beginPath();
        ctx.arc(px, py, idx === 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // ── Render 3D Starfield ──
      for (let i = 0; i < STARS.length; i++) {
        const s = STARS[i];

        // Z-depth slow drift
        s.z -= 0.35;
        if (s.z <= 1) {
          s.z = 1000;
          s.x = (Math.random() - 0.5) * 2400;
          s.y = (Math.random() - 0.5) * 2400;
        }

        // 3D rotation
        const cosA = Math.cos(rotationAngle + mouseX);
        const sinA = Math.sin(rotationAngle + mouseX);
        const rx = s.x * cosA - s.y * sinA;
        const ry = s.x * sinA + s.y * cosA;

        const k = fov / (s.z + fov);
        const px = rx * k + width / 2 + mouseX * width * 0.4;
        const py = ry * k + height / 2 + mouseY * height * 0.4;

        if (px < -30 || px > width + 30 || py < -30 || py > height + 30) continue;

        // Twinkle speed animation
        s.alpha += s.twinkleSpeed;
        if (s.alpha > 1.0 || s.alpha < 0.25) {
          s.twinkleSpeed = -s.twinkleSpeed;
        }

        const size = s.size * k * 1.6;
        const alphaMultiplier = darkMode ? 0.35 : 0.08;
        const finalAlpha = Math.min(1, Math.max(0.1, s.alpha * alphaMultiplier * 2.5));

        ctx.save();
        ctx.globalAlpha = finalAlpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.9, size), 0, Math.PI * 2);
        ctx.fill();

        // 3D Glowing halos for key stars
        if (s.glow || s.size > 2.0) {
          ctx.shadowBlur = 14;
          ctx.shadowColor = s.color;
          ctx.beginPath();
          ctx.arc(px, py, size * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Constellation Line Network ──
      ctx.save();
      ctx.globalAlpha = darkMode ? 0.08 : 0.02;
      ctx.lineWidth = 1.0;
      const step = 6;
      for (let i = 0; i < STARS.length; i += step) {
        const s1 = STARS[i];
        const k1 = fov / (s1.z + fov);
        const p1x = s1.x * k1 + width / 2 + mouseX * width * 0.4;
        const p1y = s1.y * k1 + height / 2 + mouseY * height * 0.4;

        for (let j = i + step; j < STARS.length; j += step * 2) {
          const s2 = STARS[j];
          const k2 = fov / (s2.z + fov);
          const p2x = s2.x * k2 + width / 2 + mouseX * width * 0.4;
          const p2y = s2.y * k2 + height / 2 + mouseY * height * 0.4;

          const dist = Math.hypot(p1x - p2x, p1y - p2y);
          if (dist < 125) {
            const lineGrad = ctx.createLinearGradient(p1x, p1y, p2x, p2y);
            lineGrad.addColorStop(0, s1.color);
            lineGrad.addColorStop(1, s2.color);
            ctx.strokeStyle = lineGrad;
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // ── Dynamic Shooting Stars (Every 20-30s) ──
      shootingStarTimer++;
      if (!shootingStar && shootingStarTimer > 220 && Math.random() < 0.04) {
        spawnShootingStar();
        shootingStarTimer = 0;
      }

      if (shootingStar) {
        shootingStar.x += shootingStar.dx;
        shootingStar.y += shootingStar.dy;
        shootingStar.life++;

        const progress = shootingStar.life / shootingStar.maxLife;
        const opacity = Math.sin(progress * Math.PI) * (darkMode ? 0.75 : 0.3);

        ctx.save();
        ctx.globalAlpha = opacity;
        const tailGrad = ctx.createLinearGradient(
          shootingStar.x,
          shootingStar.y,
          shootingStar.x - shootingStar.dx * 14,
          shootingStar.y - shootingStar.dy * 14
        );
        tailGrad.addColorStop(0, shootingStar.color);
        tailGrad.addColorStop(0.5, "#FFFFFF");
        tailGrad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(
          shootingStar.x - shootingStar.dx * 14,
          shootingStar.y - shootingStar.dy * 14
        );
        ctx.stroke();
        ctx.restore();

        if (shootingStar.life >= shootingStar.maxLife) {
          shootingStar = null;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 select-none transition-opacity duration-700"
      style={{ willChange: "transform, opacity" }}
    />
  );
}
