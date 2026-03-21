import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-page">
      <div className="max-w-content mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="NEXUS Logo" className="w-6 h-6 rounded-md" />
          <span className="font-bold text-foreground">NEXUS</span>
        </div>
        <p className="text-sm text-text-secondary">© 2026 NEXUS. Community Intelligence Platform.</p>
      </div>
    </footer>
  );
}
