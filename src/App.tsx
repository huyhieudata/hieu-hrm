import { ConfirmDialogHost } from "@/components/common/confirm-dialog";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RouteErrorBoundary } from "./components/error-boundary/route-error-boundary";
import { InstallPrompt } from "./components/pwa/install-prompt";
import { InstallReporter } from "./components/pwa/install-reporter";
import { preloadRoutes, routers } from "./router";

if (typeof window !== "undefined") {
  // Chunk của URL hiện tại đã được tải trong router. Các trang còn lại chờ lúc rảnh
  // (tuần tự, bỏ qua khi tiết kiệm dữ liệu) để không tranh băng thông lần mở đầu.
  window.addEventListener(
    "load",
    () => {
      const start = () => void preloadRoutes();
      if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 1500 });
      else window.setTimeout(start, 1200);
    },
    { once: true },
  );
}
import { AuthProvider } from "./lib/auth-provider";
import { CompanyProvider } from "./lib/company-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

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
        <ConfirmDialogHost />
        <Sonner />
        <AuthProvider>
          <CompanyProvider>
            <RouterProvider router={router} />
            <InstallReporter />
          </CompanyProvider>
          <InstallPrompt />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
