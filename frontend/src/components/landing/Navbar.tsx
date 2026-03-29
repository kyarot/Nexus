import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Community Voice", href: "/community-voice", internal: true },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "For NGOs", href: "#impact" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
];

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-content mx-auto px-page flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="NEXUS Logo" className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-bold text-primary">NEXUS</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            link.internal ? (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            )
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-text-secondary" asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button variant="gradient" size="sm" className="rounded-pill" asChild>
            <Link to="/login">Get Started Free</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
