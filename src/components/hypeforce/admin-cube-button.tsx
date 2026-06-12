import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface AdminCubeButtonProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Small 3D rubik's-cube icon — admin-only shortcut to /pretentious.
 * On click: spins for ~1s, then navigates.
 */
export function AdminCubeButton({
  size = 24,
  className = "",
  title = "Admin",
}: AdminCubeButtonProps) {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    if (spinning) return;
    setSpinning(true);
    window.setTimeout(() => navigate({ to: "/pretentious" }), 1000);
  };

  const half = size / 2;
  const faceStyle = (transform: string, bg: string): React.CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    transform,
    background: bg,
    border: "1px solid rgba(0,0,0,0.6)",
    backgroundSize: "33.34% 33.34%",
    backgroundImage:
      "linear-gradient(to right, rgba(0,0,0,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.55) 1px, transparent 1px)",
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors ${className}`}
      style={{ width: size + 12, height: size + 12, perspective: 120 }}
    >
      <span
        className={spinning ? "admin-cube-spin" : ""}
        style={{
          position: "relative",
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: "rotateX(-25deg) rotateY(-30deg)",
          display: "inline-block",
        }}
      >
        <span style={faceStyle(`translateZ(${half}px)`, "#3b82f6")} />
        <span style={faceStyle(`rotateY(180deg) translateZ(${half}px)`, "#22c55e")} />
        <span style={faceStyle(`rotateY(90deg) translateZ(${half}px)`, "#ef4444")} />
        <span style={faceStyle(`rotateY(-90deg) translateZ(${half}px)`, "#f97316")} />
        <span style={faceStyle(`rotateX(90deg) translateZ(${half}px)`, "#fafafa")} />
        <span style={faceStyle(`rotateX(-90deg) translateZ(${half}px)`, "#facc15")} />
      </span>
    </button>
  );
}
