import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function FinalCTA() {
  return (
    <section className="py-24 px-page">
      <div className="max-w-content mx-auto rounded-card gradient-accent p-16 text-center relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Give your NGO a brain, not a spreadsheet.
          </h2>
          <p className="text-white/70 max-w-lg mx-auto mb-8">
            Join 200+ organizations already using Nexus to save lives with community intelligence.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-pill font-semibold" asChild>
              <Link to="/login">
                Start for free
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button size="lg" className="bg-white/15 text-white border border-white/30 hover:bg-white/25 rounded-pill backdrop-blur-sm">
              Talk to sales
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
