import ScrollReveal from "@/components/ui/ScrollReveal";
import { Camera, Sparkles, MapPin } from "lucide-react";

const steps = [
  {
    num: 1,
    icon: Camera,
    title: "Scan paper survey",
    description: "Field worker photographs the paper survey. OCR extracts structured data in seconds.",
  },
  {
    num: 2,
    icon: Sparkles,
    title: "Gemini synthesizes insights",
    description: "500 reports from 12 NGOs become 5 actionable insights — automatically, every hour.",
  },
  {
    num: 3,
    icon: MapPin,
    title: "Right volunteer dispatched",
    description: "DNA-matched volunteer receives an empathy brief and navigates to the family in need.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-page bg-gradient-to-b from-background via-background to-primary-light/30">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-16">
          <ScrollReveal as="div" className="inline-flex items-center gap-2 rounded-pill bg-primary-light/80 px-4 py-1.5 text-xs font-semibold text-primary mb-4 shadow-card">
            How Nexus works
          </ScrollReveal>
          <ScrollReveal as="h2" className="text-3xl md:text-[2.75rem] font-bold text-foreground" delay={0.05}>
            From paper survey to live insight in 10 seconds
          </ScrollReveal>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Dashed connector line (visible on md+) */}
          <div className="hidden md:block absolute top-16 left-[12%] right-[12%] border-t-2 border-dashed border-primary/20 z-0" />

          {steps.map((step, index) => (
            <ScrollReveal
              key={step.num}
              as="div"
              className="relative z-10 flex flex-col items-center text-center group"
              delay={0.1 + index * 0.05}
            >
              {/* Numbered circle */}
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg mb-6 shadow-card ring-4 ring-primary/10 transition-transform duration-500 group-hover:-translate-y-1">
                {step.num}
              </div>
              {/* Card */}
              <div className="rounded-card bg-card/90 backdrop-blur-sm border border-border/80 p-7 shadow-card hover:shadow-card-hover transition-all w-full group-hover:-translate-y-1">
                <div className="w-11 h-11 rounded-button bg-primary-light/80 flex items-center justify-center mx-auto mb-4 shadow-card">
                  <step.icon className="w-5.5 h-5.5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
