import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useInView } from "framer-motion";

type Direction = "up" | "down" | "left" | "right";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  as?: keyof typeof motion;
  delay?: number;
  duration?: number;
  distance?: number;
  direction?: Direction;
  once?: boolean;
  amount?: number;
  blur?: boolean;
};

const ScrollReveal = ({
  children,
  className = "",
  as = "div",
  delay = 0,
  duration = 0.6,
  distance = 24,
  direction = "up",
  once = true,
  amount = 0.2,
  blur = true
}: ScrollRevealProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once, amount });

  const x = direction === "left" ? -distance : direction === "right" ? distance : 0;
  const y = direction === "up" ? distance : direction === "down" ? -distance : 0;

  const MotionTag = motion[as as keyof typeof motion] as React.ElementType;

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, x, y, filter: blur ? "blur(6px)" : "blur(0px)" }}
      animate={inView ? { opacity: 1, x: 0, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
};

export default ScrollReveal;
