import ScrollReveal from "@/components/ui/ScrollReveal";
import {
  Camera, Map, Sparkles, Users, Activity, BarChart3,
  Radio, Heart, Shield, FileText, Moon, Clock,
  BadgeCheck, Phone,
} from "lucide-react";

const features = [
  { icon: Camera, name: "Paper-to-Intelligence Pipeline", desc: "OCR-powered survey digitization", tag: "Most unique", tagColor: "bg-warning/20 text-warning" },
  { icon: Map, name: "Community Need Terrain", desc: "Geospatial need visualization", tag: "Visual AI", tagColor: "bg-primary/20 text-primary-foreground" },
  { icon: Sparkles, name: "Gemini Need Synthesizer", desc: "500 reports → 5 insights in seconds", tag: "Saves hours", tagColor: "bg-primary-glow/20 text-primary-foreground" },
  { icon: Users, name: "Volunteer DNA Matching", desc: "Multi-dimensional volunteer fit scoring", tag: "97% accuracy", tagColor: "bg-success/20 text-success" },
  { icon: Activity, name: "Mission Pulse Tracker", desc: "Live mission progress and field updates", tag: "Real-time", tagColor: "bg-[hsl(210,80%,60%)]/20 text-[hsl(210,80%,70%)]" },
  { icon: BarChart3, name: "Predictive Forecasting", desc: "Anticipate need surges 3 weeks ahead", tag: "3 weeks ahead", tagColor: "bg-warning/20 text-warning" },
  { icon: Radio, name: "Community Echo", desc: "Weekly broadcasts back to communities", tag: "First ever", tagColor: "bg-success/20 text-success" },
  { icon: Heart, name: "Empathy Engine", desc: "Pre-mission briefings with cultural context", tag: "The doorstep", tagColor: "bg-[hsl(330,70%,60%)]/20 text-[hsl(330,70%,70%)]" },
  { icon: Shield, name: "Volunteer Burnout Prediction", desc: "Protect your team before they break", tag: "Never built before", tagColor: "bg-warning/20 text-warning" },
  { icon: FileText, name: "Living Constitution", desc: "Auto-generated policy briefs for government", tag: "Policy bridge", tagColor: "bg-primary/20 text-primary-foreground" },
  { icon: Moon, name: "Invisible Coordinator", desc: "2am AI routing when humans sleep", tag: "2am AI", tagColor: "bg-primary-glow/20 text-primary-foreground" },
  { icon: Clock, name: "Generational Need Mapping", desc: "5-year child cohort risk trajectories", tag: "5 years ahead", tagColor: "bg-[hsl(174,60%,50%)]/20 text-[hsl(174,60%,60%)]" },
  { icon: BadgeCheck, name: "Trust Fabric", desc: "Verified impact ledger for donors", tag: "Impact proof", tagColor: "bg-success/20 text-success" },
  { icon: Phone, name: "IVR Voice Reporting", desc: "Field reports via phone call — zero internet", tag: "Zero internet", tagColor: "bg-muted text-muted-foreground" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-page bg-[hsl(243,54%,12%)]">
      <div className="max-w-content mx-auto">
        <div className="text-center mb-16">
          <ScrollReveal as="h2" className="text-3xl md:text-[2.5rem] font-bold text-white mb-3">
            14 features built for the last mile
          </ScrollReveal>
          <ScrollReveal as="p" className="text-[hsl(226,60%,76%)] max-w-xl mx-auto" delay={0.05}>
            Everything an NGO needs to go from paper surveys to predictive intelligence.
          </ScrollReveal>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, index) => (
            <ScrollReveal
              key={f.name}
              as="div"
              className="rounded-card bg-[hsl(243,40%,18%)] border border-[hsl(243,40%,24%)] p-5 hover:border-primary/40 transition-colors group"
              delay={0.05 + index * 0.02}
            >
              <div className="w-9 h-9 rounded-button bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
                <f.icon className="w-4.5 h-4.5 text-[hsl(226,80%,76%)]" />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-1">{f.name}</h3>
              <p className="text-sm text-[hsl(226,40%,66%)] mb-3 leading-relaxed">{f.desc}</p>
              <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-pill ${f.tagColor}`}>
                {f.tag}
              </span>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
