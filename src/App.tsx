import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/vendas/Leads";
import Cotacoes from "./pages/vendas/Cotacoes";
import Contratos from "./pages/vendas/Contratos";
import Associados from "./pages/cadastro/Associados";
import Veiculos from "./pages/cadastro/Veiculos";
import Documentos from "./pages/cadastro/Documentos";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected routes with layout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Vendas */}
              <Route path="/vendas/leads" element={<Leads />} />
              <Route path="/vendas/cotacoes" element={<Cotacoes />} />
              <Route path="/vendas/contratos" element={<Contratos />} />
              
              {/* Cadastro */}
              <Route path="/cadastro/associados" element={<Associados />} />
              <Route path="/cadastro/veiculos" element={<Veiculos />} />
              <Route path="/cadastro/documentos" element={<Documentos />} />
              
              {/* Config */}
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
