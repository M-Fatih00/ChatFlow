import type { CSSProperties, ReactNode } from "react";

export type AnimationType =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "slide-left"
  | "slide-right"
  | "scale"
  | "pop";

interface AnimateProps {
  type?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function Animate({
  type = "fade-up",
  delay = 0,
  duration,
  className = "",
  style,
  children,
}: AnimateProps) {
  return (
    <div
      className={`anim anim-${type} ${className}`.trim()}
      style={{
        animationDelay: delay ? `${delay}ms` : undefined,
        animationDuration: duration ? `${duration}ms` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}