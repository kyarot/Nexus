const orgs = ["UNICEF", "CRY", "Pratham", "Akshaya Patra", "Goonj", "CARE India", "Save the Children", "Oxfam"];

export function LogoStrip() {
  return (
    <section className="py-10 px-page bg-muted/50 border-y border-border">
      <div className="max-w-content mx-auto text-center">
        <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-6">
          Join 200+ NGOs already using Nexus
        </p>
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {orgs.map((name) => (
            <span key={name} className="text-sm font-bold text-border select-none whitespace-nowrap">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
