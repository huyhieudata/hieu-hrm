import { createRoot } from "react-dom/client";
import { installVietnameseValidation } from "@/lib/vi-validation";
import "./setup";
import { bootstrapGeneratedSiteAnalytics } from "./analytics.ts";
import App from "./App.tsx";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./components/error-boundary/error-fallback";
import { reportCaughtError } from "./lib/report-caught-error";
import { registerServiceWorker } from "./lib/pwa";
import { applyTheme } from "./lib/theme";
import "./index.css";

applyTheme();

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root was not found.");
}

bootstrapGeneratedSiteAnalytics();
registerServiceWorker();

installVietnameseValidation();

createRoot(container, { onCaughtError: reportCaughtError }).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
  </ErrorBoundary>,
);
