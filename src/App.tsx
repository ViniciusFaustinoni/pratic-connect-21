import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppLayout as AssociadoAppLayout } from "@/components/app/AppLayout";
import { InstaladorLayout } from "@/components/instalador/InstaladorLayout";

// Internal System Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/vendas/Leads";
import LeadDetalhe from "./pages/vendas/LeadDetalhe";
import Acompanhamento from "./pages/vendas/Acompanhamento";
import Cotacoes from "./pages/vendas/Cotacoes";
import Contratos from "./pages/vendas/Contratos";
import DashboardVendas from "./pages/vendas/DashboardVendas";
import RelatoriosVendas from "./pages/vendas/RelatoriosVendas";
import Metas from "./pages/vendas/Metas";
import Associados from "./pages/cadastro/Associados";
import AssociadoDetalhe from "./pages/cadastro/AssociadoDetalhe";
import Veiculos from "./pages/cadastro/Veiculos";
import Documentos from "./pages/cadastro/Documentos";
import SinistrosList from "./pages/eventos/SinistrosList";
import SinistroDetalhe from "./pages/eventos/SinistroDetalhe";
import SinistrosDashboard from "./pages/eventos/SinistrosDashboard";
import Instalacoes from "./pages/monitoramento/Instalacoes";
import Rotas from "./pages/monitoramento/Rotas";
import Estoque from "./pages/monitoramento/Estoque";
import Rastreadores from "./pages/monitoramento/Rastreadores";
import Mapa from "./pages/monitoramento/Mapa";
import Oficinas from "./pages/oficinas/Oficinas";
import OrdensServico from "./pages/oficinas/OrdensServico";
import OrdemServicoDetalhe from "./pages/oficinas/OrdemServicoDetalhe";
import OficinasList from "./pages/oficina/OficinasList";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

// Associate App Pages
import AppLogin from "./pages/app/AppLogin";
import AppRedefinirSenha from "./pages/app/AppRedefinirSenha";
import AppHome from "./pages/app/AppHome";
import AppBoletos from "./pages/app/AppBoletos";
import AppBoletoDetalhe from "./pages/app/AppBoletoDetalhe";
import AppRastreamento from "./pages/app/AppRastreamento";
import AppAssistencia from "./pages/app/AppAssistencia";
import AppAssistenciaDetalhe from "./pages/app/AppAssistenciaDetalhe";
import AppAssistenciaNova from "./pages/app/AppAssistenciaNova";
import AppSinistros from "./pages/app/AppSinistros";
import AppSinistroNovo from "./pages/app/AppSinistroNovo";
import AppSinistroDetalhe from "./pages/app/AppSinistroDetalhe";
import AppPerfil from "./pages/app/AppPerfil";
import AppConfiguracoes from "./pages/app/AppConfiguracoes";
import AppDocumentos from "./pages/app/AppDocumentos";
import AppNotificacoes from "./pages/app/AppNotificacoes";
import AppPlano from "./pages/app/AppPlano";

// Installer App Pages
import InstaladorLogin from "./pages/instalador/InstaladorLogin";
import InstaladorHome from "./pages/instalador/InstaladorHome";
import InstaladorChecklist from "./pages/instalador/InstaladorChecklist";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
            
            {/* Protected routes with internal layout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Vendas */}
              <Route path="/vendas/dashboard" element={<DashboardVendas />} />
              <Route path="/vendas/leads" element={<Leads />} />
              <Route path="/vendas/leads/:id" element={<LeadDetalhe />} />
              <Route path="/vendas/acompanhamento" element={<Acompanhamento />} />
              <Route path="/vendas/cotacoes" element={<Cotacoes />} />
              <Route path="/vendas/contratos" element={<Contratos />} />
              <Route path="/vendas/relatorios" element={<RelatoriosVendas />} />
              <Route path="/vendas/metas" element={<Metas />} />
              
              {/* Cadastro */}
              <Route path="/cadastro/associados" element={<Associados />} />
              <Route path="/cadastro/associados/:id" element={<AssociadoDetalhe />} />
              <Route path="/cadastro/veiculos" element={<Veiculos />} />
              <Route path="/cadastro/documentos" element={<Documentos />} />
              
              {/* Eventos */}
              <Route path="/eventos/dashboard" element={<SinistrosDashboard />} />
              <Route path="/eventos/sinistros" element={<SinistrosList />} />
              <Route path="/eventos/sinistros/:id" element={<SinistroDetalhe />} />
              
              {/* Monitoramento */}
              <Route path="/monitoramento/instalacoes" element={<Instalacoes />} />
              <Route path="/monitoramento/rotas" element={<Rotas />} />
              <Route path="/monitoramento/estoque" element={<Estoque />} />
              <Route path="/monitoramento/mapa" element={<Mapa />} />
              <Route path="/monitoramento/rastreadores" element={<Rastreadores />} />
              
              {/* Oficinas */}
              <Route path="/oficinas" element={<Oficinas />} />
              <Route path="/oficina/credenciadas" element={<OficinasList />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/ordens-servico/:id" element={<OrdemServicoDetalhe />} />
              
              {/* Config */}
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            
            {/* Associate App Routes */}
            <Route path="/app/login" element={<AppLogin />} />
            <Route path="/app/redefinir-senha" element={<AppRedefinirSenha />} />
            <Route element={<AssociadoAppLayout />}>
              <Route path="/app/home" element={<AppHome />} />
              <Route path="/app/boletos" element={<AppBoletos />} />
              <Route path="/app/boletos/:id" element={<AppBoletoDetalhe />} />
              <Route path="/app/rastreamento" element={<AppRastreamento />} />
              <Route path="/app/assistencia" element={<AppAssistencia />} />
              <Route path="/app/assistencia/nova" element={<AppAssistenciaNova />} />
              <Route path="/app/assistencia/:id" element={<AppAssistenciaDetalhe />} />
              <Route path="/app/sinistros" element={<AppSinistros />} />
              <Route path="/app/sinistros/novo" element={<AppSinistroNovo />} />
              <Route path="/app/sinistros/:id" element={<AppSinistroDetalhe />} />
              <Route path="/app/perfil" element={<AppPerfil />} />
              <Route path="/app/plano" element={<AppPlano />} />
              <Route path="/app/configuracoes" element={<AppConfiguracoes />} />
              <Route path="/app/documentos" element={<AppDocumentos />} />
              <Route path="/app/notificacoes" element={<AppNotificacoes />} />
            </Route>
            <Route path="/app" element={<Navigate to="/app/home" replace />} />
            
            {/* Installer App Routes */}
            <Route path="/instalador/login" element={<InstaladorLogin />} />
            <Route element={<InstaladorLayout />}>
              <Route path="/instalador" element={<InstaladorHome />} />
              <Route path="/instalador/instalacao/:id" element={<InstaladorChecklist />} />
            </Route>
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
