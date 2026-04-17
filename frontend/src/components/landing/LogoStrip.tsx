import ScrollReveal from "@/components/ui/ScrollReveal";

const orgs = ["UNICEF", "CRY", "Pratham", "Akshaya Patra", "Goonj", "CARE India", "Save the Children", "Oxfam"];

export function LogoStrip() {
  return (
    <section className="py-10 px-page bg-muted/50 border-y border-border">
      <div className="max-w-content mx-auto text-center">
        <ScrollReveal as="p" className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-6">
          Join 200+ NGOs already using Nexus
        </ScrollReveal>
        <ScrollReveal as="div" className="relative overflow-hidden" direction="up" delay={0.05}>
          <div className="logo-loop-track flex items-center gap-10 whitespace-nowrap">
            {[...orgs, ...orgs].map((name, index) => (
              <span key={`${name}-${index}`} className="text-sm font-bold text-border select-none whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </ScrollReveal>
        <style>{`
          @keyframes logo-loop {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .logo-loop-track {
            width: max-content;
            animation: logo-loop 22s linear infinite;
          }
        `}</style>
      </div>
    </section>
  );
}
