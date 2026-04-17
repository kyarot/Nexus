import { useEffect, useRef, useState } from "react";
import ScrollReveal from "@/components/ui/ScrollReveal";

const stats = [
  { value: "12", label: "Languages supported" },
  { value: "14", label: "Integrated features" },
  { value: "2KB", label: "Per field report" },
  { value: "0", label: "Internet needed for IVR" },
];

const parseValue = (value: string) => {
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)(.*)$/);
  if (!match) {
    return { number: 0, suffix: value, decimals: 0 };
  }

  const numericPart = match[1];
  const suffix = match[2] ?? "";
  const decimals = numericPart.includes(".") ? numericPart.split(".")[1]?.length ?? 0 : 0;

  return { number: Number.parseFloat(numericPart), suffix, decimals };
};

const CountUpNumber = ({ value, duration = 1200 }: { value: string; duration?: number }) => {
  const [{ number, suffix, decimals }] = useState(() => parseValue(value));
  const [display, setDisplay] = useState(() => `0${suffix}`);
  const ref = useRef<HTMLSpanElement | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const startAnimation = () => {
      if (hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;

      const start = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = easeOutCubic(progress);
        const current = number * eased;
        const formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
        setDisplay(`${formatted}${suffix}`);

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [number, suffix, decimals, duration]);

  return <span ref={ref}>{display}</span>;
};

export function ImpactNumbers() {
  return (
    <section id="impact" className="py-24 px-page bg-background">
      <div className="max-w-content mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <ScrollReveal
              key={stat.label}
              as="div"
              className="rounded-card bg-primary-light/50 border border-border p-8 text-center"
              delay={0.05 + index * 0.05}
            >
              <p className="text-4xl md:text-5xl font-extrabold font-mono text-gradient mb-2">
                <CountUpNumber value={stat.value} />
              </p>
              <p className="text-sm text-text-secondary font-medium">{stat.label}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
