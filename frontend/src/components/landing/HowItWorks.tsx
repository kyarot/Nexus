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
    <section id="how-it-works" className="py-24 px-page bg-background">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-pill bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary mb-4">
            How Nexus works
          </div>
          <h2 className="text-3xl md:text-[2.5rem] font-bold text-foreground">
            From paper survey to live insight in 10 seconds
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Dashed connector line (visible on md+) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] border-t-2 border-dashed border-border z-0" />

          {steps.map((step) => (
            <div key={step.num} className="relative z-10 flex flex-col items-center text-center">
              {/* Numbered circle */}
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg mb-6 shadow-card">
                {step.num}
              </div>
              {/* Card */}
              <div className="rounded-card bg-card border border-border p-6 shadow-card hover:shadow-card-hover transition-all w-full">
                <div className="w-10 h-10 rounded-button bg-primary-light flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
