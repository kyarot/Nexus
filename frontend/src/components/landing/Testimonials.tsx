import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Nexus replaced 6 WhatsApp groups, 2 spreadsheets, and our weekly 3-hour coordination call. We now respond to crises in minutes, not days.",
    name: "Asha Mehta",
    role: "Program Director",
    org: "Shakti Foundation, Bengaluru",
  },
  {
    quote: "The Gemini synthesizer turned 400 paper surveys into a ward-level policy brief overnight. Our district collector actually read it.",
    name: "Ravi Kumar",
    role: "Field Coordinator",
    org: "Pratham Education, Delhi",
  },
  {
    quote: "Our volunteers used to burn out in 4 months. With burnout prediction and empathy briefings, average tenure is now 14 months.",
    name: "Fatima Shaikh",
    role: "Volunteer Manager",
    org: "Mercy Corps India, Mumbai",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 px-page bg-background">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-[2.5rem] font-bold text-foreground">
            Voices from the field
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-card bg-card border border-border p-6 shadow-card hover:shadow-card-hover transition-all"
            >
              <Quote className="w-8 h-8 text-primary/30 mb-4" />
              <p className="text-sm text-foreground leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-text-secondary">{t.role} · {t.org}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
