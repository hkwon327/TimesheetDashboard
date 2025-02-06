import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard"; // Change this
import NotFound from "@/pages/NotFound";
import PendingRequests from "@/pages/PendingRequests";
import ApprovedRequests from "@/pages/ApprovedRequests";
import PastRequests from "@/pages/PastRequests";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} /> {/* Change this */}
          <Route path="/pending" element={<PendingRequests />} />
          <Route path="/approved" element={<ApprovedRequests />} />
          <Route path="/past" element={<PastRequests />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;