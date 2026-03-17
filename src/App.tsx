// App Root
import { Toaster } from "@/components/ui/toaster";
import AcompanharChamado from "./pages/app/AcompanharChamado";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AssociadoProvider } from "@/contexts/AssociadoContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppLayout as AssociadoAppLayout } from "@/components/app/AppLayout";
import { InstaladorLayout } from "@/components/instalador/InstaladorLayout";
import { ReguladorLayout } from "@/components/regulador/ReguladorLayout";
import { AnalistaEventosLayout } from "@/components/analista-eventos/AnalistaEventosLayout";
import InstaladorTarefas from "./pages/instalador/InstaladorTarefas";
import InstaladorMapa from "./pages/instalador/InstaladorMapa";
import InstaladorPerfil from "./pages/instalador/InstaladorPerfil";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";

// Public Pages
import AssociadoVistoria from "./pages/public/AssociadoVistoria";

// Internal System Pages
import Auth from "./pages/Auth";
import AuthCallback from "./pages/auth/AuthCallback";
import DefinirSenha from "./pages/auth/DefinirSenha";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import LeadsUnificado from "./pages/vendas/LeadsUnificado";
import LeadDetalhe from "./pages/vendas/LeadDetalhe";
import LeadEditar from "./pages/vendas/LeadEditar";
import Acompanhamento from "./pages/vendas/Acompanhamento";
import AtivacoesList from "./pages/vendas/AtivacoesList";
import Cotacoes from "./pages/vendas/Cotacoes";
import CotacaoDetalhe from "./pages/vendas/CotacaoDetalhe";
import Contratos from "./pages/vendas/Contratos";
import Propostas from "./pages/vendas/Propostas";
import Consultores from "./pages/vendas/Consultores";
import ContratoDetalhe from "./pages/vendas/ContratoDetalhe";
import VendasDashboard from "./pages/vendas/VendasDashboard";
import RelatoriosVendas from "./pages/vendas/RelatoriosVendas";
import Metas from "./pages/vendas/Metas";
import Cotacao from "./pages/vendas/Cotacao";
import Cotador from "./pages/vendas/Cotador";
import Vendedores from "./pages/vendas/Vendedores";
import AprovacoesFipeMenor from "./pages/vendas/AprovacoesFipeMenor";
import AprovacoesElegibilidade from "./pages/vendas/AprovacoesElegibilidade";
import VendedorHistorico from "./pages/vendas/VendedorHistorico";
import Associados from "./pages/cadastro/Associados";
import SubstituicaoVeiculoPage from "./pages/cadastro/SubstituicaoVeiculoPage";
import SubstituicoesPendentesPage from "./pages/cadastro/SubstituicoesPendentesPage";
import SubstituicaoDetalhePage from "./pages/cadastro/SubstituicaoDetalhePage";
import AssociadoDetalhe from "./pages/cadastro/AssociadoDetalhe";
import GerarTermo from "./pages/cadastro/GerarTermo";
import Veiculos from "./pages/cadastro/Veiculos";
import Documentos from "./pages/cadastro/Documentos";
import FilaDocumentos from "./pages/cadastro/FilaDocumentos";
import AnaliseDocumento from "./pages/cadastro/AnaliseDocumento";
import AnaliseVistoria from "./pages/cadastro/AnaliseVistoria";
import PropostasPendentes from "./pages/cadastro/PropostasPendentes";
import PropostaAnalise from "./pages/cadastro/PropostaAnalise";
import VistoriaCompletaAnalise from "./pages/cadastro/VistoriaCompletaAnalise";
import RecusasInstalador from "./pages/cadastro/RecusasInstalador";
import SinistrosList from "./pages/eventos/SinistrosList";
import EventosPreAnalise from "./pages/eventos/EventosPreAnalise";
import SinistroAnalise from "./pages/eventos/SinistroAnalise";
import PlanosAdmin from "./pages/admin/PlanosAdmin";
import SinistroDetalhe from "./pages/eventos/SinistroDetalhe";
import SinistrosDashboard from "./pages/eventos/SinistrosDashboard";
import EventosSLADashboard from "./pages/eventos/EventosSLADashboard";
import SindicanciasList from "./pages/eventos/SindicanciasList";
import SindicanciaDetalhe from "./pages/eventos/SindicanciaDetalhe";
import SindicanteDashboard from "./pages/sindicante/SindicanteDashboard";
import SindicanteCasoDetalhe from "./pages/sindicante/SindicanteCasoDetalhe";
import SindicantesAdmin from "./pages/eventos/SindicantesAdmin";
import InstalacoesList from "./pages/monitoramento/InstalacoesList";
import InstalacaoDetalhe from "./pages/monitoramento/InstalacaoDetalhe";
import Rotas from "./pages/monitoramento/Rotas";
import MonitoramentoEncaixes from "./pages/monitoramento/Encaixes";
import Estoque from "./pages/monitoramento/Estoque";
import Rastreadores from "./pages/monitoramento/Rastreadores";
import ConfigPlataformas from "./pages/monitoramento/ConfigPlataformas";
import AlertasMonitoramento from "./pages/monitoramento/AlertasMonitoramento";

import Mapa from "./pages/monitoramento/Mapa";
import CalendarioInstalacoes from "./pages/monitoramento/CalendarioInstalacoes";
import Vistorias from "./pages/monitoramento/Vistorias";
import VistoriasInstalacoes from "./pages/monitoramento/VistoriasInstalacoes";
import DashboardCoordenador from "./pages/monitoramento/DashboardCoordenador";
import Equipe from "./pages/monitoramento/Equipe";
import FilaVistorias from "./pages/monitoramento/FilaVistorias";
import RetiradasPage from "./pages/monitoramento/RetiradasPage";
import VistoriasManutencao from "./pages/monitoramento/VistoriasManutencao";
import GestaoRotas from "./pages/monitoramento/GestaoRotas";
import RessalvasPendentes from "./pages/monitoramento/RessalvasPendentes";
import AprovacaoAssociadosMonitoramento from "./pages/monitoramento/AcionamentosRouboFurto";
import Oficinas from "./pages/oficinas/Oficinas";
import AutoCenters from "./pages/oficinas/AutoCenters";
import OficinasRelatorios from "./pages/oficinas/OficinasRelatorios";

import OrdensServico from "./pages/oficinas/OrdensServico";
import OrdemServicoDetalhe from "./pages/oficinas/OrdemServicoDetalhe";
import OficinasList from "./pages/oficina/OficinasList";
import OficinaDetalhe from "./pages/oficina/OficinaDetalhe";
import OrdensServicoList from "./pages/oficina/OrdensServicoList";
import OrdemServicoDetalhePage from "./pages/oficina/OrdemServicoDetalhe";
import Configuracoes from "./pages/Configuracoes";
import Perfil from "./pages/Perfil";
import Notificacoes from "./pages/Notificacoes";

// Configurações Module
import { ConfiguracoesLayout } from "./pages/configuracoes/ConfiguracoesLayout";
import MeuPerfil from "./pages/configuracoes/MeuPerfil";
import Seguranca from "./pages/configuracoes/Seguranca";
import NotificacoesConfig from "./pages/configuracoes/Notificacoes";
import Usuarios from "./pages/configuracoes/Usuarios";
import UsuarioForm from "./pages/configuracoes/UsuarioForm";
import Perfis from "./pages/configuracoes/Perfis";

import Integracoes from "./pages/configuracoes/Integracoes";
import IntegracaoWhatsApp from "./pages/configuracoes/IntegracaoWhatsApp";
import IntegracaoApiKeys from "./pages/configuracoes/IntegracaoApiKeys";
import IntegracaoFontesLeads from "./pages/configuracoes/IntegracaoFontesLeads";
import IntegracaoSGAHinova from "./pages/configuracoes/IntegracaoSGAHinova";
import Sistema from "./pages/configuracoes/Sistema";
import Logs from "./pages/configuracoes/Logs";
import RateioConfig from "./pages/configuracoes/RateioConfig";
import UsuariosAcessos from "./pages/configuracoes/UsuariosAcessos";
import NotFound from "./pages/NotFound";
import AcessoNegado from "./pages/AcessoNegado";
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
import EmissaoCobrancas from "./pages/financeiro/EmissaoCobrancas";
import NotificacoesCobranca from "./pages/financeiro/NotificacoesCobranca";
import ContasPagar from "./pages/financeiro/ContasPagar";
import Extrato from "./pages/financeiro/Extrato";
import ExtratosBancarios from "./pages/financeiro/ExtratosBancarios";
import ExtratoDetalhe from "./pages/financeiro/ExtratoDetalhe";
import ContasBancarias from "./pages/financeiro/ContasBancarias";
import ExtratoAssociado from "./pages/financeiro/ExtratoAssociado";
import ComissionamentoExternoConfig from "./pages/financeiro/ComissionamentoExternoConfig";
import ContaCorrenteVendedor from "./pages/financeiro/ContaCorrenteVendedor";
import GestaoContaVendedor from "./pages/financeiro/GestaoContaVendedor";
import DashboardVendaExterna from "./pages/financeiro/DashboardVendaExterna";

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
import BalancoPatrimonial from "./pages/contabilidade/BalancoPatrimonial";

// Jurídico
import JuridicoDashboard from "./pages/juridico/JuridicoDashboard";
import ProcessosList from "./pages/juridico/ProcessosList";
import ProcessoDetalhe from "./pages/juridico/ProcessoDetalhe";
import ProcessoForm from "./pages/juridico/ProcessoForm";
import PrazosControl from "./pages/juridico/PrazosControl";
import AudienciasAgenda from "./pages/juridico/AudienciasAgenda";
import AudienciaDetalhe from "./pages/juridico/AudienciaDetalhe";
import AdvogadosList from "./pages/juridico/AdvogadosList";
import AdvogadoForm from "./pages/juridico/AdvogadoForm";
import AdvogadoDetalhe from "./pages/juridico/AdvogadoDetalhe";
import ConsultasJuridicas from "./pages/juridico/ConsultasJuridicas";
import ConsultasUnificadas from "./pages/juridico/ConsultasUnificadas";
import CasosJuridicosList from "./pages/juridico/CasosJuridicosList";
import CasoJuridicoDetalhe from "./pages/juridico/CasoJuridicoDetalhe";

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
import FolhaPagamento from "./pages/rh/FolhaPagamento";
import Treinamentos from "./pages/rh/Treinamentos";
import Recrutamento from "./pages/rh/Recrutamento";
import JornadasProfissionais from "./pages/rh/JornadasProfissionais";

// Marketing
import MarketingDashboard from "./pages/marketing/MarketingDashboard";
import Campanhas from "./pages/marketing/Campanhas";
import CampanhaDetalhe from "./pages/marketing/CampanhaDetalhe";
import CampanhaForm from "./pages/marketing/CampanhaForm";
import Canais from "./pages/marketing/Canais";
import CanalDetalhe from "./pages/marketing/CanalDetalhe";
import Indicacoes from "./pages/marketing/Indicacoes";
import UTMs from "./pages/marketing/UTMs";
import RelatoriosMarketing from "./pages/marketing/RelatoriosMarketing";
import LandingPages from "./pages/marketing/LandingPages";
import Materiais from "./pages/marketing/Materiais";
import ComunicacaoMassa from "./pages/marketing/ComunicacaoMassa";
import RedesSociais from "./pages/marketing/RedesSociais";
import DistribuicaoConfig from "./pages/vendas/DistribuicaoConfig";
import PlanosBeneficios from "./pages/vendas/PlanosBeneficios";
import VendasConfig from "./pages/vendas/VendasConfig";
import { VendasNotificationListener } from "./components/notifications/VendasNotificationListener";

// Documentos
import TemplatesList from "./pages/documentos/TemplatesList";
import GerarDocumento from "./pages/documentos/GerarDocumento";
import DocumentosHistorico from "./pages/documentos/DocumentosHistorico";
import TemplateForm from "./pages/documentos/TemplateForm";
import AditivosList from "./pages/documentos/Aditivos";
import AditivoForm from "./pages/documentos/AditivoForm";

// Diretoria
import DiretoriaDashboard from "./pages/diretoria/DiretoriaDashboard";
import ProdutosGestao from "./pages/diretoria/ProdutosGestao";
import ProdutoDetalhe from "./pages/diretoria/ProdutoDetalhe";
import TabelaPrecos from "./pages/diretoria/TabelaPrecos";
import RateioSinistros from "./pages/diretoria/RateioSinistros";
import GestaoComercial from "./pages/diretoria/GestaoComercial";
import IndicadoresAtuariais from "./pages/diretoria/IndicadoresAtuariais";
import ConfiguracoesSistema from "./pages/diretoria/Configuracoes";
import PerfisAcesso from "./pages/diretoria/PerfisAcesso";
import UsuariosPage from "./pages/diretoria/Usuarios";
import UsuarioDetalhePage from "./pages/diretoria/UsuarioDetalhe";
import UsuarioEditarPage from "./pages/diretoria/UsuarioEditar";
import LogsAuditoria from "./pages/diretoria/LogsAuditoria";
import RelatoriosGerenciais from "./pages/diretoria/RelatoriosGerenciais";
import FaixasCotas from "./pages/diretoria/FaixasCotas";
import SolicitacoesIA from "./pages/diretoria/SolicitacoesIA";
import EventosChatIA from "./pages/eventos/EventosChatIA";
import CampanhasDesconto from "./pages/diretoria/CampanhasDesconto";
import FechamentoMensal from "./pages/diretoria/FechamentoMensal";
import Blacklist from "./pages/diretoria/Blacklist";
import AuditoriaVendedores from "./pages/auditoria/AuditoriaVendedores";

// Central de Relatórios
import RelatoriosCentral from "./pages/relatorios/RelatoriosCentral";

// Associate App Pages
import AppLogin from "./pages/app/AppLogin";
import AppCriarSenha from "./pages/app/AppCriarSenha";
import AppForgotPassword from "./pages/app/AppForgotPassword";
import AppVerificarCodigo from "./pages/app/AppVerificarCodigo";
import AppRedefinirSenha from "./pages/app/AppRedefinirSenha";
import AppHome from "./pages/app/AppHome";
import MeusBoletos from "./pages/app/MeusBoletos";
import AppBoletoDetalhe from "./pages/app/AppBoletoDetalhe";
import AppRastreamento from "./pages/app/AppRastreamento";
import AppRastreamentoHistorico from "./pages/app/AppRastreamentoHistorico";
import SolicitarAssistencia from "./pages/app/SolicitarAssistencia";
import HistoricoChamados from "./pages/app/HistoricoChamados";
import VeiculoReprovado from "./pages/app/VeiculoReprovado";

import AppAssistenciaNova from "./pages/app/AppAssistenciaNova";
import AppSinistros from "./pages/app/AppSinistros";
import NovoSinistro from "./pages/app/NovoSinistro";
import AppSinistroDetalhe from "./pages/app/SinistroDetalhe";
import AppPerfil from "./pages/app/AppPerfil";
import AppConfiguracoes from "./pages/app/AppConfiguracoes";
import AppDocumentos from "./pages/app/Documentos";
import AppNotificacoes from "./pages/app/AppNotificacoes";
import AppPlano from "./pages/app/AppPlano";
import AppInstall from "./pages/app/AppInstall";
import AppChat from "./pages/app/AppChat";
import Revistoria from "./pages/app/Revistoria";

// App Ouvidoria
import OuvidoriaMenu from "./pages/app/OuvidoriaMenu";
import OuvidoriaNova from "./pages/app/OuvidoriaNova";
import OuvidoriaLista from "./pages/app/OuvidoriaLista";
import OuvidoriaDetalheApp from "./pages/app/OuvidoriaDetalhe";

// ERP Ouvidoria
import OuvidoriaDashboard from "./pages/ouvidoria/OuvidoriaDashboard";
import OuvidoriaFila from "./pages/ouvidoria/ManifestacoesList";
import OuvidoriaDetalhe from "./pages/ouvidoria/ManifestacaoDetalhe";
import NovaManifestacao from "./pages/ouvidoria/NovaManifestacao";
import CanalDenuncia from "./pages/ouvidoria/CanalDenuncia";
import ConsultaProtocolo from "./pages/ouvidoria/ConsultaProtocolo";
import PesquisaSatisfacao from "./pages/ouvidoria/PesquisaSatisfacao";

// Installer App Pages
import InstaladorLogin from "./pages/instalador/InstaladorLogin";
import InstaladorHome from "./pages/instalador/InstaladorHome";
import InstaladorChecklist from "./pages/instalador/InstaladorChecklist";
import InstaladorInstalar from "./pages/instalador/InstaladorInstalar";
import InstaladorConfiguracoes from "./pages/instalador/InstaladorConfiguracoes";
import InstaladorNotificacoes from "./pages/instalador/InstaladorNotificacoes";
import InstaladorAjuda from "./pages/instalador/InstaladorAjuda";

// Vistoria Completa (unified in instalador)
import ExecutarVistoriaCompleta from "./pages/instalador/ExecutarVistoriaCompleta";
import ExecutarManutencao from "./pages/instalador/ExecutarManutencao";
import ExecutarRetirada from "./pages/instalador/ExecutarRetirada";
import ReguladorHome from "./pages/regulador/ReguladorHome";
import ReguladorVistorias from "./pages/regulador/ReguladorVistorias";
import ExecutarVistoriaEvento from "./pages/regulador/ExecutarVistoriaEvento";
import ReguladorOficina from "./pages/regulador/ReguladorOficina";
import AnalistaEventosHome from "./pages/analista-eventos/AnalistaEventosHome";
import AnalistaEventosFila from "./pages/analista-eventos/AnalistaEventosFila";
import EventoAnaliseDetalhe from "./pages/analista-eventos/EventoAnaliseDetalhe";
// Public Pages
import CotacaoPublicaPage from "./pages/public/CotacaoPublica";
import CotacaoPublicaCompleta from "./pages/public/CotacaoPublicaCompleta";
import CotacaoContratacao from "./pages/public/CotacaoContratacao";
import AcompanhamentoProposta from "./pages/public/AcompanhamentoProposta";
import TrackingAssistencia from "./pages/public/TrackingAssistencia";
import AvaliarAssistencia from "./pages/avaliar/AvaliarAssistencia";
import UploadDocumentosSinistro from "./pages/public/UploadDocumentosSinistro";
import EventoColisao from "./pages/public/EventoColisao";
import EventoPosAprovacao from "./pages/public/EventoPosAprovacao";
import RetiradaVeiculo from "./pages/public/RetiradaVeiculo";
import DespachoReboquistaPublico from "./pages/assistencia/DespachoReboquistaPublico";
import AcompanhamentoReboquePublico from "./pages/public/AcompanhamentoReboquePublico";
import PortalTerceiro from "./pages/public/PortalTerceiro";
import ReagendarVistoria from "./pages/ReagendarVistoria";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos - evita re-fetches desnecessários
      gcTime: 1000 * 60 * 30, // 30 minutos - mantém em cache
      refetchOnWindowFocus: false, // Evita re-fetch ao voltar para aba
      retry: 1, // Reduz tentativas de retry
    },
  },
});

// Componente para redirect de contrato com state
const ContratoRedirect = () => {
  const { id } = useParams();
  return <Navigate to="/vendas/contratos" state={{ openContrato: id }} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AssociadoProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppErrorBoundary>
              <BrowserRouter>
                <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/definir-senha" element={<DefinirSenha />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            
            {/* Public Quote Page */}
            <Route path="/cotacao/:token" element={<CotacaoContratacao />} />
            <Route path="/cotacao-visualizar/:token" element={<CotacaoPublicaPage />} />
            <Route path="/q/:token" element={<CotacaoPublicaCompleta />} />
            
            {/* Public Proposal Tracking Page */}
            <Route path="/acompanhar/:token" element={<AcompanhamentoProposta />} />
            
            {/* Public Associate Vistoria Page */}
            <Route path="/associado/:token" element={<AssociadoVistoria />} />
            
            {/* Public Ouvidoria Pages */}
            <Route path="/ouvidoria/canal-denuncia" element={<CanalDenuncia />} />
            <Route path="/ouvidoria/consulta-protocolo" element={<ConsultaProtocolo />} />
            <Route path="/ouvidoria/pesquisa/:protocolo" element={<PesquisaSatisfacao />} />
            
            {/* Public Tracking Assistência Page */}
            <Route path="/tracking/assistencia/:id" element={<TrackingAssistencia />} />
            
            {/* Public Avaliação Assistência Page */}
            <Route path="/avaliar/assistencia/:chamado_id" element={<AvaliarAssistencia />} />
            
            {/* Public Upload Documentos Sinistro */}
            <Route path="/sinistro/documentos/:token" element={<UploadDocumentosSinistro />} />
            
            {/* Public Evento Colisão Link */}
            <Route path="/evento/:token" element={<EventoColisao />} />
            
            {/* Public Evento Pós-Aprovação (Termo + Pagamento) */}
            <Route path="/evento-aprovado/:token" element={<EventoPosAprovacao />} />
            
            {/* Public Retirada Veículo */}
            <Route path="/retirada/:token" element={<RetiradaVeiculo />} />
            
            {/* Public Despacho Reboquista */}
            <Route path="/assistencia/chamado/:token" element={<DespachoReboquistaPublico />} />
            
            {/* Public Acompanhamento Reboque (Associado) */}
            <Route path="/acompanhar/reboque/:token" element={<AcompanhamentoReboquePublico />} />
            
            {/* Public Portal Terceiro */}
            <Route path="/terceiro/:token" element={<PortalTerceiro />} />
            
            {/* Public Reagendamento Vistoria */}
            <Route path="/reagendar/:token" element={<ReagendarVistoria />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected routes with internal layout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<><VendasNotificationListener /><Dashboard /></>} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              
              {/* Vendas */}
              <Route path="/vendas" element={<Navigate to="/vendas/leads" replace />} />
              <Route path="/vendas/leads" element={<LeadsUnificado />} />
              <Route path="/vendas/leads/:id" element={<LeadDetalhe />} />
              <Route path="/vendas/leads/:id/editar" element={<LeadEditar />} />
              <Route path="/vendas/ativacoes" element={<AtivacoesList />} />
              <Route path="/vendas/acompanhamento" element={<Acompanhamento />} />
              <Route path="/vendas/cotacao" element={<Cotacao />} />
              <Route path="/vendas/cotador" element={<Navigate to="/vendas/cotacoes?novo=true" replace />} />
              <Route path="/vendas/cotacoes" element={<Cotacoes />} />
              <Route path="/vendas/cotacoes/:id" element={<CotacaoDetalhe />} />
              <Route path="/vendas/contratos" element={<Contratos />} />
              <Route path="/vendas/equipe-comercial" element={<Propostas />} />
              <Route path="/vendas/propostas" element={<Navigate to="/vendas/equipe-comercial" replace />} />
              <Route path="/vendas/consultores" element={<Consultores />} />
              <Route path="/vendas/contratos/:id" element={<ContratoRedirect />} />
              <Route path="/vendas/planos-beneficios" element={<PlanosBeneficios />} />
              <Route path="/vendas/vendedores" element={<Vendedores />} />
              <Route path="/vendas/vendedores/:id" element={<VendedorHistorico />} />
              <Route path="/vendas/configuracoes" element={<VendasConfig />} />
              <Route path="/vendas/aprovacoes-fipe" element={<AprovacoesFipeMenor />} />
              <Route path="/aprovacoes-elegibilidade" element={<AprovacoesElegibilidade />} />
              
              {/* Auditoria */}
              <Route path="/auditoria/vendedores" element={<AuditoriaVendedores />} />
              
              {/* Cadastro */}
              <Route path="/cadastro/associados" element={<Associados />} />
              <Route path="/cadastro/associados/:id" element={<AssociadoDetalhe />} />
              <Route path="/cadastro/associados/:associadoId/substituicao" element={<SubstituicaoVeiculoPage />} />
              <Route path="/cadastro/substituicoes" element={<SubstituicoesPendentesPage />} />
              <Route path="/cadastro/substituicoes/:id" element={<SubstituicaoDetalhePage />} />
              <Route path="/cadastro/veiculos" element={<Veiculos />} />
              <Route path="/cadastro/documentos" element={<Documentos />} />
              <Route path="/cadastro/fila-documentos" element={<FilaDocumentos />} />
              <Route path="/cadastro/documentos/:id" element={<AnaliseDocumento />} />
              <Route path="/cadastro/vistorias/:id/analise" element={<AnaliseVistoria />} />
              <Route path="/cadastro/propostas" element={<PropostasPendentes />} />
              <Route path="/cadastro/propostas/:id" element={<PropostaAnalise />} />
              <Route path="/cadastro/instalacoes/:id/ativar" element={<VistoriaCompletaAnalise />} />
              <Route path="/cadastro/recusas-instalador" element={<RecusasInstalador />} />
              <Route path="/cadastro/gerar-termo" element={<GerarTermo />} />
              
              {/* Eventos */}
              <Route path="/eventos/dashboard" element={<SinistrosDashboard />} />
              <Route path="/eventos/sinistros" element={<SinistrosList />} />
              <Route path="/eventos/sinistros/:id" element={<SinistroDetalhe />} />
              <Route path="/eventos/sinistros/:id/analisar" element={<SinistroAnalise />} />
              <Route path="/eventos/sindicancias" element={<SindicanciasList />} />
              <Route path="/eventos/sindicancias/:id" element={<SindicanciaDetalhe />} />
              <Route path="/eventos/sla" element={<EventosSLADashboard />} />
              <Route path="/eventos/solicitacoes-ia" element={<SolicitacoesIA />} />
              <Route path="/eventos/chat-ia" element={<EventosChatIA />} />
              
              {/* Sindicante (web desktop dentro do AppLayout) */}
              <Route path="/sindicante" element={<SindicanteDashboard />} />
              <Route path="/sindicante/caso/:id" element={<SindicanteCasoDetalhe />} />
              
              {/* Sindicantes (admin) */}
              <Route path="/eventos/sindicantes" element={<SindicantesAdmin />} />
              <Route path="/configuracoes/empresas-sindicancia" element={<Navigate to="/eventos/sindicantes" replace />} />
              <Route path="/eventos/pre-analise" element={<EventosPreAnalise />} />
              
              {/* Assistência 24h */}
              <Route path="/assistencia" element={<AssistenciaDashboard />} />
              <Route path="/assistencia/chamados" element={<ChamadosList />} />
              <Route path="/assistencia/chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="/assistencia/prestadores" element={<PrestadoresList />} />
              <Route path="/assistencia/prestadores/:id" element={<PrestadorDetalhe />} />
              <Route path="/assistencia/prestadores/:id/editar" element={<PrestadorDetalhe />} />
              
              {/* Financeiro */}
              <Route path="/financeiro" element={<FinanceiroDashboard />} />
              <Route path="/financeiro/cobrancas" element={<CobrancasList />} />
              <Route path="/financeiro/cobrancas/:id" element={<CobrancaDetalhe />} />
              <Route path="/financeiro/faturamento" element={<FaturamentoMensal />} />
              <Route path="/financeiro/emissao" element={<EmissaoCobrancas />} />
              <Route path="/financeiro/notificacoes-cobranca" element={<NotificacoesCobranca />} />
              <Route path="/financeiro/contas-pagar" element={<ContasPagar />} />
              <Route path="/financeiro/extrato" element={<Extrato />} />
              <Route path="/financeiro/extratos-bancarios" element={<ExtratosBancarios />} />
              <Route path="/financeiro/extratos/:id" element={<ExtratoDetalhe />} />
              <Route path="/financeiro/contas-bancarias" element={<ContasBancarias />} />
              <Route path="/financeiro/extrato-associado" element={<ExtratoAssociado />} />
              <Route path="/financeiro/configuracoes/comissionamento-externo" element={<ComissionamentoExternoConfig />} />
              <Route path="/financeiro/venda-externa" element={<DashboardVendaExterna />} />
              <Route path="/financeiro/venda-externa/:vendedorId" element={<GestaoContaVendedor />} />
              <Route path="/perfil/conta-corrente" element={<ContaCorrenteVendedor />} />
              
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
              <Route path="/contabilidade/balanco-patrimonial" element={<BalancoPatrimonial />} />
              <Route path="/contabilidade/dre" element={<DRE />} />
              <Route path="/contabilidade/fechamento" element={<Fechamentos />} />
              <Route path="/contabilidade/razao/:contaId" element={<RazaoConta />} />
              
              {/* Jurídico */}
              <Route path="/juridico" element={<JuridicoDashboard />} />
              <Route path="/juridico/casos" element={<CasosJuridicosList />} />
              <Route path="/juridico/casos/:id" element={<CasoJuridicoDetalhe />} />
              <Route path="/juridico/processos" element={<ProcessosList />} />
              <Route path="/juridico/processos/novo" element={<ProcessoForm />} />
              <Route path="/juridico/processos/:id" element={<ProcessoDetalhe />} />
              <Route path="/juridico/processos/:id/editar" element={<ProcessoForm />} />
              <Route path="/juridico/prazos" element={<PrazosControl />} />
              <Route path="/juridico/audiencias" element={<AudienciasAgenda />} />
              <Route path="/juridico/audiencias/:id" element={<AudienciaDetalhe />} />
              <Route path="/juridico/advogados" element={<AdvogadosList />} />
              <Route path="/juridico/advogados/novo" element={<AdvogadoForm />} />
              <Route path="/juridico/advogados/:id" element={<AdvogadoDetalhe />} />
              <Route path="/juridico/advogados/:id/editar" element={<AdvogadoForm />} />
              <Route path="/juridico/consultas" element={<ConsultasUnificadas />} />
              <Route path="/juridico/pareceres" element={<ConsultasJuridicas />} />
              
              {/* RH */}
              <Route path="/rh" element={<RHDashboard />} />
              <Route path="/rh/funcionarios" element={<FuncionariosList />} />
              <Route path="/rh/funcionarios/novo" element={<FuncionarioForm />} />
              <Route path="/rh/funcionarios/:id" element={<FuncionarioDetalhe />} />
              <Route path="/rh/funcionarios/:id/editar" element={<FuncionarioForm />} />
              <Route path="/rh/folha-pagamento" element={<FolhaPagamento />} />
              <Route path="/rh/ponto" element={<ControlePonto />} />
              <Route path="/rh/ferias" element={<FeriasGestao />} />
              <Route path="/rh/organograma" element={<Organograma />} />
              <Route path="/rh/departamentos" element={<DepartamentosCargos />} />
              <Route path="/rh/beneficios" element={<Beneficios />} />
              <Route path="/rh/treinamentos" element={<Treinamentos />} />
              <Route path="/rh/recrutamento" element={<Recrutamento />} />
              <Route path="/rh/jornadas" element={<JornadasProfissionais />} />
              
              {/* Monitoramento */}
              <Route path="/monitoramento/dashboard" element={<DashboardCoordenador />} />
              <Route path="/monitoramento/equipe" element={<Equipe />} />
              <Route path="/monitoramento/instalacoes" element={<InstalacoesList />} />
              <Route path="/monitoramento/instalacoes/:id" element={<InstalacaoDetalhe />} />
              <Route path="/monitoramento/rotas" element={<Rotas />} />
              <Route path="/monitoramento/encaixes" element={<MonitoramentoEncaixes />} />
              <Route path="/monitoramento/gestao-rotas" element={<GestaoRotas />} />
              <Route path="/monitoramento/estoque" element={<Estoque />} />
              <Route path="/monitoramento/mapa" element={<Mapa />} />
              <Route path="/monitoramento/rastreadores" element={<Rastreadores />} />
              <Route path="/monitoramento/config-plataformas" element={<ConfigPlataformas />} />
              <Route path="/monitoramento/alertas" element={<AlertasMonitoramento />} />
              
              <Route path="/monitoramento/calendario" element={<CalendarioInstalacoes />} />
              <Route path="/monitoramento/vistorias" element={<FilaVistorias />} />
              <Route path="/monitoramento/vistorias-manutencao" element={<VistoriasManutencao />} />
              <Route path="/monitoramento/vistorias-instalacoes" element={<VistoriasInstalacoes />} />
              <Route path="/monitoramento/retiradas" element={<RetiradasPage />} />
              <Route path="/monitoramento/realizar-vistoria" element={<Vistorias />} />
              <Route path="/monitoramento/ressalvas-pendentes" element={<RessalvasPendentes />} />
              <Route path="/monitoramento/acionamentos-roubo" element={<AcionamentosRouboFurto />} />
              
              {/* Marketing */}
              <Route path="/marketing" element={<MarketingDashboard />} />
              <Route path="/marketing/campanhas" element={<Campanhas />} />
              <Route path="/marketing/campanhas/nova" element={<CampanhaForm />} />
              <Route path="/marketing/campanhas/:id" element={<CampanhaDetalhe />} />
              <Route path="/marketing/campanhas/:id/editar" element={<CampanhaForm />} />
              <Route path="/marketing/canais" element={<Canais />} />
              <Route path="/marketing/canais/:id" element={<CanalDetalhe />} />
              <Route path="/marketing/indicacoes" element={<Indicacoes />} />
              <Route path="/marketing/utms" element={<UTMs />} />
              <Route path="/marketing/distribuicao" element={<DistribuicaoConfig />} />
              <Route path="/marketing/relatorios" element={<RelatoriosMarketing />} />
              <Route path="/marketing/landing-pages" element={<LandingPages />} />
              <Route path="/marketing/materiais" element={<Materiais />} />
              <Route path="/marketing/comunicacao" element={<ComunicacaoMassa />} />
              <Route path="/marketing/redes-sociais" element={<RedesSociais />} />
              
              {/* Admin */}
              <Route path="/admin/planos" element={<PlanosAdmin />} />
              
              {/* Documentos */}
              <Route path="/documentos" element={<Navigate to="/documentos/gerar" replace />} />
              <Route path="/documentos/gerar" element={<GerarDocumento />} />
              <Route path="/documentos/historico" element={<DocumentosHistorico />} />
              <Route path="/documentos/templates" element={<TemplatesList />} />
              <Route path="/documentos/templates/novo" element={<TemplateForm />} />
              <Route path="/documentos/templates/:id" element={<TemplateForm />} />
              <Route path="/documentos/aditivos" element={<AditivosList />} />
              <Route path="/documentos/aditivos/novo" element={<AditivoForm />} />
              <Route path="/documentos/aditivos/:id" element={<AditivoForm />} />

              {/* Diretoria */}
              <Route path="/diretoria" element={<DiretoriaDashboard />} />
              <Route path="/diretoria/gestao-comercial" element={<GestaoComercial />} />
              <Route path="/diretoria/produtos" element={<Navigate to="/diretoria/gestao-comercial" replace />} />
              <Route path="/diretoria/planos-beneficios" element={<Navigate to="/diretoria/gestao-comercial" replace />} />
              <Route path="/diretoria/precos" element={<Navigate to="/diretoria/gestao-comercial" replace />} />
              <Route path="/diretoria/produtos/:id" element={<ProdutoDetalhe />} />
              <Route path="/diretoria/rateios" element={<RateioSinistros />} />
              <Route path="/diretoria/indicadores" element={<IndicadoresAtuariais />} />
              <Route path="/diretoria/configuracoes" element={<ConfiguracoesSistema />} />
              <Route path="/diretoria/perfis" element={<Navigate to="/configuracoes/usuarios-acessos?tab=visibilidade" replace />} />
              <Route path="/diretoria/usuarios" element={<UsuariosPage />} />
              <Route path="/diretoria/usuarios/:id" element={<UsuarioDetalhePage />} />
              <Route path="/diretoria/usuarios/:id/editar" element={<UsuarioEditarPage />} />
              <Route path="/diretoria/logs" element={<LogsAuditoria />} />
              <Route path="/diretoria/relatorios" element={<RelatoriosGerenciais />} />
              <Route path="/diretoria/faixas-cotas" element={<FaixasCotas />} />
              <Route path="/diretoria/solicitacoes-ia" element={<SolicitacoesIA />} />
              <Route path="/diretoria/campanhas" element={<CampanhasDesconto />} />
              <Route path="/diretoria/fechamento" element={<FechamentoMensal />} />
              <Route path="/diretoria/blacklist" element={<Blacklist />} />
              
              {/* Central de Relatórios */}
              <Route path="/relatorios" element={<RelatoriosCentral />} />
              
              {/* Oficinas */}
              <Route path="/oficinas" element={<Oficinas />} />
              <Route path="/oficinas/auto-centers" element={<AutoCenters />} />
              <Route path="/oficinas/relatorios" element={<OficinasRelatorios />} />
              
              <Route path="/oficina/credenciadas" element={<OficinasList />} />
              <Route path="/oficina/credenciadas/:id" element={<OficinaDetalhe />} />
              <Route path="/oficina/ordens-servico" element={<OrdensServicoList />} />
              <Route path="/oficina/ordens-servico/:id" element={<OrdemServicoDetalhePage />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/oficinas/ordens/:id" element={<OrdemServicoDetalhe />} />
              
              {/* Ouvidoria ERP */}
              <Route path="/ouvidoria" element={<OuvidoriaDashboard />} />
              <Route path="/ouvidoria/fila" element={<OuvidoriaFila />} />
              <Route path="/ouvidoria/manifestacoes" element={<OuvidoriaFila />} />
              <Route path="/ouvidoria/nova" element={<NovaManifestacao />} />
              <Route path="/ouvidoria/:id" element={<OuvidoriaDetalhe />} />
              
              {/* Config */}
              {/* Configurações - Estrutura modular completa */}
              <Route path="/configuracoes" element={<ConfiguracoesLayout />}>
                <Route index element={<Navigate to="meu-perfil" replace />} />
                <Route path="meu-perfil" element={<MeuPerfil />} />
                <Route path="seguranca" element={<Seguranca />} />
                <Route path="notificacoes" element={<NotificacoesConfig />} />
                <Route path="usuarios-acessos" element={<UsuariosAcessos />} />
                <Route path="usuarios" element={<Navigate to="/configuracoes/usuarios-acessos" replace />} />
                <Route path="usuarios/novo" element={<UsuarioForm />} />
                <Route path="usuarios/:id" element={<UsuarioForm />} />
                <Route path="perfis" element={<Navigate to="/configuracoes/usuarios-acessos?tab=perfis" replace />} />
                <Route path="logs" element={<Navigate to="/configuracoes/usuarios-acessos?tab=logs" replace />} />
                
                <Route path="integracoes" element={<Integracoes />} />
                <Route path="integracoes/whatsapp" element={<IntegracaoWhatsApp />} />
                <Route path="integracoes/api-keys" element={<IntegracaoApiKeys />} />
                <Route path="integracoes/fontes-leads" element={<IntegracaoFontesLeads />} />
                <Route path="integracoes/sga-hinova" element={<IntegracaoSGAHinova />} />
                <Route path="rateio" element={<RateioConfig />} />
                <Route path="sistema" element={<Sistema />} />
              </Route>
            </Route>
            
            {/* Associate App Routes */}
            <Route path="/app/install" element={<AppInstall />} />
            <Route path="/app/login" element={<AppLogin />} />
            <Route path="/app/criar-senha" element={<AppCriarSenha />} />
            <Route path="/app/forgot-password" element={<AppForgotPassword />} />
            <Route path="/app/verificar-codigo" element={<AppVerificarCodigo />} />
            <Route path="/app/redefinir-senha" element={<AppRedefinirSenha />} />
            <Route path="/app/veiculo-reprovado" element={<VeiculoReprovado />} />
            <Route element={<AssociadoAppLayout />}>
              <Route path="/app/home" element={<AppHome />} />
              <Route path="/app/boletos" element={<MeusBoletos />} />
              <Route path="/app/boletos/:id" element={<AppBoletoDetalhe />} />
              <Route path="/app/rastreamento" element={<AppRastreamento />} />
              <Route path="/app/rastreamento/historico" element={<AppRastreamentoHistorico />} />
              <Route path="/app/assistencia" element={<SolicitarAssistencia />} />
              <Route path="/app/assistencia/nova" element={<AppAssistenciaNova />} />
              <Route path="/app/assistencia/historico" element={<HistoricoChamados />} />
              <Route path="/app/assistencia/:id" element={<AcompanharChamado />} />
              <Route path="/app/sinistros" element={<AppSinistros />} />
              <Route path="/app/sinistros/novo" element={<NovoSinistro />} />
              <Route path="/app/sinistros/:id" element={<AppSinistroDetalhe />} />
              <Route path="/app/perfil" element={<AppPerfil />} />
              <Route path="/app/plano" element={<AppPlano />} />
              <Route path="/app/configuracoes" element={<AppConfiguracoes />} />
              <Route path="/app/documentos" element={<AppDocumentos />} />
              <Route path="/app/notificacoes" element={<AppNotificacoes />} />
              <Route path="/app/revistoria" element={<Revistoria />} />
              <Route path="/app/chat" element={<AppChat />} />
              
              {/* Ouvidoria App */}
              <Route path="/app/ouvidoria" element={<OuvidoriaMenu />} />
              <Route path="/app/ouvidoria/nova" element={<OuvidoriaNova />} />
              <Route path="/app/ouvidoria/lista" element={<OuvidoriaLista />} />
              <Route path="/app/ouvidoria/:id" element={<OuvidoriaDetalheApp />} />
            </Route>
            <Route path="/app" element={<Navigate to="/app/home" replace />} />
            
            {/* Installer App Routes */}
            <Route path="/instalador/login" element={<InstaladorLogin />} />
            <Route path="/instalador/instalar" element={<InstaladorInstalar />} />
            <Route element={<InstaladorLayout />}>
              <Route path="/instalador" element={<InstaladorHome />} />
              <Route path="/instalador/tarefas" element={<InstaladorTarefas />} />
              <Route path="/instalador/instalacao/:id" element={<InstaladorChecklist />} />
              <Route path="/instalador/vistoria/:id" element={<ExecutarVistoriaCompleta />} />
              <Route path="/instalador/manutencao/:id" element={<ExecutarManutencao />} />
              <Route path="/instalador/retirada/:id" element={<ExecutarRetirada />} />
              <Route path="/instalador/mapa" element={<InstaladorMapa />} />
              <Route path="/instalador/perfil" element={<InstaladorPerfil />} />
              <Route path="/instalador/configuracoes" element={<InstaladorConfiguracoes />} />
              <Route path="/instalador/notificacoes" element={<InstaladorNotificacoes />} />
              <Route path="/instalador/ajuda" element={<InstaladorAjuda />} />
            </Route>
            
            
            {/* Regulador App Routes */}
            <Route element={<ReguladorLayout />}>
              <Route path="/regulador" element={<ReguladorHome />} />
              <Route path="/regulador/vistorias" element={<ReguladorVistorias />} />
              <Route path="/regulador/vistoria/:id" element={<ExecutarVistoriaEvento />} />
              <Route path="/regulador/oficina" element={<ReguladorOficina />} />
              <Route path="/regulador/perfil" element={<InstaladorPerfil />} />
            </Route>

            {/* Analista de Eventos Routes */}
            <Route element={<AnalistaEventosLayout />}>
              <Route path="/analista-eventos" element={<AnalistaEventosHome />} />
              <Route path="/analista-eventos/fila" element={<AnalistaEventosFila />} />
              <Route path="/analista-eventos/evento/:id" element={<EventoAnaliseDetalhe />} />
              <Route path="/analista-eventos/perfil" element={<InstaladorPerfil />} />
            </Route>

            {/* Vistoriador redirects to Instalador (unified app) */}
            <Route path="/vistoriador/*" element={<Navigate to="/instalador" replace />} />
            
            {/* Acesso Negado */}
            <Route path="/acesso-negado" element={<AcessoNegado />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AppErrorBoundary>
          </TooltipProvider>
        </AssociadoProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
