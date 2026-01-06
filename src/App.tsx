import { Toaster } from "@/components/ui/toaster";
import AcompanharChamado from "./pages/app/AcompanharChamado";
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
import Login from "./pages/auth/Login";
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
import OficinaDetalhe from "./pages/oficina/OficinaDetalhe";
import OrdensServicoList from "./pages/oficina/OrdensServicoList";
import OrdemServicoDetalhePage from "./pages/oficina/OrdemServicoDetalhe";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import AssistenciaDashboard from "./pages/assistencia/AssistenciaDashboard";
import ChamadosList from "./pages/assistencia/ChamadosList";
import ChamadoDetalhe from "./pages/assistencia/ChamadoDetalhe";
import PrestadoresList from "./pages/assistencia/PrestadoresList";
import PrestadorDetalhe from "./pages/assistencia/PrestadorDetalhe";

// Financeiro
import FinanceiroDashboard from "./pages/financeiro/FinanceiroDashboard";

// Cobrança
import CobrancaDashboard from "./pages/cobranca/CobrancaDashboard";
import InadimplentesList from "./pages/cobranca/InadimplentesList";
import InadimplenteDetalhe from "./pages/cobranca/InadimplenteDetalhe";
import FilaTrabalho from "./pages/cobranca/FilaTrabalho";
import ReguaCobranca from "./pages/cobranca/ReguaCobranca";
import Negativacao from "./pages/cobranca/Negativacao";
import AcordosList from "./pages/cobranca/AcordosList";
import NovoAcordo from "./pages/cobranca/NovoAcordo";
import AcordoDetalhe from "./pages/cobranca/AcordoDetalhe";
import CobrancasList from "./pages/financeiro/CobrancasList";
import CobrancaDetalhe from "./pages/financeiro/CobrancaDetalhe";
import FaturamentoMensal from "./pages/financeiro/FaturamentoMensal";
import ContasPagar from "./pages/financeiro/ContasPagar";
import Extrato from "./pages/financeiro/Extrato";

// Contabilidade
import ContabilidadeDashboard from "./pages/contabilidade/ContabilidadeDashboard";
import PlanoContas from "./pages/contabilidade/PlanoContas";
import LancamentosList from "./pages/contabilidade/LancamentosList";
import NovoLancamento from "./pages/contabilidade/NovoLancamento";
import LancamentoDetalhe from "./pages/contabilidade/LancamentoDetalhe";
import Balancete from "./pages/contabilidade/Balancete";
import DRE from "./pages/contabilidade/DRE";
import Fechamentos from "./pages/contabilidade/Fechamentos";
import RazaoConta from "./pages/contabilidade/RazaoConta";

// Jurídico
import JuridicoDashboard from "./pages/juridico/JuridicoDashboard";
import ProcessosList from "./pages/juridico/ProcessosList";
import ProcessoDetalhe from "./pages/juridico/ProcessoDetalhe";
import ProcessoForm from "./pages/juridico/ProcessoForm";
import PrazosControl from "./pages/juridico/PrazosControl";
import AudienciasAgenda from "./pages/juridico/AudienciasAgenda";
import AdvogadosList from "./pages/juridico/AdvogadosList";
import ConsultasJuridicas from "./pages/juridico/ConsultasJuridicas";

// RH
import RHDashboard from "./pages/rh/RHDashboard";
import FuncionariosList from "./pages/rh/FuncionariosList";
import FuncionarioDetalhe from "./pages/rh/FuncionarioDetalhe";
import FuncionarioForm from "./pages/rh/FuncionarioForm";
import ControlePonto from "./pages/rh/ControlePonto";
import FeriasGestao from "./pages/rh/FeriasGestao";
import Organograma from "./pages/rh/Organograma";
import DepartamentosCargos from "./pages/rh/DepartamentosCargos";
import Beneficios from "./pages/rh/Beneficios";

// Marketing
import MarketingDashboard from "./pages/marketing/MarketingDashboard";
import Campanhas from "./pages/marketing/Campanhas";
import CampanhaDetalhe from "./pages/marketing/CampanhaDetalhe";
import CampanhaForm from "./pages/marketing/CampanhaForm";
import Canais from "./pages/marketing/Canais";
import Indicacoes from "./pages/marketing/Indicacoes";
import UTMs from "./pages/marketing/UTMs";
import DistribuicaoLeads from "./pages/marketing/DistribuicaoLeads";
import RelatoriosMarketing from "./pages/marketing/RelatoriosMarketing";

// Diretoria
import DiretoriaDashboard from "./pages/diretoria/DiretoriaDashboard";
import ProdutosGestao from "./pages/diretoria/ProdutosGestao";
import ProdutoDetalhe from "./pages/diretoria/ProdutoDetalhe";
import TabelaPrecos from "./pages/diretoria/TabelaPrecos";
import RateioSinistros from "./pages/diretoria/RateioSinistros";
import IndicadoresAtuariais from "./pages/diretoria/IndicadoresAtuariais";
import ConfiguracoesSistema from "./pages/diretoria/Configuracoes";
import PerfisAcesso from "./pages/diretoria/PerfisAcesso";
import LogsAuditoria from "./pages/diretoria/LogsAuditoria";
import RelatoriosGerenciais from "./pages/diretoria/RelatoriosGerenciais";

// Associate App Pages
import AppLogin from "./pages/app/AppLogin";
import AppRedefinirSenha from "./pages/app/AppRedefinirSenha";
import AppHome from "./pages/app/AppHome";
import MeusBoletos from "./pages/app/MeusBoletos";
import BoletoDetalhe from "./pages/app/BoletoDetalhe";
import AppRastreamento from "./pages/app/AppRastreamento";
import SolicitarAssistencia from "./pages/app/SolicitarAssistencia";
import HistoricoChamados from "./pages/app/HistoricoChamados";

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
            <Route path="/login" element={<Login />} />
            
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
              
              {/* Assistência 24h */}
              <Route path="/assistencia" element={<AssistenciaDashboard />} />
              <Route path="/assistencia/chamados" element={<ChamadosList />} />
              <Route path="/assistencia/chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="/assistencia/prestadores" element={<PrestadoresList />} />
              <Route path="/assistencia/prestadores/:id" element={<PrestadorDetalhe />} />
              
              {/* Financeiro */}
              <Route path="/financeiro" element={<FinanceiroDashboard />} />
              <Route path="/financeiro/cobrancas" element={<CobrancasList />} />
              <Route path="/financeiro/cobrancas/:id" element={<CobrancaDetalhe />} />
              <Route path="/financeiro/faturamento" element={<FaturamentoMensal />} />
              <Route path="/financeiro/contas-pagar" element={<ContasPagar />} />
              <Route path="/financeiro/extrato" element={<Extrato />} />
              
              {/* Cobrança */}
              <Route path="/cobranca" element={<CobrancaDashboard />} />
              <Route path="/cobranca/fila" element={<FilaTrabalho />} />
              <Route path="/cobranca/inadimplentes/:id" element={<InadimplenteDetalhe />} />
              <Route path="/cobranca/inadimplentes" element={<InadimplentesList />} />
              <Route path="/cobranca/regua" element={<ReguaCobranca />} />
              <Route path="/cobranca/negativacao" element={<Negativacao />} />
              <Route path="/cobranca/acordos" element={<AcordosList />} />
              <Route path="/cobranca/acordos/novo" element={<NovoAcordo />} />
              <Route path="/cobranca/acordos/:id" element={<AcordoDetalhe />} />
              
              {/* Contabilidade */}
              <Route path="/contabilidade" element={<ContabilidadeDashboard />} />
              <Route path="/contabilidade/plano-contas" element={<PlanoContas />} />
              <Route path="/contabilidade/lancamentos" element={<LancamentosList />} />
              <Route path="/contabilidade/lancamentos/novo" element={<NovoLancamento />} />
              <Route path="/contabilidade/lancamentos/:id" element={<LancamentoDetalhe />} />
              <Route path="/contabilidade/balancete" element={<Balancete />} />
              <Route path="/contabilidade/dre" element={<DRE />} />
              <Route path="/contabilidade/fechamento" element={<Fechamentos />} />
              <Route path="/contabilidade/razao/:contaId" element={<RazaoConta />} />
              
              {/* Jurídico */}
              <Route path="/juridico" element={<JuridicoDashboard />} />
              <Route path="/juridico/processos" element={<ProcessosList />} />
              <Route path="/juridico/processos/novo" element={<ProcessoForm />} />
              <Route path="/juridico/processos/:id" element={<ProcessoDetalhe />} />
              <Route path="/juridico/processos/:id/editar" element={<ProcessoForm />} />
              <Route path="/juridico/prazos" element={<PrazosControl />} />
              <Route path="/juridico/audiencias" element={<AudienciasAgenda />} />
              <Route path="/juridico/advogados" element={<AdvogadosList />} />
              <Route path="/juridico/consultas" element={<ConsultasJuridicas />} />
              
              {/* RH */}
              <Route path="/rh" element={<RHDashboard />} />
              <Route path="/rh/funcionarios" element={<FuncionariosList />} />
              <Route path="/rh/funcionarios/novo" element={<FuncionarioForm />} />
              <Route path="/rh/funcionarios/:id" element={<FuncionarioDetalhe />} />
              <Route path="/rh/funcionarios/:id/editar" element={<FuncionarioForm />} />
              <Route path="/rh/ponto" element={<ControlePonto />} />
              <Route path="/rh/ferias" element={<FeriasGestao />} />
              <Route path="/rh/organograma" element={<Organograma />} />
              <Route path="/rh/departamentos" element={<DepartamentosCargos />} />
              <Route path="/rh/beneficios" element={<Beneficios />} />
              
              {/* Monitoramento */}
              <Route path="/monitoramento/instalacoes" element={<Instalacoes />} />
              <Route path="/monitoramento/rotas" element={<Rotas />} />
              <Route path="/monitoramento/estoque" element={<Estoque />} />
              <Route path="/monitoramento/mapa" element={<Mapa />} />
              <Route path="/monitoramento/rastreadores" element={<Rastreadores />} />
              
              {/* Marketing */}
              <Route path="/marketing" element={<MarketingDashboard />} />
              <Route path="/marketing/campanhas" element={<Campanhas />} />
              <Route path="/marketing/campanhas/nova" element={<CampanhaForm />} />
              <Route path="/marketing/campanhas/:id" element={<CampanhaDetalhe />} />
              <Route path="/marketing/campanhas/:id/editar" element={<CampanhaForm />} />
              <Route path="/marketing/canais" element={<Canais />} />
              <Route path="/marketing/indicacoes" element={<Indicacoes />} />
              <Route path="/marketing/utms" element={<UTMs />} />
              <Route path="/marketing/distribuicao" element={<DistribuicaoLeads />} />
              <Route path="/marketing/relatorios" element={<RelatoriosMarketing />} />
              
              {/* Diretoria */}
              <Route path="/diretoria" element={<DiretoriaDashboard />} />
              <Route path="/diretoria/produtos" element={<ProdutosGestao />} />
              <Route path="/diretoria/produtos/:id" element={<ProdutoDetalhe />} />
              <Route path="/diretoria/precos" element={<TabelaPrecos />} />
              <Route path="/diretoria/rateios" element={<RateioSinistros />} />
              <Route path="/diretoria/indicadores" element={<IndicadoresAtuariais />} />
              <Route path="/diretoria/configuracoes" element={<ConfiguracoesSistema />} />
              <Route path="/diretoria/perfis" element={<PerfisAcesso />} />
              <Route path="/diretoria/logs" element={<LogsAuditoria />} />
              <Route path="/diretoria/relatorios" element={<RelatoriosGerenciais />} />
              {/* Oficinas */}
              <Route path="/oficinas" element={<Oficinas />} />
              <Route path="/oficina/credenciadas" element={<OficinasList />} />
              <Route path="/oficina/credenciadas/:id" element={<OficinaDetalhe />} />
              <Route path="/oficina/ordens-servico" element={<OrdensServicoList />} />
              <Route path="/oficina/ordens-servico/:id" element={<OrdemServicoDetalhePage />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/oficinas/ordens/:id" element={<OrdemServicoDetalhe />} />
              
              {/* Config */}
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            
            {/* Associate App Routes */}
            <Route path="/app/login" element={<AppLogin />} />
            <Route path="/app/redefinir-senha" element={<AppRedefinirSenha />} />
            <Route element={<AssociadoAppLayout />}>
              <Route path="/app/home" element={<AppHome />} />
              <Route path="/app/boletos" element={<MeusBoletos />} />
              <Route path="/app/boletos/:id" element={<BoletoDetalhe />} />
              <Route path="/app/rastreamento" element={<AppRastreamento />} />
              <Route path="/app/assistencia" element={<SolicitarAssistencia />} />
              <Route path="/app/assistencia/nova" element={<AppAssistenciaNova />} />
              <Route path="/app/assistencia/historico" element={<HistoricoChamados />} />
              <Route path="/app/assistencia/:id" element={<AcompanharChamado />} />
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
