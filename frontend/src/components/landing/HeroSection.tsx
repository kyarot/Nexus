import { Button } from "@/components/ui/button";
import ClickSpark from "@/components/ui/ClickSpark";
import { HeroFloatingCards } from "./HeroFloatingCards";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";

const logos = ["UNICEF", "CRY", "Pratham", "Akshaya Patra", "Goonj"];

export function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-page relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-background to-background" />
      <div className="absolute top-16 right-1/4 w-[500px] h-[500px] bg-primary/[0.06] rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-primary-glow/[0.05] rounded-full blur-3xl" />

      <ClickSpark className="max-w-content mx-auto relative z-10" sparkColor="#7c3aed">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">
          {/* Left column */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-pill bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Smart Resource Allocation
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.15] text-foreground">
              Community intelligence,
              <br />
              <span className="text-gradient">that saves lives.</span>
            </h1>

            <p className="text-lg text-text-secondary max-w-lg" style={{ lineHeight: 1.7 }}>
              Nexus transforms scattered NGO field reports into real-time community insights — so the right volunteer reaches the right family before crisis hits.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button variant="gradient" size="lg" className="rounded-pill" asChild>
                <Link to="/login">
                  <ArrowRight className="w-4 h-4" />
                  Start for free
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-text-secondary">
                <Play className="w-4 h-4" />
                Watch demo
              </Button>
            </div>

            <p className="text-[13px] text-text-muted">
              31-day free trial · No credit card · Cancel anytime
            </p>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-text-muted mb-3 uppercase tracking-wider font-semibold">Trusted by NGOs across India</p>
              <div className="flex items-center gap-6">
                {logos.map((name) => (
                  <span key={name} className="text-sm font-bold text-border select-none">{name}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="hidden lg:block">
            <HeroFloatingCards />
          </div>
        </div>
      </ClickSpark>
    </section>
  );
}
