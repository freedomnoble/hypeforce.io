import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface AdminCubeButtonProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Black line-art isometric Rubik's cube — admin shortcut to /pretentious.
 * Spins ~1s on click then navigates.
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

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors ${className}`}
      style={{ width: size + 12, height: size + 12 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={spinning ? "admin-cube-spin" : ""}
        style={{ transformOrigin: "50% 55%" }}
      >
        {/* Top face (rhombus) */}
        <path d="M32 6 L58 20 L32 34 L6 20 Z" />
        <path d="M19 13 L45 27" />
        <path d="M45 13 L19 27" />
        {/* Left face */}
        <path d="M6 20 L6 46 L32 60 L32 34 Z" />
        <path d="M6 33 L32 47" />
        <path d="M19 27 L19 53" />
        {/* Right face */}
        <path d="M58 20 L58 46 L32 60 L32 34 Z" />
        <path d="M58 33 L32 47" />
        <path d="M45 27 L45 53" />
      </svg>
    </button>
  );
}
