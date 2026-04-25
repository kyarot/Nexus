import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { startOutboxSync } from "./lib/offline-outbox";

createRoot(document.getElementById("root")!).render(<App />);

registerSW({
	immediate: true,
});

startOutboxSync();
