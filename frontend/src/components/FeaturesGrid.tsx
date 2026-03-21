import { Users, BarChart3, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Volunteer Orchestration",
    description: "Intelligently match volunteers to tasks based on skills, availability, and community needs.",
  },
  {
    icon: BarChart3,
    title: "Community Intelligence",
    description: "Real-time scoring and risk analysis across every dimension of your community operations.",
  },
  {
    icon: Shield,
    title: "Risk Detection",
    description: "Early warning signals for volunteer burnout, coverage gaps, and operational bottlenecks.",
  },
  {
    icon: Zap,
    title: "Automated Workflows",
    description: "Streamline onboarding, scheduling, and reporting with intelligent automation.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-24 px-page">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Platform Capabilities</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Intelligence at every level
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            NEXUS combines data-driven insights with human-centered design to power communities that scale.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-card-gap">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group rounded-card bg-card border border-border p-6 shadow-card hover:shadow-card-hover transition-all duration-150 hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-button gradient-primary flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
