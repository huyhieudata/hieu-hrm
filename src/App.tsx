import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RouteErrorBoundary } from "./components/error-boundary/route-error-boundary";
import { InstallPrompt } from "./components/pwa/install-prompt";
import { routers } from "./router";
import { AuthProvider } from "./lib/auth-provider";
import { CompanyProvider } from "./lib/company-provider";

const queryClient = new QueryClient();

// Created once so remounting App (e.g. after an error-boundary retry) never
// leaves a second router listening to history. The pathless root route is the
// shared errorElement every page bubbles up to; a page can still declare its
// own errorElement, statically or through lazy().
const router = createBrowserRouter([
  { errorElement: <RouteErrorBoundary />, children: routers },
]);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <CompanyProvider>
            <RouterProvider router={router} />
          </CompanyProvider>
          <InstallPrompt />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
