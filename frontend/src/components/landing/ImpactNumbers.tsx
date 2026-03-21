const stats = [
  { value: "12", label: "Languages supported" },
  { value: "14", label: "Integrated features" },
  { value: "2KB", label: "Per field report" },
  { value: "0", label: "Internet needed for IVR" },
];

export function ImpactNumbers() {
  return (
    <section id="impact" className="py-24 px-page bg-background">
      <div className="max-w-content mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-card bg-primary-light/50 border border-border p-8 text-center"
            >
              <p className="text-4xl md:text-5xl font-extrabold font-mono text-gradient mb-2">
                {stat.value}
              </p>
              <p className="text-sm text-text-secondary font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
