// App Root
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
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
import { AgenciaLayout } from "@/components/layout/AgenciaLayout";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";
import { VendasNotificationListener } from "./components/notifications/VendasNotificationListener";
import { Loader2 } from "lucide-react";

// Global loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

// ============================================================
// Lazy-loaded page components (route-based code splitting)
// ============================================================

// Public Pages
const AssociadoVistoria = lazy(() => import("./pages/public/AssociadoVistoria"));
const LandingPlanos = lazy(() => import("./pages/public/LandingPlanos"));
const PrestadorInstalacao = lazy(() => import("./pages/public/PrestadorInstalacao"));
const VistoriaPrestador = lazy(() => import("./pages/public/VistoriaPrestador"));
const VistoriaPublica = lazy(() => import("./pages/public/VistoriaPublica"));
const AssumirInstalacaoVistoria = lazy(() => import("./pages/public/AssumirInstalacaoVistoria"));
const CotacaoPublicaPage = lazy(() => import("./pages/public/CotacaoPublica"));
const CotacaoPublicaCompleta = lazy(() => import("./pages/public/CotacaoPublicaCompleta"));
const CotacaoContratacao = lazy(() => import("./pages/public/CotacaoContratacao"));
const AcompanhamentoProposta = lazy(() => import("./pages/public/AcompanhamentoProposta"));
const TrackingAssistencia = lazy(() => import("./pages/public/TrackingAssistencia"));
const UploadDocumentosSinistro = lazy(() => import("./pages/public/UploadDocumentosSinistro"));
const EventoColisao = lazy(() => import("./pages/public/EventoColisao"));
const EventoPosAprovacao = lazy(() => import("./pages/public/EventoPosAprovacao"));
const RetiradaVeiculo = lazy(() => import("./pages/public/RetiradaVeiculo"));
const SubstituicaoPublica = lazy(() => import("./pages/public/SubstituicaoPublica"));
const AcompanhamentoReboquePublico = lazy(() => import("./pages/public/AcompanhamentoReboquePublico"));
const PortalTerceiro = lazy(() => import("./pages/public/PortalTerceiro"));

// Auth Pages
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/auth/AuthCallback"));
const DefinirSenha = lazy(() => import("./pages/auth/DefinirSenha"));
const Login = lazy(() => import("./pages/auth/Login"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Internal System Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));

const NotFound = lazy(() => import("./pages/NotFound"));
const AcessoNegado = lazy(() => import("./pages/AcessoNegado"));
const ReagendarVistoria = lazy(() => import("./pages/ReagendarVistoria"));
const AvaliarAssistencia = lazy(() => import("./pages/avaliar/AvaliarAssistencia"));
const DespachoReboquistaPublico = lazy(() => import("./pages/assistencia/DespachoReboquistaPublico"));

// Vendas
const LeadsUnificado = lazy(() => import("./pages/vendas/LeadsUnificado"));
const LeadDetalhe = lazy(() => import("./pages/vendas/LeadDetalhe"));
const LeadEditar = lazy(() => import("./pages/vendas/LeadEditar"));
const AtivacoesList = lazy(() => import("./pages/vendas/AtivacoesList"));
const Cotacoes = lazy(() => import("./pages/vendas/Cotacoes"));
const CotacaoDetalhe = lazy(() => import("./pages/vendas/CotacaoDetalhe"));
const Contratos = lazy(() => import("./pages/vendas/Contratos"));
const Propostas = lazy(() => import("./pages/vendas/Propostas"));
const Consultores = lazy(() => import("./pages/vendas/Consultores"));
const RelatoriosVendas = lazy(() => import("./pages/vendas/RelatoriosVendas"));
const Vendedores = lazy(() => import("./pages/vendas/Vendedores"));
const AprovacoesFipeMenor = lazy(() => import("./pages/vendas/AprovacoesFipeMenor"));
const VendedorHistorico = lazy(() => import("./pages/vendas/VendedorHistorico"));
const DistribuicaoConfig = lazy(() => import("./pages/vendas/DistribuicaoConfig"));
const PlanosBeneficios = lazy(() => import("./pages/vendas/PlanosBeneficios"));

// Cadastro
const Associados = lazy(() => import("./pages/cadastro/Associados"));
const SubstituicaoVeiculoPage = lazy(() => import("./pages/cadastro/SubstituicaoVeiculoPage"));
const SubstituicoesPendentesPage = lazy(() => import("./pages/cadastro/SubstituicoesPendentesPage"));
const SubstituicaoDetalhePage = lazy(() => import("./pages/cadastro/SubstituicaoDetalhePage"));
const AssociadoDetalhe = lazy(() => import("./pages/cadastro/AssociadoDetalhe"));
const Veiculos = lazy(() => import("./pages/cadastro/Veiculos"));
const FilaDocumentos = lazy(() => import("./pages/cadastro/FilaDocumentos"));
const AnaliseDocumento = lazy(() => import("./pages/cadastro/AnaliseDocumento"));
const AnaliseVistoria = lazy(() => import("./pages/cadastro/AnaliseVistoria"));
const PropostasPendentes = lazy(() => import("./pages/cadastro/PropostasPendentes"));
const PropostaAnalise = lazy(() => import("./pages/cadastro/PropostaAnalise"));
const VistoriaCompletaAnalise = lazy(() => import("./pages/cadastro/VistoriaCompletaAnalise"));
const RecusasInstalador = lazy(() => import("./pages/cadastro/RecusasInstalador"));
const BaseAntiga = lazy(() => import("./pages/cadastro/BaseAntiga"));
const ProcessosOperacionais = lazy(() => import("./pages/cadastro/ProcessosOperacionais"));

// Eventos
const SinistrosList = lazy(() => import("./pages/eventos/SinistrosList"));
const EventosPreAnalise = lazy(() => import("./pages/eventos/EventosPreAnalise"));
const SinistroAnalise = lazy(() => import("./pages/eventos/SinistroAnalise"));
const SinistroDetalhe = lazy(() => import("./pages/eventos/SinistroDetalhe"));
const SinistrosDashboard = lazy(() => import("./pages/eventos/SinistrosDashboard"));
const EventosSLADashboard = lazy(() => import("./pages/eventos/EventosSLADashboard"));
const SindicanciasList = lazy(() => import("./pages/eventos/SindicanciasList"));
const SindicanciaDetalhe = lazy(() => import("./pages/eventos/SindicanciaDetalhe"));
const SindicanteDashboard = lazy(() => import("./pages/sindicante/SindicanteDashboard"));
const SindicanteCasoDetalhe = lazy(() => import("./pages/sindicante/SindicanteCasoDetalhe"));
const SindicantesAdmin = lazy(() => import("./pages/eventos/SindicantesAdmin"));
const EventosChatIA = lazy(() => import("./pages/eventos/EventosChatIA"));

// Monitoramento
const InstalacaoDetalhe = lazy(() => import("./pages/monitoramento/InstalacaoDetalhe"));
const InstalacoesList = lazy(() => import("./pages/monitoramento/InstalacoesList"));
const Rotas = lazy(() => import("./pages/monitoramento/Rotas"));
const Rastreadores = lazy(() => import("./pages/monitoramento/Rastreadores"));
const AlertasMonitoramento = lazy(() => import("./pages/monitoramento/AlertasMonitoramento"));
const Mapa = lazy(() => import("./pages/monitoramento/Mapa"));
const CalendarioInstalacoes = lazy(() => import("./pages/monitoramento/CalendarioInstalacoes"));
const VistoriasInstalacoesMon = lazy(() => import("./pages/monitoramento/VistoriasInstalacoesMon"));
const DashboardCoordenador = lazy(() => import("./pages/monitoramento/DashboardCoordenador"));
const Equipe = lazy(() => import("./pages/monitoramento/Equipe"));
const RessalvasPendentes = lazy(() => import("./pages/monitoramento/RessalvasPendentes"));
const AprovacaoAssociadosMonitoramento = lazy(() => import("./pages/monitoramento/AcionamentosRouboFurto"));
const AprovacaoInstalacaoDetalhe = lazy(() => import("./pages/monitoramento/AprovacaoInstalacaoDetalhe"));
const ImprevistosPainel = lazy(() => import("./pages/monitoramento/ImprevistosPainel"));
const PrestadoresParceiros = lazy(() => import("./pages/monitoramento/PrestadoresParceiros"));

// Oficinas
const Oficinas = lazy(() => import("./pages/oficinas/Oficinas"));
const AutoCenters = lazy(() => import("./pages/oficinas/AutoCenters"));
const OficinasRelatorios = lazy(() => import("./pages/oficinas/OficinasRelatorios"));
const OrdensServico = lazy(() => import("./pages/oficinas/OrdensServico"));

// Configurações
const MeuPerfil = lazy(() => import("./pages/configuracoes/MeuPerfil"));
const Seguranca = lazy(() => import("./pages/configuracoes/Seguranca"));
const NotificacoesConfig = lazy(() => import("./pages/configuracoes/Notificacoes"));
const Usuarios = lazy(() => import("./pages/configuracoes/Usuarios"));
const UsuarioForm = lazy(() => import("./pages/configuracoes/UsuarioForm"));
const Perfis = lazy(() => import("./pages/configuracoes/Perfis"));
const Integracoes = lazy(() => import("./pages/configuracoes/Integracoes"));
const IntegracaoWhatsApp = lazy(() => import("./pages/configuracoes/IntegracaoWhatsApp"));
const IntegracaoIA = lazy(() => import("./pages/configuracoes/IntegracaoIA"));
const IntegracaoApiKeys = lazy(() => import("./pages/configuracoes/IntegracaoApiKeys"));
const IntegracaoFontesLeads = lazy(() => import("./pages/configuracoes/IntegracaoFontesLeads"));
const IntegracaoSGAHinova = lazy(() => import("./pages/configuracoes/IntegracaoSGAHinova"));
const IntegracaoHinovaMapeamentos = lazy(() => import("./pages/configuracoes/IntegracaoHinovaMapeamentos"));
const PlanosSGA = lazy(() => import("./pages/configuracoes/PlanosSGA"));
const Sistema = lazy(() => import("./pages/configuracoes/Sistema"));
const Logs = lazy(() => import("./pages/configuracoes/Logs"));
const GradesComissao = lazy(() => import("./pages/configuracoes/GradesComissao"));
const GradeComissaoForm = lazy(() => import("./pages/configuracoes/GradeComissaoForm"));
const AtribuicaoGrades = lazy(() => import("./pages/configuracoes/AtribuicaoGrades"));
const ComissoesDashboard = lazy(() => import("./pages/comissoes/Dashboard"));
const ComissoesGrades = lazy(() => import("./pages/comissoes/Grades"));
const ComissoesGradeForm = lazy(() => import("./pages/comissoes/GradeForm"));
const ComissoesAtribuicao = lazy(() => import("./pages/comissoes/Atribuicao"));
const ComissoesRelatorio = lazy(() => import("./pages/comissoes/Relatorio"));
const ComissoesPagamentos = lazy(() => import("./pages/comissoes/Pagamentos"));
// const ComissoesContaCorrente removido — rota deslocada para /comissoes
const ComissionamentoPlano = lazy(() => import("./pages/configuracoes/ComissionamentoPlano"));
const AgenteConsultorIA = lazy(() => import("./pages/configuracoes/AgenteConsultorIA"));
const ApiDocumentation = lazy(() => import("./pages/configuracoes/ApiDocumentation"));
const RateioConfig = lazy(() => import("./pages/configuracoes/RateioConfig"));
const UsuariosAcessos = lazy(() => import("./pages/configuracoes/UsuariosAcessos"));
const Telemetria = lazy(() => import("./pages/admin/Telemetria"));
const AutentiqueBiometriasPendentes = lazy(() => import("./pages/admin/AutentiqueBiometriasPendentes"));

// Assistência
const AssistenciaDashboard = lazy(() => import("./pages/assistencia/AssistenciaDashboard"));
const ChamadosList = lazy(() => import("./pages/assistencia/ChamadosList"));
const ChamadoDetalhe = lazy(() => import("./pages/assistencia/ChamadoDetalhe"));
const PrestadoresList = lazy(() => import("./pages/assistencia/PrestadoresList"));
const PrestadorDetalhe = lazy(() => import("./pages/assistencia/PrestadorDetalhe"));

// Financeiro
const FinanceiroDashboard = lazy(() => import("./pages/financeiro/FinanceiroDashboard"));
const CobrancasLayout = lazy(() => import("./pages/financeiro/CobrancasLayout"));
const CobrancasList = lazy(() => import("./pages/financeiro/CobrancasList"));
const CobrancaDetalhe = lazy(() => import("./pages/financeiro/CobrancaDetalhe"));
const FaturamentoMensal = lazy(() => import("./pages/financeiro/FaturamentoMensal"));
const ReguaPage = lazy(() => import("./pages/financeiro/ReguaPage"));
const ContasPagar = lazy(() => import("./pages/financeiro/ContasPagar"));
const Extrato = lazy(() => import("./pages/financeiro/Extrato"));
// ExtratosBancarios removido — consolidado em /financeiro/extrato
const ExtratoDetalhe = lazy(() => import("./pages/financeiro/ExtratoDetalhe"));
const ContasBancarias = lazy(() => import("./pages/financeiro/ContasBancarias"));
const ComissionamentoExternoConfig = lazy(() => import("./pages/financeiro/ComissionamentoExternoConfig"));
const ContaCorrenteVendedor = lazy(() => import("./pages/financeiro/ContaCorrenteVendedor"));
const GestaoContaVendedor = lazy(() => import("./pages/financeiro/GestaoContaVendedor"));
const DashboardVendaExterna = lazy(() => import("./pages/financeiro/DashboardVendaExterna"));

// Cobrança — apenas Régua continua roteada (dentro de /financeiro/cobrancas/regua via ReguaPage)
const TrocaTitularidade = lazy(() => import("./pages/cobranca/TrocaTitularidade"));
const AprovacoesTroca = lazy(() => import("./pages/monitoramento/AprovacoesTroca"));
const LiberacoesAutoVistoria = lazy(() => import("./pages/monitoramento/LiberacoesAutoVistoria"));

// Agência
const AgenciaDashboard = lazy(() => import("./pages/agencia/AgenciaDashboard"));
const DadosPagamento = lazy(() => import("./pages/agencia/DadosPagamento"));

// Contabilidade
const ContabilidadeDashboard = lazy(() => import("./pages/contabilidade/ContabilidadeDashboard"));
const PlanoContas = lazy(() => import("./pages/contabilidade/PlanoContas"));
const LancamentosList = lazy(() => import("./pages/contabilidade/LancamentosList"));
const NovoLancamento = lazy(() => import("./pages/contabilidade/NovoLancamento"));
const LancamentoDetalhe = lazy(() => import("./pages/contabilidade/LancamentoDetalhe"));
const Balancete = lazy(() => import("./pages/contabilidade/Balancete"));
const DRE = lazy(() => import("./pages/contabilidade/DRE"));
const Fechamentos = lazy(() => import("./pages/contabilidade/Fechamentos"));
const RazaoConta = lazy(() => import("./pages/contabilidade/RazaoConta"));
const BalancoPatrimonial = lazy(() => import("./pages/contabilidade/BalancoPatrimonial"));

// Jurídico
const JuridicoDashboard = lazy(() => import("./pages/juridico/JuridicoDashboard"));
const ProcessosList = lazy(() => import("./pages/juridico/ProcessosList"));
const ProcessoDetalhe = lazy(() => import("./pages/juridico/ProcessoDetalhe"));
const ProcessoForm = lazy(() => import("./pages/juridico/ProcessoForm"));
const PrazosControl = lazy(() => import("./pages/juridico/PrazosControl"));
const AudienciasAgenda = lazy(() => import("./pages/juridico/AudienciasAgenda"));
const AudienciaDetalhe = lazy(() => import("./pages/juridico/AudienciaDetalhe"));
const AdvogadosList = lazy(() => import("./pages/juridico/AdvogadosList"));
const AdvogadoForm = lazy(() => import("./pages/juridico/AdvogadoForm"));
const AdvogadoDetalhe = lazy(() => import("./pages/juridico/AdvogadoDetalhe"));
const ConsultasJuridicas = lazy(() => import("./pages/juridico/ConsultasJuridicas"));
const ConsultasUnificadas = lazy(() => import("./pages/juridico/ConsultasUnificadas"));
const CasosJuridicosList = lazy(() => import("./pages/juridico/CasosJuridicosList"));
const CasoJuridicoDetalhe = lazy(() => import("./pages/juridico/CasoJuridicoDetalhe"));

// RH
const RHDashboard = lazy(() => import("./pages/rh/RHDashboard"));
const FuncionariosList = lazy(() => import("./pages/rh/FuncionariosList"));
const FuncionarioDetalhe = lazy(() => import("./pages/rh/FuncionarioDetalhe"));
const FuncionarioForm = lazy(() => import("./pages/rh/FuncionarioForm"));
const ControlePonto = lazy(() => import("./pages/rh/ControlePonto"));
const FeriasGestao = lazy(() => import("./pages/rh/FeriasGestao"));
const Organograma = lazy(() => import("./pages/rh/Organograma"));
const DepartamentosCargos = lazy(() => import("./pages/rh/DepartamentosCargos"));
const Beneficios = lazy(() => import("./pages/rh/Beneficios"));
const FolhaPagamento = lazy(() => import("./pages/rh/FolhaPagamento"));
const Treinamentos = lazy(() => import("./pages/rh/Treinamentos"));
const Recrutamento = lazy(() => import("./pages/rh/Recrutamento"));
const JornadasProfissionais = lazy(() => import("./pages/rh/JornadasProfissionais"));

// Marketing
const MarketingDashboard = lazy(() => import("./pages/marketing/MarketingDashboard"));
const Campanhas = lazy(() => import("./pages/marketing/Campanhas"));
const CampanhaDetalhe = lazy(() => import("./pages/marketing/CampanhaDetalhe"));
const CampanhaForm = lazy(() => import("./pages/marketing/CampanhaForm"));
const Canais = lazy(() => import("./pages/marketing/Canais"));
const CanalDetalhe = lazy(() => import("./pages/marketing/CanalDetalhe"));
const Indicacoes = lazy(() => import("./pages/marketing/Indicacoes"));
const UTMs = lazy(() => import("./pages/marketing/UTMs"));
const RelatoriosMarketing = lazy(() => import("./pages/marketing/RelatoriosMarketing"));
const LandingPages = lazy(() => import("./pages/marketing/LandingPages"));
const Materiais = lazy(() => import("./pages/marketing/Materiais"));
const ComunicacaoMassa = lazy(() => import("./pages/marketing/ComunicacaoMassa"));
const RedesSociais = lazy(() => import("./pages/marketing/RedesSociais"));
const OrigensLead = lazy(() => import("./pages/marketing/OrigensLead"));

// Documentos
const TemplatesList = lazy(() => import("./pages/documentos/TemplatesList"));
const GerarDocumento = lazy(() => import("./pages/documentos/GerarDocumento"));
const DocumentosHistorico = lazy(() => import("./pages/documentos/DocumentosHistorico"));
const TemplateForm = lazy(() => import("./pages/documentos/TemplateForm"));
const AditivosList = lazy(() => import("./pages/documentos/Aditivos"));
const AditivoForm = lazy(() => import("./pages/documentos/AditivoForm"));
const CotacaoPdfConfig = lazy(() => import("./pages/documentos/CotacaoPdfConfig"));

// Diretoria
const DiretoriaDashboard = lazy(() => import("./pages/diretoria/DiretoriaDashboard"));
const ProdutoDetalhe = lazy(() => import("./pages/diretoria/ProdutoDetalhe"));
const RateioSinistros = lazy(() => import("./pages/diretoria/RateioSinistros"));
const GestaoComercial = lazy(() => import("./pages/diretoria/GestaoComercial"));
const IndicadoresAtuariais = lazy(() => import("./pages/diretoria/IndicadoresAtuariais"));
const ConfiguracoesSistema = lazy(() => import("./pages/diretoria/Configuracoes"));
const UsuariosPage = lazy(() => import("./pages/diretoria/Usuarios"));
const UsuarioDetalhePage = lazy(() => import("./pages/diretoria/UsuarioDetalhe"));
const UsuarioEditarPage = lazy(() => import("./pages/diretoria/UsuarioEditar"));
const LogsAuditoria = lazy(() => import("./pages/diretoria/LogsAuditoria"));
const RelatoriosGerenciais = lazy(() => import("./pages/diretoria/RelatoriosGerenciais"));
const RelatosErros = lazy(() => import("./pages/diretoria/RelatosErros"));
const FaixasCotas = lazy(() => import("./pages/diretoria/FaixasCotas"));
const SolicitacoesIA = lazy(() => import("./pages/diretoria/SolicitacoesIA"));
const CampanhasDesconto = lazy(() => import("./pages/diretoria/CampanhasDesconto"));
const FechamentoMensal = lazy(() => import("./pages/diretoria/FechamentoMensal"));
const Blacklist = lazy(() => import("./pages/diretoria/Blacklist"));
const AprovacoesDiretoriaPage = lazy(() => import("./pages/diretoria/AprovacoesDiretoria"));
const SaudeAtivacao = lazy(() => import("./pages/diretoria/SaudeAtivacao"));

// Auditoria
const AuditoriaVendedores = lazy(() => import("./pages/auditoria/AuditoriaVendedores"));

// Central de Relatórios
const RelatoriosCentral = lazy(() => import("./pages/relatorios/RelatoriosCentral"));

// Associate App Pages
const AppLogin = lazy(() => import("./pages/app/AppLogin"));
const AppCriarSenha = lazy(() => import("./pages/app/AppCriarSenha"));
const AppForgotPassword = lazy(() => import("./pages/app/AppForgotPassword"));
const AppVerificarCodigo = lazy(() => import("./pages/app/AppVerificarCodigo"));
const AppRedefinirSenha = lazy(() => import("./pages/app/AppRedefinirSenha"));
const AppHome = lazy(() => import("./pages/app/AppHome"));
const MeusBoletos = lazy(() => import("./pages/app/MeusBoletos"));
const AppBoletoDetalhe = lazy(() => import("./pages/app/AppBoletoDetalhe"));
const AppRastreamento = lazy(() => import("./pages/app/AppRastreamento"));
const AppRastreamentoHistorico = lazy(() => import("./pages/app/AppRastreamentoHistorico"));
const SolicitarAssistencia = lazy(() => import("./pages/app/SolicitarAssistencia"));
const HistoricoChamados = lazy(() => import("./pages/app/HistoricoChamados"));
const VeiculoReprovado = lazy(() => import("./pages/app/VeiculoReprovado"));
const AppAssistenciaNova = lazy(() => import("./pages/app/AppAssistenciaNova"));
const AppSinistros = lazy(() => import("./pages/app/AppSinistros"));
const NovoSinistro = lazy(() => import("./pages/app/NovoSinistro"));
const AppSinistroDetalhe = lazy(() => import("./pages/app/SinistroDetalhe"));
const AppPerfil = lazy(() => import("./pages/app/AppPerfil"));
const AppConfiguracoes = lazy(() => import("./pages/app/AppConfiguracoes"));
const AppDocumentos = lazy(() => import("./pages/app/Documentos"));
const AppNotificacoes = lazy(() => import("./pages/app/AppNotificacoes"));
const AppPlano = lazy(() => import("./pages/app/AppPlano"));
const AppInstall = lazy(() => import("./pages/app/AppInstall"));
const AppChat = lazy(() => import("./pages/app/AppChat"));
const Revistoria = lazy(() => import("./pages/app/Revistoria"));
const AcompanharChamado = lazy(() => import("./pages/app/AcompanharChamado"));

// App Ouvidoria
const OuvidoriaMenu = lazy(() => import("./pages/app/OuvidoriaMenu"));
const OuvidoriaNova = lazy(() => import("./pages/app/OuvidoriaNova"));
const OuvidoriaLista = lazy(() => import("./pages/app/OuvidoriaLista"));
const OuvidoriaDetalheApp = lazy(() => import("./pages/app/OuvidoriaDetalhe"));

// Public Ouvidoria (kept)
const CanalDenuncia = lazy(() => import("./pages/ouvidoria/CanalDenuncia"));
const ConsultaProtocolo = lazy(() => import("./pages/ouvidoria/ConsultaProtocolo"));
const PesquisaSatisfacao = lazy(() => import("./pages/ouvidoria/PesquisaSatisfacao"));

// Installer App Pages
const InstaladorLogin = lazy(() => import("./pages/instalador/InstaladorLogin"));
const InstaladorHome = lazy(() => import("./pages/instalador/InstaladorHome"));
const InstaladorChecklist = lazy(() => import("./pages/instalador/InstaladorChecklist"));
const InstaladorInstalar = lazy(() => import("./pages/instalador/InstaladorInstalar"));
const InstaladorConfiguracoes = lazy(() => import("./pages/instalador/InstaladorConfiguracoes"));
const InstaladorNotificacoes = lazy(() => import("./pages/instalador/InstaladorNotificacoes"));
const InstaladorAjuda = lazy(() => import("./pages/instalador/InstaladorAjuda"));
const InstaladorTarefas = lazy(() => import("./pages/instalador/InstaladorTarefas"));
const InstaladorMapa = lazy(() => import("./pages/instalador/InstaladorMapa"));
const InstaladorPerfil = lazy(() => import("./pages/instalador/InstaladorPerfil"));
const ExecutarVistoriaCompleta = lazy(() => import("./pages/instalador/ExecutarVistoriaCompleta"));
const ExecutarManutencao = lazy(() => import("./pages/instalador/ExecutarManutencao"));
const ExecutarRetirada = lazy(() => import("./pages/instalador/ExecutarRetirada"));
const SincronizacaoPage = lazy(() => import("./pages/profissional/SincronizacaoPage"));

// Regulador
const ReguladorHome = lazy(() => import("./pages/regulador/ReguladorHome"));
const ReguladorVistorias = lazy(() => import("./pages/regulador/ReguladorVistorias"));
const ExecutarVistoriaEvento = lazy(() => import("./pages/regulador/ExecutarVistoriaEvento"));
const ReguladorOficina = lazy(() => import("./pages/regulador/ReguladorOficina"));

// Analista Eventos
const AnalistaEventosHome = lazy(() => import("./pages/analista-eventos/AnalistaEventosHome"));
const AnalistaEventosFila = lazy(() => import("./pages/analista-eventos/AnalistaEventosFila"));
const EventoAnaliseDetalhe = lazy(() => import("./pages/analista-eventos/EventoAnaliseDetalhe"));

// ConfiguracoesLayout needs special handling (named export)
const LazyConfiguracoesLayout = lazy(() => import("./pages/configuracoes/ConfiguracoesLayout").then(m => ({ default: m.ConfiguracoesLayout })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente para redirect de contrato com state
const ContratoRedirect = () => {
  const { id } = useParams();
  return <Navigate to="/vendas/contratos" state={{ openContrato: id }} replace />;
};

// Redirects de rotas antigas preservando o :id
const RedirectGradeComissao = () => {
  const { id } = useParams();
  return <Navigate to={`/comissoes/grades/${id}`} replace />;
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
                <Suspense fallback={<PageLoader />}>
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
            
            {/* Public Substitution Page */}
            <Route path="/substituicao/:token" element={<SubstituicaoPublica />} />
            
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
            
            {/* Public Prestador Instalação */}
            <Route path="/prestador/instalacao/:token" element={<PrestadorInstalacao />} />
            
            {/* Public Vistoria Prestador */}
            <Route path="/vistoria-prestador/:token" element={<VistoriaPrestador />} />
            <Route path="/vistoria/:token" element={<VistoriaPublica />} />
            <Route path="/vistoria/:token/assumir-instalacao" element={<AssumirInstalacaoVistoria />} />
            {/* Public Portal Terceiro */}
            <Route path="/terceiro/:token" element={<PortalTerceiro />} />
            
            {/* Public Reagendamento Vistoria */}
            <Route path="/reagendar/:token" element={<ReagendarVistoria />} />
            
            {/* Public Landing Page Planos */}
            <Route path="/planos" element={<LandingPlanos />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected routes with internal layout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              
              {/* Vendas — VendasNotificationListener montado por rota (Fase 5) */}
              <Route path="/vendas" element={<Navigate to="/vendas/leads" replace />} />
              <Route path="/vendas/dashboard" element={<Navigate to="/vendas/leads" replace />} />
              <Route path="/vendas/leads" element={<><VendasNotificationListener /><LeadsUnificado /></>} />
              <Route path="/vendas/leads/:id" element={<><VendasNotificationListener /><LeadDetalhe /></>} />
              <Route path="/vendas/leads/:id/editar" element={<LeadEditar />} />
              <Route path="/vendas/ativacoes" element={<><VendasNotificationListener /><AtivacoesList /></>} />
              <Route path="/vendas/cotacoes" element={<><VendasNotificationListener /><Cotacoes /></>} />
              <Route path="/vendas/cotacoes/:id" element={<CotacaoDetalhe />} />
              <Route path="/vendas/contratos" element={<><VendasNotificationListener /><Contratos /></>} />
              <Route path="/vendas/equipe-comercial" element={<Propostas />} />
              <Route path="/vendas/consultores" element={<Consultores />} />
              <Route path="/vendas/contratos/:id" element={<ContratoRedirect />} />
              <Route path="/vendas/planos-beneficios" element={<PlanosBeneficios />} />
              <Route path="/vendas/vendedores" element={<Vendedores />} />
              <Route path="/vendas/vendedores/:id" element={<VendedorHistorico />} />
              <Route path="/vendas/aprovacoes-fipe" element={<AprovacoesFipeMenor />} />
              <Route path="/vendas/relatorios" element={<RelatoriosVendas />} />
              <Route path="/vendas/substituicao/:associadoId" element={<SubstituicaoVeiculoPage />} />
              <Route path="/aprovacoes-elegibilidade" element={<AprovacoesFipeMenor />} />
              
              
              {/* Auditoria */}
              <Route path="/auditoria/vendedores" element={<AuditoriaVendedores />} />
              
              {/* Cadastro */}
              <Route path="/cadastro/associados" element={<Associados />} />
              <Route path="/cadastro/associados/:id" element={<AssociadoDetalhe />} />
              <Route path="/cadastro/associados/:associadoId/substituicao" element={<SubstituicaoVeiculoPage />} />
              <Route path="/cadastro/substituicoes" element={<SubstituicoesPendentesPage />} />
              <Route path="/cadastro/substituicoes/:id" element={<SubstituicaoDetalhePage />} />
              <Route path="/cadastro/veiculos" element={<Veiculos />} />
              <Route path="/cadastro/fila-documentos" element={<FilaDocumentos />} />
              <Route path="/cadastro" element={<Navigate to="/cadastro/propostas" replace />} />
              <Route path="/cadastro/documentos/:id" element={<AnaliseDocumento />} />
              <Route path="/cadastro/vistorias/:id/analise" element={<AnaliseVistoria />} />
              <Route path="/cadastro/propostas" element={<PropostasPendentes />} />
              <Route path="/cadastro/propostas/:id" element={<PropostaAnalise />} />
              <Route path="/cadastro/instalacoes/:id/ativar" element={<VistoriaCompletaAnalise />} />
              <Route path="/cadastro/processos" element={<ProcessosOperacionais />} />
              <Route path="/cadastro/recusas-instalador" element={<RecusasInstalador />} />
              <Route path="/cadastro/base-antiga" element={<BaseAntiga />} />
              <Route path="/cadastro/biometrias-pendentes" element={<AutentiqueBiometriasPendentes />} />
              
              {/* Eventos */}
              <Route path="/eventos/dashboard" element={<SinistrosDashboard />} />
              <Route path="/eventos/sinistros" element={<SinistrosList />} />
              <Route path="/eventos/sinistros/:id" element={<SinistroDetalhe />} />
              <Route path="/eventos/sinistros/:id/analisar" element={<SinistroAnalise />} />
              <Route path="/eventos/sindicancias" element={<SindicanciasList />} />
              <Route path="/eventos/sindicancias/:id" element={<SindicanciaDetalhe />} />
              <Route path="/eventos/sla" element={<EventosSLADashboard />} />
              <Route path="/eventos/solicitacoes-ia" element={<EventosPreAnalise />} />
              <Route path="/eventos/chat-ia" element={<EventosChatIA />} />
              <Route path="/cobranca/chat" element={<EventosChatIA />} />
              
              {/* Sindicante */}
              <Route path="/sindicante" element={<SindicanteDashboard />} />
              <Route path="/sindicante/caso/:id" element={<SindicanteCasoDetalhe />} />
              
              {/* Sindicantes (admin) */}
              <Route path="/eventos/sindicantes" element={<SindicantesAdmin />} />
              
              {/* Assistência 24h */}
              <Route path="/assistencia" element={<AssistenciaDashboard />} />
              <Route path="/assistencia/chamados" element={<ChamadosList />} />
              <Route path="/assistencia/chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="/assistencia/prestadores" element={<PrestadoresList />} />
              <Route path="/assistencia/prestadores/:id" element={<PrestadorDetalhe />} />
              <Route path="/assistencia/prestadores/:id/editar" element={<PrestadorDetalhe />} />
              
              {/* Financeiro */}
              <Route path="/financeiro" element={<FinanceiroDashboard />} />
              {/* Módulo unificado de Cobranças (Faturas + Régua) */}
              <Route path="/financeiro/cobrancas" element={<CobrancasLayout />}>
                <Route index element={<CobrancasList />} />
                <Route path="regua" element={<ReguaPage />} />
              </Route>
              <Route path="/financeiro/cobrancas/:id" element={<CobrancaDetalhe />} />
              <Route path="/financeiro/faturamento" element={<FaturamentoMensal />} />
              <Route path="/financeiro/contas-pagar" element={<ContasPagar />} />
              <Route path="/financeiro/extrato" element={<Extrato />} />
              <Route path="/financeiro/extratos/:id" element={<ExtratoDetalhe />} />
              <Route path="/financeiro/contas-bancarias" element={<ContasBancarias />} />
              <Route path="/financeiro/configuracoes/comissionamento-externo" element={<Navigate to="/comissoes" replace />} />
              <Route path="/financeiro/venda-externa" element={<DashboardVendaExterna />} />
              <Route path="/financeiro/venda-externa/:vendedorId" element={<GestaoContaVendedor />} />
              <Route path="/perfil/conta-corrente" element={<ContaCorrenteVendedor />} />

              {/* Redirects de compatibilidade — rotas antigas removidas */}
              <Route path="/financeiro/cobrancas/recuperacao" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/financeiro/cobrancas/recuperacao/*" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/financeiro/emissao" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/financeiro/notificacoes-cobranca" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/financeiro/extratos-bancarios" element={<Navigate to="/financeiro/extrato" replace />} />
              <Route path="/financeiro/conta-corrente-comissoes" element={<Navigate to="/comissoes" replace />} />

              {/* Comissões */}
              <Route path="/comissoes" element={<ComissoesDashboard />} />
              <Route path="/comissoes/grades" element={<ComissoesGrades />} />
              <Route path="/comissoes/grades/nova" element={<ComissoesGradeForm />} />
              <Route path="/comissoes/grades/:id" element={<ComissoesGradeForm />} />
              <Route path="/comissoes/atribuicao" element={<ComissoesAtribuicao />} />
              <Route path="/comissoes/relatorio" element={<ComissoesRelatorio />} />
              <Route path="/comissoes/pagamentos" element={<ComissoesPagamentos />} />
              <Route path="/comissoes/conta-corrente" element={<Navigate to="/comissoes" replace />} />

              {/* Redirects das rotas antigas /cobranca/* */}
              <Route path="/cobranca" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/fila" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/inadimplentes" element={<Navigate to="/financeiro/cobrancas" replace />} />
              <Route path="/cobranca/inadimplentes/:id" element={<Navigate to="/financeiro/cobrancas" replace />} />
              <Route path="/cobranca/regua" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/negativacao" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/acordos" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/acordos/novo" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/cobranca/acordos/:id" element={<Navigate to="/financeiro/cobrancas/regua" replace />} />
              <Route path="/relacionamento/troca-titularidade" element={<TrocaTitularidade />} />
              <Route path="/cobranca/troca-titularidade" element={<Navigate to="/relacionamento/troca-titularidade" replace />} />
              
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
              <Route path="/diretoria/vistorias-instalacoes" element={<Rotas />} />
              <Route path="/monitoramento/mapa" element={<Mapa />} />
              <Route path="/monitoramento/rastreadores" element={<Rastreadores />} />
              <Route path="/monitoramento/alertas" element={<AlertasMonitoramento />} />
              <Route path="/monitoramento/calendario" element={<CalendarioInstalacoes />} />
              <Route path="/monitoramento/vistorias-instalacoes-mon" element={<VistoriasInstalacoesMon />} />
              <Route path="/monitoramento/ressalvas-pendentes" element={<RessalvasPendentes />} />
              <Route path="/monitoramento/aprovacao-associados" element={<AprovacaoAssociadosMonitoramento />} />
              <Route path="/monitoramento/aprovacao-associados/:id" element={<AprovacaoInstalacaoDetalhe />} />
              <Route path="/monitoramento/imprevistos" element={<ImprevistosPainel />} />
              <Route path="/monitoramento/prestadores-parceiros" element={<PrestadoresParceiros />} />
              <Route path="/monitoramento/aprovacoes" element={<AprovacoesTroca />} />
              <Route path="/monitoramento/liberacoes-autovistoria" element={<LiberacoesAutoVistoria />} />
              
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
              <Route path="/marketing/origens" element={<OrigensLead />} />
              
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
              <Route path="/documentos/pdf-cotacao" element={<CotacaoPdfConfig />} />

              {/* Diretoria */}
              <Route path="/diretoria" element={<DiretoriaDashboard />} />
              <Route path="/diretoria/gestao-comercial" element={<GestaoComercial />} />
              <Route path="/diretoria/planos-beneficios" element={<Navigate to="/diretoria/gestao-comercial" replace />} />
              <Route path="/diretoria/produtos" element={<Navigate to="/diretoria/gestao-comercial" replace />} />
              <Route path="/diretoria/produtos/:id" element={<ProdutoDetalhe />} />
              <Route path="/diretoria/rateios" element={<RateioSinistros />} />
              <Route path="/diretoria/indicadores" element={<IndicadoresAtuariais />} />
              <Route path="/diretoria/relatos-erros" element={<RelatosErros />} />
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
              <Route path="/diretoria/aprovacoes" element={<AprovacoesDiretoriaPage />} />
              <Route path="/diretoria/saude-ativacao" element={<SaudeAtivacao />} />
              
              {/* Central de Relatórios */}
              <Route path="/relatorios" element={<RelatoriosCentral />} />
              
              {/* Oficinas */}
              <Route path="/oficinas" element={<Oficinas />} />
              <Route path="/oficinas/auto-centers" element={<AutoCenters />} />
              <Route path="/oficinas/relatorios" element={<OficinasRelatorios />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/oficinas/ordens/:id" element={<Navigate to="/ordens-servico" replace />} />
              
              {/* Configurações */}
              <Route path="/configuracoes" element={<LazyConfiguracoesLayout />}>
                <Route index element={<Navigate to="meu-perfil" replace />} />
                <Route path="meu-perfil" element={<MeuPerfil />} />
                <Route path="seguranca" element={<Seguranca />} />
                <Route path="notificacoes" element={<NotificacoesConfig />} />
                <Route path="usuarios-acessos" element={<UsuariosAcessos />} />
                <Route path="usuarios" element={<Navigate to="/configuracoes/usuarios-acessos" replace />} />
                <Route path="usuarios/novo" element={<UsuarioForm />} />
                <Route path="usuarios/:id" element={<UsuarioForm />} />
                <Route path="integracoes" element={<Integracoes />} />
                <Route path="integracoes/whatsapp" element={<IntegracaoWhatsApp />} />
                <Route path="integracoes/ia" element={<IntegracaoIA />} />
                <Route path="integracoes/api-keys" element={<IntegracaoApiKeys />} />
                <Route path="integracoes/fontes-leads" element={<IntegracaoFontesLeads />} />
                <Route path="integracoes/sga-hinova" element={<IntegracaoSGAHinova />} />
                <Route path="integracoes/hinova-mapeamentos" element={<IntegracaoHinovaMapeamentos />} />
                <Route path="integracoes/planos-sga" element={<PlanosSGA />} />
                <Route path="grades-comissao" element={<Navigate to="/comissoes/grades" replace />} />
                <Route path="grades-comissao/nova" element={<Navigate to="/comissoes/grades/nova" replace />} />
                <Route path="grades-comissao/:id" element={<RedirectGradeComissao />} />
                <Route path="atribuicao-comissoes" element={<Navigate to="/comissoes/atribuicao" replace />} />
                <Route path="comissionamento-plano" element={<Navigate to="/comissoes/grades" replace />} />
                <Route path="agente-consultor-ia" element={<AgenteConsultorIA />} />
                <Route path="api" element={<ApiDocumentation />} />
                <Route path="sistema" element={<Sistema />} />
              </Route>
              <Route path="/admin/telemetria" element={<Telemetria />} />
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
            
            {/* Agência Routes */}
            <Route element={<AgenciaLayout />}>
              <Route path="/agencia" element={<AgenciaDashboard />} />
              <Route path="/agencia/dados-pagamento" element={<DadosPagamento />} />
            </Route>
            
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
              <Route path="/instalador/sincronizacao" element={<SincronizacaoPage />} />
            </Route>
            
            {/* Regulador App Routes */}
            <Route element={<ReguladorLayout />}>
              <Route path="/regulador" element={<ReguladorHome />} />
              <Route path="/regulador/vistorias" element={<ReguladorVistorias />} />
              <Route path="/regulador/vistoria/:id" element={<ExecutarVistoriaEvento />} />
              <Route path="/regulador/oficina" element={<ReguladorOficina />} />
              <Route path="/regulador/perfil" element={<InstaladorPerfil />} />
              <Route path="/regulador/sincronizacao" element={<SincronizacaoPage />} />
            </Route>
            
            {/* Analista de Eventos Routes */}
            <Route element={<AnalistaEventosLayout />}>
              <Route path="/analista-eventos" element={<AnalistaEventosHome />} />
              <Route path="/analista-eventos/fila" element={<AnalistaEventosFila />} />
              <Route path="/analista-eventos/evento/:id" element={<EventoAnaliseDetalhe />} />
              <Route path="/analista-eventos/perfil" element={<InstaladorPerfil />} />
            </Route>

            {/* Vistoriador redirects to Instalador */}
            <Route path="/vistoriador/*" element={<Navigate to="/instalador" replace />} />
            
            {/* Acesso Negado */}
            <Route path="/acesso-negado" element={<AcessoNegado />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </BrowserRouter>
            </AppErrorBoundary>
          </TooltipProvider>
        </AssociadoProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
