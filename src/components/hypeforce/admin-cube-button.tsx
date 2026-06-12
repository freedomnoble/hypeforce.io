import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface AdminCubeButtonProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Small animated rubik's cube icon — admin-only shortcut to /pretentious.
 * On click: spins for ~1s, then navigates.
 */
export function AdminCubeButton({ size = 28, className = "", title = "Admin" }: AdminCubeButtonProps) {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    if (spinning) return;
    setSpinning(true);
    window.setTimeout(() => {
      navigate({ to: "/pretentious" });
    }, 1000);
  };

  // 3x3 rubik's-cube face colors (top, right, front shown via isometric projection)
  const top = ["#fde047", "#fde047", "#fde047", "#fde047", "#fde047", "#fde047", "#fde047", "#fde047", "#fde047"];
  const right = ["#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444"];
  const front = ["#3b82f6", "#22c55e", "#ffffff", "#22c55e", "#3b82f6", "#22c55e", "#ffffff", "#3b82f6", "#22c55e"];

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors ${className}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      <div
        className={spinning ? "cube-spin" : ""}
        style={{
          width: size,
          height: size,
          display: "inline-block",
          transformStyle: "preserve-3d",
        }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size}>
          {/* Top face */}
          <g>
            {top.map((c, i) => {
              const col = i % 3;
              const row = Math.floor(i / 3);
              const x0 = 12 + col * 12;
              const y0 = 6 + row * 7;
              return (
                <polygon
                  key={`t${i}`}
                  points={`${x0},${y0} ${x0 + 12},${y0} ${x0 + 12 - 12},${y0 + 7} ${x0 - 12},${y0 + 7}`}
                  fill={c}
                  stroke="#0a0a0a"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  transform={`translate(${col * 0},0)`}
                />
              );
            })}
          </g>
          {/* Simpler isometric: draw three rhombus grids */}
        </svg>
      </div>

      {/* fallback simpler cube via CSS — actually use this instead of the above SVG attempt */}
    </button>
  );
}
