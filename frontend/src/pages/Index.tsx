import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ImpactNumbers } from "@/components/landing/ImpactNumbers";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <LogoStrip />
      <HowItWorks />
      <FeaturesSection />
      <ImpactNumbers />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
