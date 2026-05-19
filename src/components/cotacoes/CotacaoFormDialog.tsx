import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularOpcoesVencimento } from '@/utils/vencimento';
import { useAssociadoSearch } from '@/hooks/useAssociadoSearch';
import { resolverAssociadoLocalId, isUuid } from '@/hooks/useResolverAssociadoLocal';

import { ChevronDown, ChevronUp, Fuel } from 'lucide-react';
import { mapearRegiaoParaPricing } from '@/utils/regiaoMapping';
import { useTaxaAdesaoPercentual, useTaxaAdesaoMinimoBase, useTaxaAdesaoMinimoVolanteInterno, useTaxaAdesaoMinimoVolanteExterno, useTaxaRepasseVolante, useTaxaRepasseVolanteExterno, useCarenciaDiasPadrao, useCarenciaVidrosDias, useMigracaoConfig, useMarcasAceitasMotos, useConfiguracaoJson, useCombustiveis } from '@/hooks/useConteudosSistema';
import { useAllEligibilityRules } from '@/hooks/useEntityEligibilityRules';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { gerarAlertaCategoriaElegibilidade } from '@/utils/alertaCategoriaElegibilidade';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { type MigracaoState } from '@/components/cotacoes/MigracaoToggle';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Car, Search, CheckCircle2, Shield, Check, AlertCircle, Copy, MessageCircle, Zap, User, Link, UserCheck, Phone, Mail, AlertTriangle, Info, MapPin, HelpCircle, X, XCircle, Calendar, TrendingDown, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { LeadCombobox } from '@/components/leads/LeadCombobox';
import type { Lead } from '@/types/vendas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { cotacaoSchema, type CotacaoFormData } from '@/lib/validations';
import { useCreateCotacao, useUpdateCotacao } from '@/hooks/useCotacoes';
import { usePlanosCotacao, type PlanoCotacao, type PlanoNegadoInfo } from '@/hooks/usePlanosCotacao';

import { useRegistrarCienciaFipeMenor } from '@/hooks/useAprovacoesFipeMenor';
import { useCriarSolicitacaoFipeLimite, useAprovacaoFipeLimitePorCotacao } from '@/hooks/useAprovacoesFipeLimite';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { useFipeMenorAtivo } from '@/hooks/useFipeMenorAtivo';
import { useConfigDuplaAprovacao } from '@/hooks/useAprovacoesFipeDiretoria';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { obterFaixaFipeAtual, obterFaixaFipeAnterior, somarCoberturasPorValorFipe } from '@/utils/fipeFaixa';
import { useLead } from '@/hooks/useLeads';
import { useFipe, type PlateResult, type FipeMarca, type FipeModelo, type FipeAno } from '@/hooks/useFipe';
import { useVendedores } from '@/hooks/useVendedores';
import { toast } from 'sonner';
import { descreverErroSupabase } from '@/lib/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useVerificarPlacaDuplicada, type PlacaDuplicadaInfo } from '@/hooks/useVerificarPlaca';
import { PlacaDuplicadaModal } from '@/components/cotacoes/PlacaDuplicadaModal';
import { VeiculoSGAModal } from '@/components/cotacoes/VeiculoSGAModal';
import { useVerificarVeiculoSGA } from '@/hooks/useVerificarVeiculoSGA';
import { useVerificarPlacaOutroAssociado, type PlacaOutroAssociadoInfo } from '@/hooks/useVerificarPlacaOutroAssociado';
import { PlacaOutroAssociadoModal } from '@/components/cotacoes/PlacaOutroAssociadoModal';
import { useCotacaoDraft, type DraftPayload } from '@/hooks/useCotacaoDraft';
import { DraftRestoreBanner } from '@/components/cotacao/DraftRestoreBanner';
import { shouldBypassPlateGuards } from '@/components/cotacoes/plateGuardBypass';

// Regiões, tipos de uso, tipos de placa e combustíveis agora vêm do banco

// Alertas de categoria agora vêm do banco (observacoes_categoria)

// Interface para cotação base (duplicação)
export interface CotacaoBaseParaFormulario {
  valor_fipe: number | null;
  valor_adicional: number | null;
  valor_adesao: number | null;
  validade_dias: number | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  codigo_fipe: string | null;
  categoria: string | null;
  regiao: string | null;
  nome_solicitante: string | null;
  telefone1_solicitante: string | null;
  email_solicitante: string | null;
  lead_id: string | null;
  plano_id: string | null;
  indicador_id?: string | null;
  indicador_nome?: string | null;
  dados_extras?: {
    planos_comparacao?: {
      id: string;
      nome: string;
      codigo?: string;
      valorMensal: number;
      coberturas?: string[];
    }[];
  } | null;
}

export interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  cotacaoBase?: CotacaoBaseParaFormulario | null;
  /** Cotação existente para edição (qualquer status, exceto após contrato assinado) */
  cotacaoParaEditar?: CotacaoBaseParaFormulario & { id: string } | null;
  /** IDs de cotações a ignorar na verificação de placa duplicada (ex.: original em duplicação) */
  ignorarPlacaDuplicadaIds?: string[];
  /** Callback após salvar com sucesso */
  onSuccess?: () => void;
  /**
   * Quando presente, marca a cotação como originada de uma troca de titularidade.
   * Após criar a cotação, vincula automaticamente à `solicitacoes_troca_titularidade`
   * via edge function `vincular-cotacao-troca` e injeta os metadados em `dados_extras`.
   */
  origemTroca?: {
    solicitacaoId: string;
    associadoAntigoId: string;
    veiculoOrigemId: string;
  } | null;
}

export function CotacaoFormDialog({ open, onOpenChange, leadId, cotacaoBase, cotacaoParaEditar, ignorarPlacaDuplicadaIds, onSuccess, origemTroca }: CotacaoFormDialogProps) {
  const navigate = useNavigate();
  const createCotacao = useCreateCotacao();
  const updateCotacao = useUpdateCotacao();
  const isEditando = !!cotacaoParaEditar;
  const { data: lead } = useLead(leadId);
  const { getMarcas, getModelos, getAnos, getPreco, getByPlaca, buscarPorNome, loading: fipeLoading } = useFipe();
  const { data: vendedores = [], isLoading: vendedoresLoading } = useVendedores();
  const { user, profile } = useAuth();
  const { userId, isDiretor, isGerente, isSupervisor, isVendedorExterno, cotacao: cotacaoPerms, isPermissionsLoading } = usePermissions();
  const podeOperarCotacao = !!cotacaoPerms?.canCreate;
  const { data: percentualAdesaoConfig = 1 } = useTaxaAdesaoPercentual();
  const { data: minimoAdesaoBase = 100 } = useTaxaAdesaoMinimoBase();
  const { data: minimoVolanteInterno = 50 } = useTaxaAdesaoMinimoVolanteInterno();
  const { data: minimoVolanteExterno = 50 } = useTaxaAdesaoMinimoVolanteExterno();
  const { data: repasseVolanteInterno = 50 } = useTaxaRepasseVolante();
  const { data: repasseVolanteExterno = 50 } = useTaxaRepasseVolanteExterno();
  const repasseVolante = isVendedorExterno ? repasseVolanteExterno : repasseVolanteInterno;
  const { data: carenciaDias = 120 } = useCarenciaDiasPadrao();
  const { data: carenciaVidrosDias = 120 } = useCarenciaVidrosDias();
  const { data: migracaoConfig } = useMigracaoConfig();
  const [migracaoState, setMigracaoState] = useState<MigracaoState>({ ativo: false, associacaoOrigem: '', arquivos: [] });
  
  // Dados dinâmicos das Tabelas de Apoio
  const { data: regioesAtivas = [], isLoading: regioesLoading } = useRegioesAtivas();
  const { data: tiposUsoBanco = [] } = useConfiguracaoJson<{ value: string; label: string; ativo?: boolean }[]>('tipos_uso', []);
  const { data: tiposPlacaBanco = [] } = useConfiguracaoJson<{ value: string; label: string; ativo?: boolean }[]>('tipos_placa', []);
  const { data: combustiveisBanco = [] } = useCombustiveis();
  
  const tiposUsoAtivos = useMemo(() => tiposUsoBanco.filter(t => t.ativo !== false), [tiposUsoBanco]);
  const tiposPlacaAtivos = useMemo(() => tiposPlacaBanco.filter(t => t.ativo !== false), [tiposPlacaBanco]);
  const { data: allEligibilityRules = [] } = useAllEligibilityRules();
  const { data: coberturasGlobal = [] } = useCoberturas(true);
  const { data: beneficiosGlobal = [] } = useBenefits();
  
  // Estado do cenário de adesão para vendedor externo
  type CenarioExterno = 'cobra_rota' | 'isenta_rota' | 'isenta_base' | 'cobra_base';
  const [cenarioExterno, setCenarioExterno] = useState<CenarioExterno | null>(null);
  const isCenarioIsento = cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base';
  const isCenarioSemMinimo = isCenarioIsento || cenarioExterno === 'cobra_base';

  // Mínimo efetivo: volante quando cenário inclui rota
  const minimoAdesaoVolante = isVendedorExterno ? minimoVolanteExterno : minimoVolanteInterno;
  const minimoAdesaoConfig = cenarioExterno?.includes('rota') ? minimoAdesaoVolante : minimoAdesaoBase;
  
  // Hook para verificar placa duplicada
  const verificarPlacaDuplicada = useVerificarPlacaDuplicada();
  
  // Apenas liderança (diretor, gerente, supervisor) pode atribuir vendedor manualmente
  const podeAtribuirVendedor = isDiretor || isGerente || isSupervisor;
  
  // Estados para dados do associado
  const [nomeAssociado, setNomeAssociado] = useState('');
  const [telefoneAssociado, setTelefoneAssociado] = useState('');
  const [emailAssociado, setEmailAssociado] = useState('');
  
  // Estados para indicação
  const [isIndicacao, setIsIndicacao] = useState(false);
  const [indicadorId, setIndicadorId] = useState<string | null>(null);
  const [indicadorNome, setIndicadorNome] = useState('');
  const [buscaIndicador, setBuscaIndicador] = useState('');
  const { data: resultadosIndicador = [], isLoading: buscandoIndicador } = useAssociadoSearch(buscaIndicador);
  
  // Estado para uso do veículo (dinâmico das Tabelas de Apoio)
  const [usoVeiculo, setUsoVeiculo] = useState<string>('particular');
  
  // Estado para tipo de placa
  const [tipoPlacaSelecionado, setTipoPlacaSelecionado] = useState<string>('');

  // Tipo da cotação (informativo) — enviado no campo observação do veículo no SGA
  const [tipoCotacao, setTipoCotacao] = useState<string>(origemTroca ? 'troca_titularidade' : 'adesao');
  const [tipoCotacaoOutro, setTipoCotacaoOutro] = useState<string>('');
  
  // Estado para combustível detectado/selecionado
  const [combustivelSelecionado, setCombustivelSelecionado] = useState<string>('');
  
  // Estados para busca por placa
  const [placa, setPlaca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<PlateResult | null>(null);
  // Guard de auto-busca (evita loop e re-disparo na mesma abertura)
  const autoBuscaPlacaRef = useRef<string | null>(null);

  // Veículo 0KM (dentro da agência, ainda sem placa definitiva).
  // Quando true:
  //  - desabilita o input de placa e a consulta FIPE automática
  //  - exige preenchimento manual de marca/modelo/ano/valor FIPE (Nota Fiscal)
  //  - grava cotacoes.veiculo_zero_km=true e veiculo_placa=null
  //  - contrato-gerar criará o veículo com placa placeholder "0KM*****" e
  //    aguardando_placa_definitiva=true (necessário para SGA Hinova e Softruck).
  // Ver mem://logic/quotation/cotacao-0km-fluxo-canonico
  const [isZeroKm, setIsZeroKm] = useState(false);

  // Estados para confirmação de valor de adesão
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CotacaoFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para modal de placa duplicada
  const [placaDuplicadaInfo, setPlacaDuplicadaInfo] = useState<PlacaDuplicadaInfo | null>(null);
  const [showPlacaDuplicadaModal, setShowPlacaDuplicadaModal] = useState(false);
  
  // Estado para modal SGA
  const [showSGAModal, setShowSGAModal] = useState(false);
  const verificarVeiculoSGA = useVerificarVeiculoSGA();

  // Modal: placa pertencente a outro associado (base local)
  const [placaOutroAssocInfo, setPlacaOutroAssocInfo] = useState<PlacaOutroAssociadoInfo | null>(null);
  const [showPlacaOutroAssocModal, setShowPlacaOutroAssocModal] = useState(false);
  const verificarPlacaOutroAssoc = useVerificarPlacaOutroAssociado();

  // Bypass: placas para as quais o usuário já clicou "Ignorar e Prosseguir"
  // (registrado em cotacao_avisos_sga). Cada Set guarda placas normalizadas.
  const [bypassPlacaSGA, setBypassPlacaSGA] = useState<Set<string>>(new Set());
  const [bypassPlacaOutroAssoc, setBypassPlacaOutroAssoc] = useState<Set<string>>(new Set());
  const [bypassPlacaDuplicada, setBypassPlacaDuplicada] = useState<Set<string>>(new Set());
  const placaNorm = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Estados para seleção FIPE manual
  type FipeMarcaComTipo = FipeMarca & { tipoFipe: 'carros' | 'motos' };
  const [marcas, setMarcas] = useState<FipeMarcaComTipo[]>([]);
  const [tipoFipeSelecionado, setTipoFipeSelecionado] = useState<'carros' | 'motos'>('carros');
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [marcaSelecionada, setMarcaSelecionada] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  
  
  // Estado para região selecionada
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string>('');
  
  // Estado para dia de vencimento
  const [diaVencimento, setDiaVencimento] = useState<number | null>(null);
  
  // Estados para FIPE menor
  const [solicitarFipeMenor, setSolicitarFipeMenor] = useState(false);
  const [justificativaFipeMenor, setJustificativaFipeMenor] = useState('');
  
  // Hook para registrar a ciência da Regra do 1% (Redução de Cota) — automático, sem aprovação
  const registrarCienciaFipeMenor = useRegistrarCienciaFipeMenor();
  const { fipeMenorAtivo } = useFipeMenorAtivo();

  // Limites de FIPE para Regra do 1% (mínimo + máximo POR TIPO carro/moto)
  const { data: fipeMenorLimites = { minimoCarro: 30000, minimoMoto: 9000, carro: 120000, moto: 27000 } } = useQuery({
    queryKey: ['config-fipe-menor-limites'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'fipe_menor_limite_minimo',
          'fipe_menor_limite_minimo_carro',
          'fipe_menor_limite_minimo_moto',
          'fipe_menor_limite_carro',
          'fipe_menor_limite_moto',
        ]);
      const map = new Map((data || []).map(r => [r.chave, Number(r.valor)] as const));
      const minimoCarro =
        map.get('fipe_menor_limite_minimo_carro') ||
        map.get('fipe_menor_limite_minimo') ||
        30000;
      const minimoMoto = map.get('fipe_menor_limite_minimo_moto') || 9000;
      return {
        minimoCarro,
        minimoMoto,
        carro: map.get('fipe_menor_limite_carro') || 120000,
        moto: map.get('fipe_menor_limite_moto') || 27000,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Hook para FIPE limite (alto valor)
  const { data: configLimites } = useConfigLimitesVeiculo();
  const criarSolicitacaoFipeLimite = useCriarSolicitacaoFipeLimite();
  const { data: aprovacaoFipeLimiteExistente } = useAprovacaoFipeLimitePorCotacao(cotacaoParaEditar?.id);
  const [fipeLimiteSolicitado, setFipeLimiteSolicitado] = useState(false);
  const { data: configDuplaAprovacao } = useConfigDuplaAprovacao();

  // Função para calcular opções de vencimento baseado no dia atual
  const opcoesVencimento = useMemo((): [number, number] => {
    const hoje = new Date().getDate();
    return calcularOpcoesVencimento(hoje);
  }, []);

  // Pré-seleciona a primeira opção válida quando o consultor ainda não escolheu.
  // Mantém a escolha existente se já houver — apenas garante que nunca fique null.
  useEffect(() => {
    if (diaVencimento === null || !opcoesVencimento.includes(diaVencimento as any)) {
      setDiaVencimento(opcoesVencimento[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoesVencimento]);

  
  // Loading states
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [buscandoFipe, setBuscandoFipe] = useState(false);

  // Estado para planos selecionados (múltipla seleção - sem limite)
  const [planosSelecionados, setPlanosSelecionados] = useState<PlanoCotacao[]>([]);
  
  // Estado para controlar quais planos têm benefícios expandidos
  const [expandedPlanos, setExpandedPlanos] = useState<Record<string, boolean>>({});
  
  // Toggle para expandir/recolher benefícios de um plano
  const toggleExpandPlano = useCallback((planoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedPlanos(prev => ({ ...prev, [planoId]: !prev[planoId] }));
  }, []);

  const form = useForm<CotacaoFormData>({
    resolver: zodResolver(cotacaoSchema),
    defaultValues: {
      lead_id: leadId || null,
      plano_id: '',
      valor_fipe: 0,
      valor_adicional: 0,
      valor_cota: 0,
      taxa_administrativa: 0,
      valor_rastreamento: 0,
      valor_adesao: 0,
      valor_total_mensal: 0,
      validade_dias: 7,
      vendedor_id: null,
    },
  });

  const valorFipe = form.watch('valor_fipe');
  const valorAdicional = form.watch('valor_adicional') || 0;
  const planoId = form.watch('plano_id');
  const validadeDias = form.watch('validade_dias');
  const valorAdesao = form.watch('valor_adesao');

  // ========================================================================
  // RASCUNHO LOCAL (localStorage) — preserva o que foi preenchido se o
  // consultor sair da página antes de criar a cotação. 100% client-side.
  // Desligado em modo edição (já há cotação no banco) e quando há
  // cotacaoBase / leadId pré-carregando dados.
  // ========================================================================
  const draftDisabled = isEditando || !!cotacaoBase || !!leadId;
  const isRestoringDraftRef = useRef(false);
  const watchedFormValues = form.watch();
  const draftSnapshot = useMemo<DraftPayload | null>(() => {
    if (draftDisabled || !open) return null;
    return {
      form: watchedFormValues,
      placa,
      marcaSelecionada,
      modeloSelecionado,
      anoSelecionado,
      tipoFipeSelecionado,
      regiaoSelecionada,
      usoVeiculo,
      tipoPlacaSelecionado,
      combustivelSelecionado,
      diaVencimento,
      nomeAssociado,
      telefoneAssociado,
      emailAssociado,
      isIndicacao,
      indicadorId,
      indicadorNome,
      cenarioExterno,
      solicitarFipeMenor,
      justificativaFipeMenor,
      veiculoEncontrado: veiculoEncontrado ? {
        success: veiculoEncontrado.success,
        extractedPlate: veiculoEncontrado.extractedPlate,
        vehicleData: veiculoEncontrado.vehicleData,
        fipeData: veiculoEncontrado.fipeData,
      } : null,
    };
  }, [
    draftDisabled, open, watchedFormValues, placa, marcaSelecionada, modeloSelecionado,
    anoSelecionado, tipoFipeSelecionado, regiaoSelecionada, usoVeiculo, tipoPlacaSelecionado,
    combustivelSelecionado, diaVencimento, nomeAssociado, telefoneAssociado, emailAssociado,
    isIndicacao, indicadorId, indicadorNome, cenarioExterno, solicitarFipeMenor, justificativaFipeMenor,
    veiculoEncontrado,
  ]);

  const draft = useCotacaoDraft({
    tipo: 'novo',
    disabled: draftDisabled,
    snapshot: draftSnapshot,
    isMeaningful: (s) => {
      const f = (s.form as any) || {};
      return !!(s.placa || s.nomeAssociado || s.telefoneAssociado || f.valor_fipe);
    },
  });

  const handleRestoreDraft = useCallback(() => {
    const payload = draft.getDraft();
    if (!payload) return;
    try {
      isRestoringDraftRef.current = true;
      const f = (payload.form as Partial<CotacaoFormData>) || {};
      form.reset({ ...form.getValues(), ...f });
      if (typeof payload.placa === 'string') setPlaca(payload.placa);
      if (typeof payload.marcaSelecionada === 'string') setMarcaSelecionada(payload.marcaSelecionada);
      if (typeof payload.modeloSelecionado === 'string') setModeloSelecionado(payload.modeloSelecionado);
      if (typeof payload.anoSelecionado === 'string') setAnoSelecionado(payload.anoSelecionado);
      if (payload.tipoFipeSelecionado === 'carros' || payload.tipoFipeSelecionado === 'motos') {
        setTipoFipeSelecionado(payload.tipoFipeSelecionado);
      }
      if (typeof payload.regiaoSelecionada === 'string') setRegiaoSelecionada(payload.regiaoSelecionada);
      if (typeof payload.usoVeiculo === 'string') setUsoVeiculo(payload.usoVeiculo);
      if (typeof payload.tipoPlacaSelecionado === 'string') setTipoPlacaSelecionado(payload.tipoPlacaSelecionado);
      if (typeof payload.combustivelSelecionado === 'string') setCombustivelSelecionado(payload.combustivelSelecionado);
      if (typeof payload.diaVencimento === 'number' || payload.diaVencimento === null) {
        setDiaVencimento(payload.diaVencimento as number | null);
      }
      if (typeof payload.nomeAssociado === 'string') setNomeAssociado(payload.nomeAssociado);
      if (typeof payload.telefoneAssociado === 'string') setTelefoneAssociado(payload.telefoneAssociado);
      if (typeof payload.emailAssociado === 'string') setEmailAssociado(payload.emailAssociado);
      if (typeof payload.isIndicacao === 'boolean') setIsIndicacao(payload.isIndicacao);
      if (typeof payload.indicadorId === 'string' || payload.indicadorId === null) {
        setIndicadorId(payload.indicadorId as string | null);
      }
      if (typeof payload.indicadorNome === 'string') setIndicadorNome(payload.indicadorNome);
      if (payload.cenarioExterno === null || typeof payload.cenarioExterno === 'string') {
        setCenarioExterno(payload.cenarioExterno as any);
      }
      if (typeof payload.solicitarFipeMenor === 'boolean') setSolicitarFipeMenor(payload.solicitarFipeMenor);
      if (typeof payload.justificativaFipeMenor === 'string') setJustificativaFipeMenor(payload.justificativaFipeMenor);
      const draftVehicle = payload.veiculoEncontrado as PlateResult | null | undefined;
      if (draftVehicle?.success && draftVehicle.vehicleData) {
        setVeiculoEncontrado(draftVehicle);
        if (draftVehicle.vehicleData.combustivel && !payload.combustivelSelecionado) {
          setCombustivelSelecionado(draftVehicle.vehicleData.combustivel.toLowerCase());
        }
        if (draftVehicle.fipeData?.valor) {
          form.setValue('valor_fipe', draftVehicle.fipeData.valor);
        }
      }
      draft.dismissBanner();
      toast.success('Rascunho restaurado.');
      window.setTimeout(() => {
        isRestoringDraftRef.current = false;
      }, 0);
    } catch (e) {
      isRestoringDraftRef.current = false;
      console.error('[restoreDraft]', e);
      toast.error('Não foi possível restaurar o rascunho.');
      draft.discardDraft();
    }
  }, [draft, form]);

  // Guard: só auto-preencher adesão se o consultor não editou manualmente
  const adesaoEditadaManualmente = useRef(false);
  
  // Auto-calcular adesão como 1% FIPE (mínimo R$ 100)
  useEffect(() => {
    // Vendedor externo com cenário isento: não sobrescrever adesão zerada
    if (isCenarioIsento) return;
    if (valorFipe && valorFipe > 0 && !adesaoEditadaManualmente.current) {
      const adesaoCalculada = Math.max(valorFipe * (percentualAdesaoConfig / 100), minimoAdesaoConfig);
      const adesaoArredondada = Math.round(adesaoCalculada * 100) / 100;
      form.setValue('valor_adesao', adesaoArredondada);
    }
  }, [valorFipe, form, isCenarioIsento, percentualAdesaoConfig, minimoAdesaoConfig]);
  
  // Extrair ano numérico para o hook de planos
  const anoTexto = useMemo(() => {
    if (veiculoEncontrado?.vehicleData?.ano) return veiculoEncontrado.vehicleData.ano;
    const ano = anos.find(a => a.codigo === anoSelecionado);
    return ano?.nome || '';
  }, [veiculoEncontrado, anos, anoSelecionado]);
  
  const anoNumerico = useMemo(() => {
    return anoTexto ? parseInt(anoTexto.split(' ')[0]) : undefined;
  }, [anoTexto]);

  // Helper to extract marca name from composite key
  const getMarcaNomeFromCodigo = useCallback((compositeKey: string) => {
    if (!compositeKey) return '';
    const codigo = compositeKey.includes(':') ? compositeKey.split(':')[1] : compositeKey;
    const marca = marcas.find(m => m.codigo === codigo);
    return marca?.nome || '';
  }, [marcas]);



  // Detectar tipo de veículo automaticamente (moto vs carro)
  const marcaParaDeteccao = veiculoEncontrado?.vehicleData?.marca || getMarcaNomeFromCodigo(marcaSelecionada) || '';
  const modeloParaDeteccao = veiculoEncontrado?.vehicleData?.modelo || '';
  const tipoVeiculoApiPlaca = veiculoEncontrado?.vehicleData?.tipo_de_veiculo || null;
  const { tipoVeiculo: tipoFromHook } = useDetectarTipoVeiculo(marcaParaDeteccao, modeloParaDeteccao, tipoVeiculoApiPlaca);
  
  const tipoVeiculoDetectado = useMemo(() => {
    // Se veículo foi encontrado por placa/lead/cotação, usar apenas detecção do hook (ignora seleção manual)
    if (veiculoEncontrado) return tipoFromHook;
    // Se o vendedor selecionou marca manualmente como moto, usar direto
    if (marcaSelecionada && tipoFipeSelecionado === 'motos') return 'moto' as const;
    return tipoFromHook;
  }, [veiculoEncontrado, marcaSelecionada, tipoFipeSelecionado, tipoFromHook]);

  // Resolver marca/modelo para elegibilidade
  const marcaResolvida = useMemo(() => {
    return veiculoEncontrado?.vehicleData?.marca || getMarcaNomeFromCodigo(marcaSelecionada) || '';
  }, [veiculoEncontrado, marcaSelecionada, marcas]);

  const modeloResolvido = useMemo(() => {
    if (veiculoEncontrado?.vehicleData?.modelo) return veiculoEncontrado.vehicleData.modelo;
    const mod = modelos.find(m => m.codigo.toString() === modeloSelecionado);
    return mod?.nome || '';
  }, [veiculoEncontrado, modeloSelecionado, modelos]);

  // Hook de planos calculados dinamicamente do banco — movido para depois de
  // fipeMenorInfo para podermos repassar a faixa reduzida quando a Regra do 1%
  // estiver elegível (ver definição logo após fipeMenorInfo).


  // Buscar todas as faixas de preço (LEGADO — apenas fallback p/ catálogo antigo)
  const { data: todasFaixas = [] } = useTabelasPreco();

  // Vínculos plano↔cobertura (necessário para resolver faixa pelo plano)
  // (allEligibilityRules já declarado acima)
  const { data: planoCoberturasMap = [] } = useQuery({
    queryKey: ['planos_coberturas', 'faixa_display'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: { plano_id: string; cobertura_id: string }[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('planos_coberturas')
          .select('plano_id, cobertura_id')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat((data || []) as any);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Calcular elegibilidade FIPE menor (usa entity_eligibility_rules, com fallback p/ tabela legada)
  const fipeMenorInfo = useMemo(() => {
    if (!valorFipe || valorFipe <= 0) {
      return null;
    }

    const valorReduzido = valorFipe * 0.99;

    // Bloquear FIPE menor para veículos com FIPE <= mínimo do tipo (carro/moto)
    const minimoTipo = tipoVeiculoDetectado === 'moto' ? fipeMenorLimites.minimoMoto : fipeMenorLimites.minimoCarro;
    if (valorFipe <= minimoTipo) {
      return null;
    }

    // Restrição comercial por tipo de veículo (Regra do 1%)
    const limiteTipo = tipoVeiculoDetectado === 'moto' ? fipeMenorLimites.moto : fipeMenorLimites.carro;
    const tipoLabel = tipoVeiculoDetectado === 'moto' ? 'motos' : 'carros';
    if (valorFipe > limiteTipo) {
      return {
        elegivel: false,
        preliminar: false,
        bloqueado: {
          motivo: `Regra do 1% disponível apenas para ${tipoLabel} com FIPE até ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limiteTipo)}.`,
        },
        valorReduzido,
        faixaAtual: null as null | { min: number; max: number; mensal: number },
        faixaInferior: null as null | { min: number; max: number; mensal: number },
        economia: 0,
      };
    }

    // Faixa de obrigatoriedade do rastreador (R$ 30k–R$ 35k): nunca pode ser reduzida
    const FAIXA_RASTREADOR_MIN = 30000;
    const FAIXA_RASTREADOR_MAX = 35000;
    const bloqueioRastreador = {
      motivo: 'a faixa atual (R$ 30.000 – R$ 35.000) exige rastreador obrigatório. A redução não pode ser aplicada.',
    };

    // Bloqueio preliminar pela zona de rastreador obrigatório (independe de plano)
    if (valorFipe >= FAIXA_RASTREADOR_MIN && valorFipe < FAIXA_RASTREADOR_MAX) {
      return {
        elegivel: false,
        preliminar: false,
        bloqueado: bloqueioRastreador,
        valorReduzido,
        faixaAtual: null as null | { min: number; max: number; mensal: number },
        faixaInferior: null as null | { min: number; max: number; mensal: number },
        economia: 0,
      };
    }

    // === ESTÁGIO A — Preliminar (sem plano selecionado) ===
    // Mostra elegibilidade já no carregamento do FIPE; economia só sai no Estágio B.
    if (planosSelecionados.length === 0) {
      return {
        elegivel: true,
        preliminar: true,
        bloqueado: null as null | { motivo: string },
        valorReduzido,
        faixaAtual: null as null | { min: number; max: number; mensal: number },
        faixaInferior: null as null | { min: number; max: number; mensal: number },
        economia: 0,
      };
    }

    const plano = planosSelecionados[0];

    // === MOTOR MODERNO: derivar faixas das regras fipe_range ===
    const faixaAtualRule = obterFaixaFipeAtual(plano?.id, planoCoberturasMap, allEligibilityRules as any, valorFipe);
    const faixaInferiorRule = obterFaixaFipeAnterior(plano?.id, planoCoberturasMap, allEligibilityRules as any, valorFipe);

    if (faixaAtualRule && faixaInferiorRule) {
      const mensalAtual = somarCoberturasPorValorFipe(plano.id, planoCoberturasMap, allEligibilityRules as any, valorFipe);
      const mensalInferior = somarCoberturasPorValorFipe(
        plano.id,
        planoCoberturasMap,
        allEligibilityRules as any,
        // valor "alvo" qualquer dentro da faixa inferior
        Math.max(0, faixaInferiorRule.de + 0.01)
      );

      const faixaNaZonaRastreador =
        faixaAtualRule.de >= FAIXA_RASTREADOR_MIN && faixaAtualRule.de < FAIXA_RASTREADOR_MAX;

      if (faixaNaZonaRastreador) {
        return {
          elegivel: false,
          preliminar: false,
          bloqueado: bloqueioRastreador,
          valorReduzido,
          faixaAtual: { min: faixaAtualRule.de, max: faixaAtualRule.ate - 0.01, mensal: mensalAtual },
          faixaInferior: { min: faixaInferiorRule.de, max: faixaInferiorRule.ate - 0.01, mensal: mensalInferior },
          economia: mensalAtual - mensalInferior,
        };
      }

      const elegivel = valorReduzido < faixaAtualRule.de;

      return {
        elegivel,
        preliminar: false,
        bloqueado: null as null | { motivo: string },
        valorReduzido,
        faixaAtual: { min: faixaAtualRule.de, max: faixaAtualRule.ate - 0.01, mensal: mensalAtual },
        faixaInferior: { min: faixaInferiorRule.de, max: faixaInferiorRule.ate - 0.01, mensal: mensalInferior },
        economia: mensalAtual - mensalInferior,
      };
    }

    // === FALLBACK LEGADO (catálogo antigo sem regras fipe_range) ===
    if (todasFaixas.length === 0) return null;

    const matchingFaixas = todasFaixas.filter(f => valorFipe >= f.fipe_min && valorFipe <= f.fipe_max);
    const linhaSlugPlano = plano?.linha || null;
    const faixaAtual = (linhaSlugPlano ? matchingFaixas.find(f => f.linha_slug === linhaSlugPlano) : null)
      || matchingFaixas.sort((a, b) => (b.fipe_max - b.fipe_min) - (a.fipe_max - a.fipe_min))[0] || null;

    if (!faixaAtual) return null;

    const faixasInferiores = todasFaixas
      .filter(f => f.fipe_max < faixaAtual.fipe_min && f.linha_slug === faixaAtual.linha_slug && f.regiao === faixaAtual.regiao && f.tipo_uso === faixaAtual.tipo_uso)
      .sort((a, b) => b.fipe_max - a.fipe_max);

    const faixaInferior = faixasInferiores[0];
    if (!faixaInferior) return null;

    const faixaLegadaNaZonaRastreador =
      faixaAtual.fipe_min >= FAIXA_RASTREADOR_MIN && faixaAtual.fipe_min < FAIXA_RASTREADOR_MAX;

    if (faixaLegadaNaZonaRastreador) {
      return {
        elegivel: false,
        preliminar: false,
        bloqueado: bloqueioRastreador,
        valorReduzido,
        faixaAtual: { min: faixaAtual.fipe_min, max: faixaAtual.fipe_max, mensal: faixaAtual.valor_mensal },
        faixaInferior: { min: faixaInferior.fipe_min, max: faixaInferior.fipe_max, mensal: faixaInferior.valor_mensal },
        economia: faixaAtual.valor_mensal - faixaInferior.valor_mensal,
      };
    }

    const elegivel = valorReduzido <= faixaInferior.fipe_max;

    return {
      elegivel,
      preliminar: false,
      bloqueado: null as null | { motivo: string },
      valorReduzido,
      faixaAtual: { min: faixaAtual.fipe_min, max: faixaAtual.fipe_max, mensal: faixaAtual.valor_mensal },
      faixaInferior: { min: faixaInferior.fipe_min, max: faixaInferior.fipe_max, mensal: faixaInferior.valor_mensal },
      economia: faixaAtual.valor_mensal - faixaInferior.valor_mensal,
    };
  }, [valorFipe, planosSelecionados, todasFaixas, fipeMenorLimites, tipoVeiculoDetectado, planoCoberturasMap, allEligibilityRules]);

  // === Regra do 1% (FIPE Menor): quando elegível, os cards de plano abaixo
  // precisam refletir os preços da FAIXA INFERIOR — caso contrário a tela
  // mostra valores da faixa cheia mesmo após anunciar a redução.
  const aplicarFipeMenor =
    !!(fipeMenorAtivo && fipeMenorInfo?.elegivel && !fipeMenorInfo?.bloqueado);
  const valorFipeParaPlanos = aplicarFipeMenor
    ? (fipeMenorInfo?.faixaInferior?.max ?? fipeMenorInfo?.valorReduzido ?? valorFipe)
    : valorFipe;

  // Hook de planos calculados dinamicamente do banco
  const { planos: planosCalculados, planosNegados, isLoading: planosLoading } = usePlanosCotacao({
    valorFipe: valorFipeParaPlanos,
    valorAdicional,
    regiao: mapearRegiaoParaPricing(regiaoSelecionada || 'rj'),
    combustivel: combustivelSelecionado || veiculoEncontrado?.vehicleData?.combustivel || undefined,
    categoria: tipoPlacaSelecionado && tipoPlacaSelecionado !== 'nenhuma' ? tipoPlacaSelecionado : undefined,
    anoVeiculo: anoNumerico,
    tipoVeiculo: tipoVeiculoDetectado,
    usoApp: usoVeiculo.toLowerCase().includes('aplicativo') || usoVeiculo.toLowerCase().includes('app'),
    marca: marcaResolvida || undefined,
    modelo: modeloResolvido || undefined,
  });


  // Faixa de preço atual onde o FIPE se enquadra
  // FONTE: entity_eligibility_rules (motor moderno). Fallback: tabelas_preco_mensalidade (legado)
  const faixaAtualFipe = useMemo(() => {
    if (!valorFipe || valorFipe <= 0) return null;

    // Tenta motor moderno primeiro — usa o primeiro plano selecionado, ou o primeiro plano calculado
    const planoRef = planosSelecionados[0] || planosCalculados[0];
    if (planoRef?.id) {
      const faixa = obterFaixaFipeAtual(planoRef.id, planoCoberturasMap, allEligibilityRules as any, valorFipe);
      if (faixa) {
        return { min: faixa.de, max: faixa.ate - 0.01 };
      }
    }

    // Fallback: tabela legada
    if (todasFaixas.length === 0) return null;
    const matching = todasFaixas.filter(f => valorFipe >= f.fipe_min && valorFipe <= f.fipe_max);
    if (matching.length === 0) return null;
    const linhaPlano = planosSelecionados[0]?.linha || null;
    const preferred = linhaPlano ? matching.find(f => f.linha_slug === linhaPlano) : null;
    const faixa = preferred || matching.sort((a, b) => (b.fipe_max - b.fipe_min) - (a.fipe_max - a.fipe_min))[0];
    return { min: faixa.fipe_min, max: faixa.fipe_max };
  }, [valorFipe, todasFaixas, planosSelecionados, planosCalculados, planoCoberturasMap, allEligibilityRules]);
  // Marcas aceitas de motos
  const { data: marcasAceitasMotos } = useMarcasAceitasMotos();

  // Filtrar marcas por tipo e lista aceita (motos)
  const marcasFiltradas = useMemo(() => {
    return marcas
      .filter((m) => m.tipoFipe === tipoFipeSelecionado)
      .filter((m) => {
        if (tipoFipeSelecionado !== 'motos') return true;
        const lista = marcasAceitasMotos ?? [];
        return lista.some(aceita => m.nome.toLowerCase().includes(aceita.toLowerCase()));
      })
      .map((m) => ({ value: `${m.tipoFipe}:${m.codigo}`, label: m.nome }));
  }, [marcas, tipoFipeSelecionado, marcasAceitasMotos]);


  const dadosAssociadoValidos = useMemo(() => {
    const nomeValido = nomeAssociado.trim().length >= 3;
    const telefoneValido = telefoneAssociado.replace(/\D/g, '').length >= 10;
    return nomeValido && telefoneValido;
  }, [nomeAssociado, telefoneAssociado]);

  // Alerta da categoria selecionada — dinâmico baseado nas regras de elegibilidade reais
  const alertaCategoria = useMemo(() => {
    if (!tipoPlacaSelecionado) return null;
    return gerarAlertaCategoriaElegibilidade(
      tipoPlacaSelecionado,
      allEligibilityRules,
      coberturasGlobal.map(c => ({ id: c.id, nome: c.nome })),
      beneficiosGlobal.map(b => ({ id: b.id, name: b.name }))
    );
  }, [tipoPlacaSelecionado, allEligibilityRules, coberturasGlobal, beneficiosGlobal]);

  // Resetar formulário quando o modal abre sem leadId (exceto em modo edição ou duplicação)
  useEffect(() => {
    if (open && !leadId && !cotacaoParaEditar && !cotacaoBase) {
      if (isRestoringDraftRef.current) return;
      // Resetar todos os estados para começar limpo
      form.reset({
        lead_id: null,
        plano_id: '',
        valor_fipe: 0,
        valor_adicional: 0,
        valor_cota: 0,
        taxa_administrativa: 0,
        valor_rastreamento: 0,
        valor_adesao: 0,
        valor_total_mensal: 0,
        validade_dias: 7,
        vendedor_id: null,
      });
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanosSelecionados([]);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setNomeAssociado('');
      setTelefoneAssociado('');
      setEmailAssociado('');
      setIsIndicacao(false);
      setIndicadorId(null);
      setIndicadorNome('');
      setBuscaIndicador('');
      setUsoVeiculo('particular');
      setRegiaoSelecionada('');
      setDiaVencimento(null);
      setSolicitarFipeMenor(false);
      setJustificativaFipeMenor('');
      setTipoPlacaSelecionado('');
      setCombustivelSelecionado('');
    }
  }, [open, leadId, cotacaoParaEditar, cotacaoBase, form]);

  const restaurarVeiculoPorPlaca = useCallback(async (placaParaBuscar: string) => {
    const placaLimpa = placaParaBuscar.trim().toUpperCase();
    if (!placaLimpa) return;
    try {
      const resultado = await getByPlaca(placaLimpa);
      if (resultado.success && resultado.vehicleData) {
        setVeiculoEncontrado(resultado);
        setPlaca(resultado.extractedPlate || resultado.vehicleData.placa || placaLimpa);
        if (resultado.fipeData?.valor) form.setValue('valor_fipe', resultado.fipeData.valor);
        if (resultado.vehicleData.combustivel) setCombustivelSelecionado(resultado.vehicleData.combustivel.toLowerCase());
        toast.success('Dados do veículo recuperados pela placa.');
      }
    } catch (error) {
      console.warn('[restaurarVeiculoPorPlaca]', error);
      toast.info('Não foi possível recuperar os dados do veículo automaticamente. Busque a placa novamente.');
    }
  }, [form, getByPlaca]);

  // Carregar marcas quando dialog abre
  useEffect(() => {
    if (open && marcas.length === 0) {
      const fetchMarcas = async () => {
        setLoadingMarcas(true);
        try {
          const [dataCarros, dataMotos] = await Promise.all([
            getMarcas('carros'),
            getMarcas('motos'),
          ]);
          const marcasCarros = dataCarros.map(m => ({ ...m, tipoFipe: 'carros' as const }));
          const marcasMotos = dataMotos.map(m => ({ ...m, tipoFipe: 'motos' as const }));
          setMarcas([...marcasCarros, ...marcasMotos]);
        } catch (error) {
          console.error('Erro ao carregar marcas:', error);
        } finally {
          setLoadingMarcas(false);
        }
      };
      fetchMarcas();
    }
  }, [open, getMarcas, marcas.length]);

  // Auto-buscar FIPE quando marca, modelo e ano estiverem selecionados
  useEffect(() => {
    if (marcaSelecionada && modeloSelecionado && anoSelecionado) {
      const codigoMarca = marcaSelecionada.includes(':') ? marcaSelecionada.split(':')[1] : marcaSelecionada;
      const buscarFipeAutomatico = async () => {
        setBuscandoFipe(true);
        try {
          const resultado = await getPreco(codigoMarca, modeloSelecionado, anoSelecionado, tipoFipeSelecionado);
          if (resultado && resultado.valorNumerico) {
            form.setValue('valor_fipe', resultado.valorNumerico);
            toast.success(`Valor FIPE: ${resultado.valor}`);
          }
        } catch (error) {
          console.error('Erro ao buscar FIPE:', error);
        } finally {
          setBuscandoFipe(false);
        }
      };
      buscarFipeAutomatico();
    }
  }, [marcaSelecionada, modeloSelecionado, anoSelecionado, getPreco, form, tipoFipeSelecionado]);

  // Handler para mudança de marca
  const handleMarcaChange = async (value: string) => {
    setMarcaSelecionada(value);
    setModeloSelecionado('');
    setAnoSelecionado('');
    setModelos([]);
    setAnos([]);
    form.setValue('valor_fipe', 0);

    // Parse composite key "tipo:codigo"
    const [tipoPart, codigoPart] = value.split(':');
    const tipo = (tipoPart === 'motos' ? 'motos' : 'carros') as 'carros' | 'motos';
    setTipoFipeSelecionado(tipo);
    const codigoMarca = codigoPart || value;

    if (codigoMarca) {
      setLoadingModelos(true);
      try {
        const data = await getModelos(codigoMarca, tipo);
        setModelos(data);
      } catch (error) {
        console.error('Erro ao carregar modelos:', error);
      } finally {
        setLoadingModelos(false);
      }
    }
  };

  // Handler para mudança de modelo
  const handleModeloChange = async (value: string) => {
    setModeloSelecionado(value);
    setAnoSelecionado('');
    setAnos([]);
    form.setValue('valor_fipe', 0);

    const codigoMarca = marcaSelecionada.includes(':') ? marcaSelecionada.split(':')[1] : marcaSelecionada;
    if (codigoMarca && value) {
      setLoadingAnos(true);
      try {
        const data = await getAnos(codigoMarca, value, tipoFipeSelecionado);
        setAnos(data);
      } catch (error) {
        console.error('Erro ao carregar anos:', error);
      } finally {
        setLoadingAnos(false);
      }
    }
  };

  // Função de fuzzy match para encontrar melhor modelo
  const fuzzyMatchModelo = (modeloVeiculo: string, modeloFipe: string): number => {
    if (!modeloVeiculo || !modeloFipe) return 0;
    
    const veiculoNorm = modeloVeiculo.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const fipeNorm = modeloFipe.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (fipeNorm.includes(veiculoNorm) || veiculoNorm.includes(fipeNorm)) {
      return 100;
    }
    
    const palavraChave = veiculoNorm.split(' ')[0];
    if (palavraChave.length >= 3 && fipeNorm.includes(palavraChave)) {
      return 50;
    }
    
    const veiculoParts = veiculoNorm.split(' ').filter(p => p.length >= 2);
    const fipeParts = fipeNorm.split(' ').filter(p => p.length >= 2);
    
    let matches = 0;
    for (const vPart of veiculoParts) {
      if (fipeParts.some(fPart => fPart.includes(vPart) || vPart.includes(fPart))) {
        matches++;
      }
    }
    
    if (veiculoParts[0] && fipeParts.some(fp => fp.includes(veiculoParts[0]))) {
      matches += 3;
    }
    
    return matches * 10;
  };

  // Buscar por placa - SIMPLIFICADO: NÃO chama API FIPE após ter dados
  const buscarPorPlaca = async () => {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '');
    if (placaLimpa.length < 7) {
      toast.error('Digite a placa completa (7 caracteres)');
      return;
    }
    
    setBuscandoPlaca(true);
    try {
      // Em fluxo de Troca de Titularidade, a placa pertence ao associado antigo
      // e existe cotação anterior + veículo no SGA + vínculo na base local — todos
      // ESPERADOS. Pular as travas globais nesse caminho específico.
      const isTroca = shouldBypassPlateGuards(origemTroca);

      if (!isTroca) {
        const placaKey = placaNorm(placa);

        // Primeiro, verificar se a placa já está em cotação de outro vendedor
        const placaDuplicada = await verificarPlacaDuplicada.mutateAsync({ placa, ignorarIds: ignorarPlacaDuplicadaIds });

        if (placaDuplicada) {
          if (placaDuplicada.vendedorUserId !== user?.id) {
            if (!bypassPlacaDuplicada.has(placaKey)) {
              setPlacaDuplicadaInfo(placaDuplicada);
              setShowPlacaDuplicadaModal(true);
              setBuscandoPlaca(false);
              return;
            }
          } else {
            toast.info(`Você já possui uma cotação ativa para esta placa: ${placaDuplicada.numero}`);
          }
        }

        // Verificar se veículo existe no SGA (Hinova)
        try {
          const sgaResult = await verificarVeiculoSGA.mutateAsync(placa);
          if (sgaResult.existe && !bypassPlacaSGA.has(placaKey)) {
            setShowSGAModal(true);
            setBuscandoPlaca(false);
            return;
          }
        } catch (sgaError) {
          console.warn('[SGA] Erro na verificação, continuando:', sgaError);
        }

        // Verificar se a placa já está vinculada a OUTRO associado na base local
        try {
          const localResult = await verificarPlacaOutroAssoc.mutateAsync({ placa });
          if (localResult?.conflito && !bypassPlacaOutroAssoc.has(placaKey)) {
            setPlacaOutroAssocInfo(localResult);
            setShowPlacaOutroAssocModal(true);
            setBuscandoPlaca(false);
            return;
          }
          if (localResult?.mesmoTitular) {
            toast.info('Esta placa já está cadastrada para este CPF. Use Inclusão de Veículo no perfil do associado.');
          }
        } catch (localErr) {
          console.warn('[Local] Erro ao verificar veículo na base local:', localErr);
        }
      }

      const resultado = await getByPlaca(placa);
      
      if (resultado.success && resultado.vehicleData) {
        // Armazenar dados do veículo - SEM chamar API FIPE adicional
        setVeiculoEncontrado(resultado);
        
        // Limpar seleções manuais para não contaminar detecção de tipo
        setTipoFipeSelecionado('carros');
        setMarcaSelecionada('');
        setModeloSelecionado('');
        setAnoSelecionado('');
        setModelos([]);
        setAnos([]);
        
        // Auto-detectar combustível do veículo
        if (resultado.vehicleData.combustivel) {
          const combFipe = resultado.vehicleData.combustivel.toLowerCase();
          // Priorizar detecção de flex: se contém gasolina+álcool/alcool/etanol, é flex
          const isFlexFipe = combFipe.includes('flex') || 
            ((combFipe.includes('gasolina') || combFipe.includes('gas')) && 
             (combFipe.includes('alcool') || combFipe.includes('álcool') || combFipe.includes('etanol')));
          if (isFlexFipe) {
            setCombustivelSelecionado('flex');
          } else {
            const match = combustiveisBanco.find(c => 
              combFipe.includes(c.value) || combFipe.includes(c.label.toLowerCase())
            );
            if (match) setCombustivelSelecionado(match.value);
            else if (combFipe.includes('gasolina')) setCombustivelSelecionado('gasolina');
            else if (combFipe.includes('diesel')) setCombustivelSelecionado('diesel');
            else if (combFipe.includes('elétrico') || combFipe.includes('eletrico')) setCombustivelSelecionado('eletrico');
          }
        }

        // Preencher valor FIPE diretamente dos dados retornados
        if (resultado.fipeData?.valor) {
          form.setValue('valor_fipe', resultado.fipeData.valor);
          toast.success(`Veículo encontrado! FIPE: R$ ${resultado.fipeData.valor.toLocaleString('pt-BR')}`);
        } else {
          // Se não veio FIPE, tentar buscar por nome (fallback único)
          const anoVeiculo = resultado.vehicleData.ano?.split('/')[0] || '';
          try {
            const fipeResult = await buscarPorNome(
              resultado.vehicleData.marca,
              resultado.vehicleData.modelo,
              anoVeiculo,
              tipoVeiculoDetectado === 'moto' ? 'motos' : 'carros'
            );
            if (fipeResult?.valorNumerico) {
              form.setValue('valor_fipe', fipeResult.valorNumerico);
              toast.success(`Veículo encontrado! FIPE: ${fipeResult.valor}`);
            } else {
              toast.success(`Veículo encontrado: ${resultado.vehicleData.marca} ${resultado.vehicleData.modelo}`);
              toast.info('Informe o valor FIPE manualmente se necessário');
            }
          } catch {
            toast.success(`Veículo encontrado: ${resultado.vehicleData.marca} ${resultado.vehicleData.modelo}`);
            toast.info('Informe o valor FIPE manualmente se necessário');
          }
        }
      } else {
        toast.error(resultado.error || 'Veículo não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar placa:', error);
      toast.error('Erro ao buscar veículo pela placa');
    } finally {
      setBuscandoPlaca(false);
    }
  };

  // Auto-busca a placa quando o cotador é aberto via fluxo de Troca de Titularidade
  // (a placa já vem pré-preenchida e o usuário não precisa clicar na lupa).
  useEffect(() => {
    if (!open) {
      autoBuscaPlacaRef.current = null;
      return;
    }
    if (!origemTroca) return;
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (placaLimpa.length !== 7) return;
    if (veiculoEncontrado || buscandoPlaca) return;
    if (autoBuscaPlacaRef.current === placaLimpa) return;
    autoBuscaPlacaRef.current = placaLimpa;
    buscarPorPlaca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, origemTroca, placa, veiculoEncontrado, buscandoPlaca]);

  // Pre-fill from lead
  useEffect(() => {
    if (lead) {
      form.setValue('lead_id', lead.id);
      // Preencher dados do associado do lead
      setNomeAssociado(lead.nome || '');
      setTelefoneAssociado(lead.telefone || '');
      setEmailAssociado(lead.email || '');
      
      if (lead.veiculo_fipe) {
        form.setValue('valor_fipe', lead.veiculo_fipe);
      }
      if (lead.veiculo_placa) {
        setPlaca(lead.veiculo_placa);
      }
      if (lead.veiculo_marca && lead.veiculo_modelo) {
        setVeiculoEncontrado({
          success: true,
          vehicleData: {
            marca: lead.veiculo_marca,
            modelo: lead.veiculo_modelo,
            marca_modelo: `${lead.veiculo_marca} ${lead.veiculo_modelo}`,
            ano: lead.veiculo_ano ? String(lead.veiculo_ano) : '',
            placa: lead.veiculo_placa || '',
            cor: '',
            chassi: '',
            municipio: '',
            uf: '',
            combustivel: ''
          },
          fipeData: lead.veiculo_fipe ? {
            valor: lead.veiculo_fipe,
            codigo: null,
            mesReferencia: null
          } : null
        });
      }
    }
  }, [lead, form]);

  // Efeito para preencher o formulário com dados da cotação base (duplicação)
  useEffect(() => {
    if (cotacaoBase && open) {
      // Preencher dados do formulário
      if (cotacaoBase.valor_fipe) {
        form.setValue('valor_fipe', cotacaoBase.valor_fipe);
      }
      if (cotacaoBase.valor_adicional) {
        form.setValue('valor_adicional', cotacaoBase.valor_adicional);
      }
      if (cotacaoBase.valor_adesao !== null && cotacaoBase.valor_adesao !== undefined) {
        form.setValue('valor_adesao', cotacaoBase.valor_adesao);
      }
      if (cotacaoBase.validade_dias) {
        form.setValue('validade_dias', cotacaoBase.validade_dias);
      }
      if (cotacaoBase.lead_id) {
        form.setValue('lead_id', cotacaoBase.lead_id);
      }
      if (cotacaoBase.plano_id) {
        form.setValue('plano_id', cotacaoBase.plano_id);
      }
      
      // Preencher dados do solicitante
      setNomeAssociado(cotacaoBase.nome_solicitante || '');
      setTelefoneAssociado(cotacaoBase.telefone1_solicitante || '');
      setEmailAssociado(cotacaoBase.email_solicitante || '');
      
      // Preencher placa
      if (cotacaoBase.veiculo_placa) {
        setPlaca(cotacaoBase.veiculo_placa);
      }
      
      // Preencher categoria → tipo de placa
      if (cotacaoBase.categoria) {
        setTipoPlacaSelecionado(cotacaoBase.categoria);
      }
      
      // Preencher região
      if (cotacaoBase.regiao) {
        setRegiaoSelecionada(cotacaoBase.regiao);
      }
      
      // Preencher dados do veículo encontrado
      if (cotacaoBase.veiculo_marca && cotacaoBase.veiculo_modelo) {
        setVeiculoEncontrado({
          success: true,
          vehicleData: {
            marca: cotacaoBase.veiculo_marca,
            modelo: cotacaoBase.veiculo_modelo,
            marca_modelo: `${cotacaoBase.veiculo_marca} ${cotacaoBase.veiculo_modelo}`,
            ano: cotacaoBase.veiculo_ano ? String(cotacaoBase.veiculo_ano) : '',
            placa: cotacaoBase.veiculo_placa || '',
            cor: '',
            chassi: '',
            municipio: '',
            uf: '',
            combustivel: ''
          },
          fipeData: cotacaoBase.valor_fipe ? {
            valor: cotacaoBase.valor_fipe,
            codigo: cotacaoBase.codigo_fipe,
            mesReferencia: null
          } : null
        });
      } else if (cotacaoBase.veiculo_placa) {
        restaurarVeiculoPorPlaca(cotacaoBase.veiculo_placa);
      }
    }
  }, [cotacaoBase, open, form, restaurarVeiculoPorPlaca]);

  // Efeito para preencher o formulário com dados da cotação para edição
  useEffect(() => {
    if (cotacaoParaEditar && open) {
      // Preencher dados do formulário
      if (cotacaoParaEditar.valor_fipe) {
        form.setValue('valor_fipe', cotacaoParaEditar.valor_fipe);
      }
      if (cotacaoParaEditar.valor_adicional) {
        form.setValue('valor_adicional', cotacaoParaEditar.valor_adicional);
      }
      if (cotacaoParaEditar.valor_adesao !== null && cotacaoParaEditar.valor_adesao !== undefined) {
        form.setValue('valor_adesao', cotacaoParaEditar.valor_adesao);
      }
      if (cotacaoParaEditar.validade_dias) {
        form.setValue('validade_dias', cotacaoParaEditar.validade_dias);
      }
      if (cotacaoParaEditar.lead_id) {
        form.setValue('lead_id', cotacaoParaEditar.lead_id);
      }
      if (cotacaoParaEditar.plano_id) {
        form.setValue('plano_id', cotacaoParaEditar.plano_id);
      }
      
      // Preencher dados do solicitante
      setNomeAssociado(cotacaoParaEditar.nome_solicitante || '');
      setTelefoneAssociado(cotacaoParaEditar.telefone1_solicitante || '');
      setEmailAssociado(cotacaoParaEditar.email_solicitante || '');
      
      // Preencher indicação
      if (cotacaoParaEditar.indicador_id) {
        setIsIndicacao(true);
        setIndicadorId(cotacaoParaEditar.indicador_id);
        setIndicadorNome(cotacaoParaEditar.indicador_nome || '');
      }
      
      // Preencher placa
      if (cotacaoParaEditar.veiculo_placa) {
        setPlaca(cotacaoParaEditar.veiculo_placa);
      }
      
      // Preencher categoria → tipo de placa
      if (cotacaoParaEditar.categoria) {
        setTipoPlacaSelecionado(cotacaoParaEditar.categoria);
      }
      
      // Preencher região
      if (cotacaoParaEditar.regiao) {
        setRegiaoSelecionada(cotacaoParaEditar.regiao);
      }
      
      // Preencher dados do veículo encontrado
      if (cotacaoParaEditar.veiculo_marca && cotacaoParaEditar.veiculo_modelo) {
        setVeiculoEncontrado({
          success: true,
          vehicleData: {
            marca: cotacaoParaEditar.veiculo_marca,
            modelo: cotacaoParaEditar.veiculo_modelo,
            marca_modelo: `${cotacaoParaEditar.veiculo_marca} ${cotacaoParaEditar.veiculo_modelo}`,
            ano: cotacaoParaEditar.veiculo_ano ? String(cotacaoParaEditar.veiculo_ano) : '',
            placa: cotacaoParaEditar.veiculo_placa || '',
            cor: '',
            chassi: '',
            municipio: '',
            uf: '',
            combustivel: ''
          },
          fipeData: cotacaoParaEditar.valor_fipe ? {
            valor: cotacaoParaEditar.valor_fipe,
            codigo: cotacaoParaEditar.codigo_fipe,
            mesReferencia: null
          } : null
        });
      } else if (cotacaoParaEditar.veiculo_placa) {
        restaurarVeiculoPorPlaca(cotacaoParaEditar.veiculo_placa);
      }
    }
  }, [cotacaoParaEditar, open, form, restaurarVeiculoPorPlaca]);

  // Restaurar planos selecionados ao editar cotação (após planosCalculados carregarem)
  useEffect(() => {
    if (!cotacaoParaEditar || !open) return;
    const planosComparacao = cotacaoParaEditar.dados_extras?.planos_comparacao;
    if (!planosComparacao || planosComparacao.length === 0) return;
    if (planosCalculados.length === 0) return;

    // Cruzar IDs salvos com planos disponíveis para obter objetos completos
    const idsRestaurar = new Set(planosComparacao.map(p => p.id));
    const matches = planosCalculados.filter(p => idsRestaurar.has(p.id));

    if (matches.length > 0) {
      setPlanosSelecionados(prev => {
        // Só restaurar se ainda não tiver planos selecionados (evitar loop)
        if (prev.length > 0) return prev;
        return matches;
      });
    }
  }, [cotacaoParaEditar, open, planosCalculados]);

  useEffect(() => {
    if (planosCalculados.length === 0) return;

    setPlanosSelecionados(prev => {
      if (prev.length === 0) return prev;

      const planosAtualizados = prev.map(planoSelecionado =>
        planosCalculados.find(plano => plano.id === planoSelecionado.id) || planoSelecionado
      );

      const primeiro = planosAtualizados[0];
      const adicional = form.getValues('valor_adicional') || 0;

      form.setValue('plano_id', primeiro.id);
      form.setValue('valor_cota', primeiro.valorCota || 0);
      form.setValue('taxa_administrativa', primeiro.taxaAdministrativa || 0);
      form.setValue('valor_rastreamento', primeiro.valorRastreamento || 0);
      form.setValue('valor_total_mensal', primeiro.valorMensal + adicional);

      const mudou = planosAtualizados.some((plano, index) => plano !== prev[index]);
      return mudou ? planosAtualizados : prev;
    });
  }, [planosCalculados, form]);

  const handleTogglePlano = (plano: PlanoCotacao) => {
    setPlanosSelecionados(prev => {
      const jaExiste = prev.some(p => p.id === plano.id);
      if (jaExiste) {
        // Remove o plano
        const novos = prev.filter(p => p.id !== plano.id);
        // Se restam planos, atualiza o form com o primeiro
        if (novos.length > 0) {
          const primeiro = novos[0];
          form.setValue('plano_id', primeiro.id);
          form.setValue('valor_cota', primeiro.valorCota || 0);
          form.setValue('taxa_administrativa', primeiro.taxaAdministrativa || 0);
          form.setValue('valor_rastreamento', primeiro.valorRastreamento || 0);
          // NÃO sobrescrever valor_adesao aqui — ele é auto-calculado pelo useEffect (1% FIPE)
          const adicional = form.getValues('valor_adicional') || 0;
          form.setValue('valor_total_mensal', primeiro.valorMensal + adicional);
        } else {
          form.setValue('plano_id', '');
        }
        return novos;
      }
      // Adiciona o plano (sem limite de quantidade)
      const novos = [...prev, plano];
      // Se for o primeiro, define no form
      if (novos.length === 1) {
        form.setValue('plano_id', plano.id);
        form.setValue('valor_cota', plano.valorCota || 0);
        form.setValue('taxa_administrativa', plano.taxaAdministrativa || 0);
        form.setValue('valor_rastreamento', plano.valorRastreamento || 0);
        // NÃO sobrescrever valor_adesao aqui — ele é auto-calculado pelo useEffect (1% FIPE)
        const adicional = form.getValues('valor_adicional') || 0;
        form.setValue('valor_total_mensal', plano.valorMensal + adicional);
      }
      return novos;
    });
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Get marca/modelo names for display
  const getMarcaNome = () => {
    if (veiculoEncontrado?.vehicleData?.marca) return veiculoEncontrado.vehicleData.marca;
    const codigoMarca = marcaSelecionada.includes(':') ? marcaSelecionada.split(':')[1] : marcaSelecionada;
    const marca = marcas.find(m => m.codigo === codigoMarca);
    return marca?.nome || '';
  };

  const getModeloNome = () => {
    if (veiculoEncontrado?.vehicleData?.modelo) return veiculoEncontrado.vehicleData.modelo;
    const modelo = modelos.find(m => m.codigo.toString() === modeloSelecionado);
    return modelo?.nome || '';
  };

  const getAnoNome = () => {
    if (veiculoEncontrado?.vehicleData?.ano) return veiculoEncontrado.vehicleData.ano;
    const ano = anos.find(a => a.codigo === anoSelecionado);
    return ano?.nome || '';
  };

  // Copiar valores para clipboard
  const copiarValores = () => {
    if (planosSelecionados.length === 0) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    let texto = `*Cotação Praticcar*\n` +
      `Associado: ${nomeAssociado}\n` +
      `Veículo: ${veiculoInfo}\n` +
      `Uso: ${tiposUsoAtivos.find(t => t.value === usoVeiculo)?.label || usoVeiculo}\n` +
      `FIPE: ${formatCurrency(valorFipe)}\n\n`;
    
    if (planosSelecionados.length === 1) {
      const plano = planosSelecionados[0];
      texto += `Plano: ${plano.nome}\n` +
        `Proteção Mensal: ${formatCurrency(plano.valorMensal + valorAdicional)}\n`;
    } else {
      texto += `*Comparativo de Planos:*\n`;
      planosSelecionados.forEach((plano, idx) => {
        texto += `${idx + 1}. ${plano.nome}: ${formatCurrency(plano.valorMensal + valorAdicional)}/mês\n`;
      });
    }
    
    texto += `\nTaxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}\n` +
      `Validade: ${validadeDias} dias`;
    
    navigator.clipboard.writeText(texto);
    toast.success('Valores copiados!');
  };

  // Enviar por WhatsApp
  const enviarWhatsApp = () => {
    if (planosSelecionados.length === 0) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    const telefoneFormatado = telefoneAssociado.replace(/\D/g, '');
    
    let texto = `*Cotação Praticcar*\n` +
      `Associado: ${nomeAssociado}\n` +
      `Veículo: ${veiculoInfo}\n` +
      `Uso: ${tiposUsoAtivos.find(t => t.value === usoVeiculo)?.label || usoVeiculo}\n` +
      `FIPE: ${formatCurrency(valorFipe)}\n\n`;
    
    if (planosSelecionados.length === 1) {
      const plano = planosSelecionados[0];
      texto += `Plano: ${plano.nome}\n` +
        `Proteção Mensal: ${formatCurrency(plano.valorMensal + valorAdicional)}\n`;
    } else {
      texto += `*Comparativo de Planos:*\n`;
      planosSelecionados.forEach((plano, idx) => {
        texto += `${idx + 1}. ${plano.nome}: ${formatCurrency(plano.valorMensal + valorAdicional)}/mês\n`;
      });
    }
    
    texto += `\nTaxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}\n` +
      `Validade: ${validadeDias} dias`;
    
    const whatsappUrl = telefoneFormatado.length >= 10 
      ? `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Abre o popup de confirmação de adesão
  const onSubmit = (data: CotacaoFormData) => {
    // Validar dados do associado
    if (!dadosAssociadoValidos) {
      toast.error('Preencha o nome e telefone do associado!');
      return;
    }
    
    // Regra do 1% (Redução de Cota) agora é automática quando elegível —
    // sem checkbox/justificativa, sem trava. Supervisores apenas tomam ciência depois.

    // Vendedor externo: validar cenário obrigatório
    if (!cenarioExterno) {
      toast.error('Selecione o cenário de adesão e instalação antes de continuar.');
      return;
    }

    // Dia de vencimento é OBRIGATÓRIO — evita gravar NULL e cair em fallback dia 10 no backend
    if (!diaVencimento || !opcoesVencimento.includes(diaVencimento as 5 | 10 | 15 | 20 | 25 | 30)) {
      toast.error(`Selecione o dia de vencimento das mensalidades (${opcoesVencimento.join(' ou ')}).`);
      // Levar o consultor até o bloco
      try {
        document.getElementById('bloco-dia-vencimento')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch { /* noop */ }
      return;
    }

    // Validação de adesão: pular para externo com cenário isento
    if (!isCenarioIsento) {
      if (data.valor_adesao <= 0) {
        toast.error('O valor de adesão deve ser maior que zero!');
        return;
      }
      
      // Validar valor mínimo de adesão dinâmico
      if (!isCenarioSemMinimo && data.valor_adesao < minimoAdesaoConfig) {
        toast.error(`O valor de adesão (${formatCurrency(data.valor_adesao)}) está abaixo do mínimo configurado (${formatCurrency(minimoAdesaoConfig)}).`);
        return;
      }
    }
    
    // Alertar se valor estiver muito diferente do plano selecionado (não alertar em cenários isentos)
    if (!isCenarioIsento && planosSelecionados.length > 0) {
      const valorPlano = planosSelecionados[0].valorAdesao || 199.90;
      if (data.valor_adesao < valorPlano * 0.5) {
        toast.warning(`Atenção: O valor de adesão (${formatCurrency(data.valor_adesao)}) está bem abaixo do sugerido pelo plano (${formatCurrency(valorPlano)}). Verifique se está correto.`);
      }
    }
    
    // Guardar dados e abrir popup de confirmação
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  // Handler quando confirmar no popup
  const handleConfirmSubmit = async () => {
    if (!pendingFormData || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Extrair ano numérico do texto (ex: "2022 Gasolina" -> 2022)
      const anoTextoLocal = getAnoNome();
      const anoNumericoLocal = anoTextoLocal ? parseInt(anoTextoLocal.split(' ')[0]) : null;
      const marcaVeiculo = getMarcaNome() || veiculoEncontrado?.vehicleData?.marca || null;
      const modeloVeiculo = getModeloNome() || veiculoEncontrado?.vehicleData?.modelo || null;
      const anoVeiculo = anoNumericoLocal || Number(veiculoEncontrado?.vehicleData?.ano_modelo || veiculoEncontrado?.vehicleData?.ano?.split('/')[0]) || null;

      if (veiculoEncontrado?.success && (!marcaVeiculo || !modeloVeiculo || !anoVeiculo)) {
        toast.error('Os dados do veículo ainda não foram carregados. Clique em buscar placa novamente antes de salvar.');
        setIsSubmitting(false);
        return;
      }
      
      const valorAdicionalAtual = pendingFormData.valor_adicional || 0;
      
      const cotacaoData = {
        lead_id: pendingFormData.lead_id || null,
        plano_id: pendingFormData.plano_id,
        valor_fipe: pendingFormData.valor_fipe,
        valor_adicional: valorAdicionalAtual,
        valor_cota: pendingFormData.valor_cota,
        taxa_administrativa: pendingFormData.taxa_administrativa,
        valor_rastreamento: pendingFormData.valor_rastreamento,
        valor_adesao: pendingFormData.valor_adesao,
        valor_total_mensal: pendingFormData.valor_total_mensal,
        valor_assistencia: planosSelecionados[0]?.valorAssistencia || 0,
        validade_dias: pendingFormData.validade_dias,
        // Dados do veículo
        veiculo_marca: marcaVeiculo,
        veiculo_modelo: modeloVeiculo,
        veiculo_ano: anoVeiculo,
        veiculo_placa: isZeroKm ? null : (placa || veiculoEncontrado?.extractedPlate || null),
        // 0KM: marca fonte de verdade para contrato-gerar / SGA Hinova / Softruck.
        // Ver mem://logic/quotation/cotacao-0km-fluxo-canonico
        veiculo_zero_km: isZeroKm || null,
        veiculo_cor: veiculoEncontrado?.vehicleData?.cor || null,
        // Número de portas vindo do CRLV/plate-lookup (snapshot para o termo)
        numero_portas: (() => {
          const raw = (veiculoEncontrado?.vehicleData as any)?.numero_portas;
          const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        codigo_fipe: veiculoEncontrado?.fipeData?.codigo || null,
        // Dados do solicitante (para exibição no card quando não há lead)
        nome_solicitante: nomeAssociado.trim() || null,
        telefone1_solicitante: telefoneAssociado.replace(/\D/g, '') || null,
        email_solicitante: emailAssociado.trim() || null,
        // Categoria do veículo
        categoria: tipoPlacaSelecionado && tipoPlacaSelecionado !== 'nenhuma' ? tipoPlacaSelecionado : null,
        // Dia de vencimento
        dia_vencimento: diaVencimento,
        // Região selecionada
        regiao: regiaoSelecionada || null,
        uso_aplicativo: usoVeiculo.toLowerCase().includes('aplicativo') || usoVeiculo.toLowerCase().includes('app'),
        // Combustível e tipo de uso
        combustivel: combustivelSelecionado || null,
        veiculo_combustivel: combustivelSelecionado || veiculoEncontrado?.vehicleData?.combustivel || null,
        // Câmbio (canônico 'manual'|'automatico') extraído pelo plate-lookup —
        // usado no termo de afiliação. Ver mem: campo veiculo_cambio.
        veiculo_cambio: (veiculoEncontrado?.vehicleData as any)?.cambio_normalizado || null,
        veiculo_tipo_uso: usoVeiculo || null,
        // Indicação
        indicador_id: indicadorId || null,
        indicador_nome: indicadorNome || null,
        // Cenário de adesão e tipo de instalação
        ...(cenarioExterno ? {
          tipo_instalacao: cenarioExterno.includes('rota') ? 'rota' as const : 'base' as const,
          cenario_adesao: cenarioExterno,
        } : {}),
        // Tipo da cotação (informativo) — coluna direta + espelho em dados_extras
        tipo_entrada: (origemTroca ? 'troca_titularidade' : (tipoCotacao || 'adesao')) as any,
        // Planos para comparação (múltiplos planos selecionados)
        dados_extras: {
          planos_comparacao: planosSelecionados.map(p => ({
            id: p.id,
            nome: p.nome,
            codigo: p.codigo,
            valorMensal: p.valorMensal + valorAdicionalAtual,
            valorAdesao: form.getValues('valor_adesao') || 0,
            coberturas: p.coberturas || [],
            naoInclui: p.naoInclui || [],
            coberturaFipe: p.coberturaFipe || 100,
            cota: p.cota,
            cotaPercentual: p.cotaPercentual,
            cotaMinima: p.cotaMinima,
            cotaDesagio: p.cotaDesagio,
            cotaMinimaDesagio: p.cotaMinimaDesagio,
            adicionalMensal: p.adicionalMensal,
            anoMinimo: p.anoMinimo,
            alertaDesagio: p.alertaDesagio,
            coberturasRemovidas: p.coberturasRemovidas || [],
          })),
          // Tipo da cotação (informativo) espelhado
          tipo_entrada: (origemTroca ? 'troca_titularidade' : (tipoCotacao || 'adesao')) as string,
          ...(tipoCotacao === 'outro' && tipoCotacaoOutro.trim()
            ? { tipo_entrada_descricao: tipoCotacaoOutro.trim() }
            : {}),
          // Marcação de origem para Troca de Titularidade (quando aplicável)
          ...(origemTroca ? {
            solicitacao_troca_id: origemTroca.solicitacaoId,
            associado_antigo_id: origemTroca.associadoAntigoId,
            veiculo_origem_id: origemTroca.veiculoOrigemId,
          } : {}),
        },
      };

      if (isEditando && cotacaoParaEditar) {
        // Modo edição: atualizar cotação existente
        await updateCotacao.mutateAsync({
          id: cotacaoParaEditar.id,
          ...cotacaoData,
        });
        
        toast.success('Cotação atualizada com sucesso!');
        
        // Callback de sucesso (para registrar histórico, etc)
        onSuccess?.();
      } else {
        // Modo criação: criar nova cotação
        // vendedor_id sempre referencia auth.users(id) (ID de login)
        const vendedorIdFinal = podeAtribuirVendedor
          ? (pendingFormData.vendedor_id || userId || user?.id)
          : (userId || user?.id);

        if (!vendedorIdFinal) {
          toast.error('Não foi possível identificar o consultor responsável. Atualize a página ou selecione outro consultor.');
          throw new Error('vendedor_id ausente ao criar cotação');
        }

        // Pré-validação de campos NOT NULL no banco — evita INSERT que sempre falharia
        // com 23502 (not-null violation) quando o cálculo do plano ainda não terminou.
        const valorFipePayload = Number(cotacaoData.valor_fipe ?? 0);
        const valorCotaPayload = Number(cotacaoData.valor_cota ?? 0);
        const valorMensalPayload = Number(cotacaoData.valor_total_mensal ?? 0);
        if (!(valorFipePayload > 0) || !(valorCotaPayload > 0) || !(valorMensalPayload > 0)) {
          toast.error('Aguarde o cálculo do plano terminar antes de criar a cotação.');
          throw new Error('Campos obrigatórios de valor ainda não calculados');
        }

        const novaCotacao = await createCotacao.mutateAsync({
          ...cotacaoData,
          // Guard: indicador_id é UUID; nunca enviar matrícula/string vazia
          indicador_id: isUuid(cotacaoData.indicador_id) ? cotacaoData.indicador_id : null,
          // Regra do 1% automática: marca flag se elegível (o registro de ciência abaixo confirma).
          solicitar_fipe_menor: !!(fipeMenorAtivo && fipeMenorInfo?.elegivel && fipeMenorInfo?.faixaInferior),
          status: 'rascunho',
          vendedor_id: vendedorIdFinal,
        });

        // Redução de Cota (Regra do 1%): aplicação AUTOMÁTICA quando elegível.
        // - Cotação já é gravada com faixa reduzida e fipe_menor_aprovado=true via o hook.
        // - Supervisor só precisa "marcar como ciente" depois (sem trava).
        if (fipeMenorAtivo && fipeMenorInfo?.elegivel && fipeMenorInfo?.faixaAtual && fipeMenorInfo?.faixaInferior && novaCotacao?.id) {
          await registrarCienciaFipeMenor.mutateAsync({
            cotacao_id: novaCotacao.id,
            fipe_real: valorFipe,
            fipe_faixa_original_min: fipeMenorInfo.faixaAtual.min,
            fipe_faixa_original_max: fipeMenorInfo.faixaAtual.max,
            fipe_faixa_solicitada_min: fipeMenorInfo.faixaInferior.min,
            fipe_faixa_solicitada_max: fipeMenorInfo.faixaInferior.max,
            valor_mensal_original: fipeMenorInfo.faixaAtual.mensal,
            valor_mensal_reduzido: fipeMenorInfo.faixaInferior.mensal,
          });
        }
        
        // Se FIPE acima do limite E dupla aprovação ativa, criar solicitação e notificar diretoria
        if (novaCotacao?.id && configLimites && valorFipe > 0 && configDuplaAprovacao?.ativa) {
          const limiteAplicavel = tipoVeiculoDetectado === 'moto' 
            ? configLimites.fipeLimiteAutorizacaoMoto 
            : configLimites.fipeLimiteAutorizacao;
          if (valorFipe > limiteAplicavel) {
            try {
              await criarSolicitacaoFipeLimite.mutateAsync({
                cotacao_id: novaCotacao.id,
                valor_fipe: valorFipe,
                limite_aplicado: limiteAplicavel,
                tipo_veiculo: tipoVeiculoDetectado,
                veiculo_marca: veiculoEncontrado?.vehicleData?.marca || getMarcaNomeFromCodigo(marcaSelecionada) || undefined,
                veiculo_modelo: veiculoEncontrado?.vehicleData?.modelo || modeloResolvido || undefined,
                veiculo_ano: anoNumerico,
                veiculo_placa: placa || undefined,
                nome_solicitante: nomeAssociado || undefined,
              });
              toast.info('Solicitação de aprovação interna FIPE alto valor enviada automaticamente.');

              // Notificar diretoria via WhatsApp
              try {
                await supabase.functions.invoke('notificar-diretoria-fipe', {
                  body: {
                    cotacao_id: novaCotacao.id,
                    valor_fipe: valorFipe,
                    limite_aplicado: limiteAplicavel,
                    tipo_veiculo: tipoVeiculoDetectado,
                    veiculo_marca: veiculoEncontrado?.vehicleData?.marca || getMarcaNomeFromCodigo(marcaSelecionada) || undefined,
                    veiculo_modelo: veiculoEncontrado?.vehicleData?.modelo || modeloResolvido || undefined,
                    veiculo_ano: anoNumerico,
                    veiculo_placa: placa || undefined,
                    nome_solicitante: nomeAssociado || undefined,
                  },
                });
              } catch (e) {
                console.error('Erro ao notificar diretoria FIPE:', e);
              }
            } catch (e) {
              console.error('Erro ao criar solicitação FIPE limite:', e);
            }
          }
        }

        // Se a cotação foi originada de uma Troca de Titularidade, vincular agora.
        // CRÍTICO: a vinculação NÃO pode falhar silenciosamente — sem ela a cotação
        // fica órfã da solicitação, o link público não enxerga `liberada_para_assinatura`,
        // o contrato nunca é gerado e o cliente trava na etapa de Pagamento.
        //
        // ⚠ Usamos `fetch` direto em vez de `supabase.functions.invoke()` porque o
        // proxy de fetch da Preview da Lovable (lovable.js) intercepta chamadas via
        // `functions.invoke` e ocasionalmente lança `FunctionsFetchError: Failed to
        // send a request to the Edge Function` ANTES de a requisição sair do
        // navegador. Logs do Supabase confirmam que, nesses casos, a edge nem é
        // acionada. `fetch` direto same-origin contorna o proxy.
        const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

        async function chamarEdge<T = any>(
          name: string,
          body: any,
          opts: { timeoutMs?: number } = {},
        ): Promise<T> {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || SUPABASE_ANON;
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000);
          let res: Response;
          try {
            res = await fetch(`${SUPABASE_FUNCTIONS_URL}/${name}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                apikey: SUPABASE_ANON,
              },
              body: JSON.stringify(body),
              signal: ctrl.signal,
            });
          } catch (netErr: any) {
            const transp: any = new Error(
              netErr?.name === 'AbortError'
                ? `Timeout ao chamar ${name}`
                : `Falha de rede ao chamar ${name}: ${netErr?.message || netErr}`,
            );
            transp.code = 'TRANSPORTE';
            transp.cause = netErr;
            throw transp;
          } finally {
            clearTimeout(t);
          }
          const text = await res.text();
          let payload: any = null;
          try { payload = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }
          if (!res.ok) {
            const err: any = new Error(
              payload?.error || `HTTP ${res.status} em ${name}`,
            );
            err.code = payload?.code || `HTTP_${res.status}`;
            err.status = res.status;
            err.payload = payload ?? text;
            throw err;
          }
          if (payload && payload.success === false) {
            const err: any = new Error(payload.error || `${name} retornou success=false`);
            err.code = payload.code || 'NEGOCIO';
            err.payload = payload;
            throw err;
          }
          return payload as T;
        }

        if (origemTroca && novaCotacao?.id) {
          try {
            await chamarEdge('vincular-cotacao-troca', {
              solicitacao_id: origemTroca.solicitacaoId,
              cotacao_id: novaCotacao.id,
            });
            toast.success('Cotação vinculada à troca de titularidade.');
            navigate(`/vendas/cotacoes?abrir=${novaCotacao.id}`);
          } catch (e: any) {
            const tipo = e?.code === 'TRANSPORTE' ? 'transporte' : 'negocio';
            console.error('[vincular-cotacao-troca] FALHA — iniciando rollback', {
              tipo,
              solicitacao_id: origemTroca.solicitacaoId,
              cotacao_id: novaCotacao.id,
              url: `${SUPABASE_FUNCTIONS_URL}/vincular-cotacao-troca`,
              error_code: e?.code,
              error_status: e?.status,
              error_message: e?.message,
              payload: e?.payload,
              error: e,
            });
            let rollbackOk = false;
            try {
              await chamarEdge('delete-cotacao', {
                cotacaoId: novaCotacao.id,
                motivo: 'Rollback automático: falha ao vincular à troca de titularidade',
              });
              rollbackOk = true;
            } catch (delErr: any) {
              console.error('[vincular-cotacao-troca] rollback via edge falhou — tentando delete direto', {
                tipo: delErr?.code === 'TRANSPORTE' ? 'transporte' : 'negocio',
                error_code: delErr?.code,
                error_status: delErr?.status,
                error_message: delErr?.message,
                payload: delErr?.payload,
              });
              try {
                const { error: rawDelErr } = await supabase
                  .from('cotacoes')
                  .delete()
                  .eq('id', novaCotacao.id);
                if (rawDelErr) throw rawDelErr;
                rollbackOk = true;
              } catch (rawErr) {
                console.error('[vincular-cotacao-troca] rollback direto também falhou — cotação pode ter ficado órfã', {
                  cotacao_id: novaCotacao.id,
                  error: rawErr,
                });
              }
            }
            const code = e?.code;
            const baseMsg =
              code === 'JA_VINCULADA'
                ? 'Esta solicitação de troca já tem outra cotação vinculada.'
                : code === 'COTACAO_NAO_PERTENCE'
                ? 'A cotação não corresponde a esta solicitação de troca.'
                : code === 'TERMO_NAO_ASSINADO'
                ? 'O termo de cancelamento ainda não foi assinado pelo titular antigo.'
                : code === 'TRANSPORTE'
                ? 'Falha de rede ao contatar o servidor para vincular a cotação. Verifique sua conexão e tente novamente.'
                : 'Não foi possível vincular a cotação à troca de titularidade.';
            toast.error(
              baseMsg + (rollbackOk
                ? ' A cotação foi descartada — tente novamente em instantes.'
                : ' Atenção: a cotação NÃO pôde ser descartada automaticamente. Use a ação "Excluir cotação órfã" no painel de Outros Processos ou contate o suporte.'),
              { duration: 8000 }
            );
            // Bloquear navegação: usuário fica no dialog para tentar de novo
            return;
          }
        } else {
          toast.success('Cotação criada com sucesso!');
          navigate('/vendas/cotacoes');
        }
      }
      // Cotação criada/atualizada com sucesso → descartar rascunho local
      draft.clearOnSubmit();

      // Resetar estados
      form.reset();
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanosSelecionados([]);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setPendingFormData(null);
      setNomeAssociado('');
      setTelefoneAssociado('');
      setEmailAssociado('');
      setIsIndicacao(false);
      setIndicadorId(null);
      setIndicadorNome('');
      setBuscaIndicador('');
      
      setUsoVeiculo('particular');
      setRegiaoSelecionada('');
      setDiaVencimento(null);
      setSolicitarFipeMenor(false);
      setJustificativaFipeMenor('');
      setCenarioExterno(null);
      setTipoPlacaSelecionado('');
      setCombustivelSelecionado('');

      setShowConfirmDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      // Log estruturado para diagnóstico (sem valores sensíveis — só chaves do payload)
      try {
        const payloadKeys = pendingFormData ? Object.keys(pendingFormData) : [];
        console.error('[criarCotacao]', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          payloadKeys,
        });
      } catch {
        console.error(error);
      }

      const ctx = isEditando ? 'atualizar cotação' : 'criar cotação';
      const msg = descreverErroSupabase(error, { contexto: ctx });
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] max-h-[90dvh] max-sm:max-h-[100dvh] flex flex-col overflow-hidden p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Cotação Rápida
          </DialogTitle>
          <DialogDescription>
            {lead ? `Cotação para ${lead.nome}` : 'Faça uma cotação em segundos'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 pb-4 sm:px-6 space-y-5">

            {/* Banner: rascunho local não finalizado */}
            {draft.hasDraft && draft.savedAt && (
              <DraftRestoreBanner
                savedAt={draft.savedAt}
                onRestore={handleRestoreDraft}
                onDiscard={draft.discardDraft}
              />
            )}

            {/* Banner: usuário sem permissão para criar cotação */}
            {!isPermissionsLoading && !isEditando && !podeOperarCotacao && (
              <Alert variant="default" className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning-foreground">
                  Seu papel atual não permite criar cotações. Contate o administrador para liberar a permissão de Vendedor ou Gerência.
                </AlertDescription>
              </Alert>
            )}

            {/* BLOCO 0: DADOS DO ASSOCIADO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados do Associado
              </h3>
              
              <div className="space-y-3">
                {/* Nome do Associado */}
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Nome do Associado <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nome completo do associado"
                    value={nomeAssociado}
                    onChange={(e) => setNomeAssociado(e.target.value)}
                    className={cn(
                      nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && "border-destructive"
                    )}
                  />
                  {nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && (
                    <p className="text-xs text-destructive">Nome deve ter pelo menos 3 caracteres</p>
                  )}
                </div>
                
                {/* Telefone/WhatsApp */}
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Telefone/WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <TelefoneInput
                    value={telefoneAssociado}
                    onChange={setTelefoneAssociado}
                    className={cn(
                      telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length < 10 && "border-destructive"
                    )}
                  />
                  {telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length < 10 && (
                    <p className="text-xs text-destructive">Telefone inválido</p>
                  )}
                </div>
                
                {/* E-mail */}
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail (opcional)
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={emailAssociado}
                    onChange={(e) => setEmailAssociado(e.target.value)}
                  />
                </div>

                {/* Indicação */}
                <div className="col-span-2 space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="indicacao-switch"
                      checked={isIndicacao}
                      onCheckedChange={(checked) => {
                        setIsIndicacao(checked);
                        if (!checked) {
                          setIndicadorId(null);
                          setIndicadorNome('');
                          setBuscaIndicador('');
                        }
                      }}
                    />
                    <Label htmlFor="indicacao-switch" className="text-sm cursor-pointer">
                      Este cliente foi indicado por um associado?
                    </Label>
                  </div>

                  {isIndicacao && (
                    <div className="space-y-2">
                      {indicadorId ? (
                        <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                          <UserCheck className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate flex-1">{indicadorNome}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              setIndicadorId(null);
                              setIndicadorNome('');
                              setBuscaIndicador('');
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            placeholder="Buscar por nome, CPF ou telefone..."
                            value={buscaIndicador}
                            onChange={(e) => setBuscaIndicador(e.target.value)}
                            className="pr-8"
                          />
                          {buscandoIndicador && (
                            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {buscaIndicador.length >= 2 && resultadosIndicador.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                              {resultadosIndicador.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                                  onClick={async () => {
                                    try {
                                      if (a.origem_sga) {
                                        toast.info('Importando indicador do SGA...');
                                      }
                                      const localId = await resolverAssociadoLocalId(a);
                                      setIndicadorId(localId);
                                      setIndicadorNome(a.nome);
                                      setBuscaIndicador('');
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : 'Não foi possível selecionar este indicador');
                                    }
                                  }}
                                >
                                  <span className="font-medium">{a.nome}</span>
                                  {a.telefone && (
                                    <span className="text-muted-foreground ml-2 text-xs">{a.telefone}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {buscaIndicador.length >= 2 && !buscandoIndicador && resultadosIndicador.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Nenhum associado encontrado</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* ============================================= */}
            {/* BLOCO 2 — VEÍCULO                             */}
            {/* ============================================= */}

            {/* Busca por placa */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Veículo
              </h3>
              
              {/* Toggle: Veículo 0KM (dentro da Agência) */}
              <div className={`flex items-start gap-3 rounded-lg border p-3 ${isZeroKm ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'}`}>
                <div className="flex-1 space-y-0.5">
                  <Label htmlFor="cot-0km" className="text-sm font-medium cursor-pointer">
                    Veículo 0KM (dentro da Agência)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sem placa definitiva. Use o valor da Nota Fiscal e preencha marca/modelo/ano manualmente.
                  </p>
                </div>
                <Switch
                  id="cot-0km"
                  checked={isZeroKm}
                  onCheckedChange={(checked) => {
                    setIsZeroKm(checked);
                    if (checked) {
                      setPlaca('');
                      setVeiculoEncontrado(null);
                      form.setValue('valor_fipe', 0);
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder={isZeroKm ? 'Sem placa (0KM)' : 'ABC1D23'}
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  maxLength={8}
                  className="uppercase font-mono text-lg tracking-wider flex-1"
                  disabled={isZeroKm}
                />
                <Button
                  type="button"
                  onClick={buscarPorPlaca}
                  disabled={isZeroKm || buscandoPlaca || fipeLoading || placa.replace(/[^A-Z0-9]/g, '').length < 7}
                >
                  {buscandoPlaca ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Veículo encontrado - inline */}
              {veiculoEncontrado?.success && veiculoEncontrado.vehicleData && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="font-medium">
                    {veiculoEncontrado.vehicleData.marca} {veiculoEncontrado.vehicleData.modelo} {veiculoEncontrado.vehicleData.ano}
                  </span>
                  <span className="text-muted-foreground">• {veiculoEncontrado.vehicleData.cor}</span>
                </div>
              )}

              {/* Seletor de versão FIPE — quando a API retorna múltiplas variantes (ex.: manual vs Easytronic) */}
              {veiculoEncontrado?.success && (veiculoEncontrado.fipeAlternativas?.length ?? 0) > 1 && (
                <div className="space-y-1 p-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
                  <Label className="text-xs text-amber-900 dark:text-amber-200">
                    {veiculoEncontrado.fipeAlternativas!.length} versões FIPE encontradas — confira combustível/câmbio/motorização do CRLV
                  </Label>
                  <Select
                    value={String(veiculoEncontrado.fipeData?.codigo || '')}
                    onValueChange={(codigo) => {
                      const escolhida = veiculoEncontrado.fipeAlternativas!.find(f => String(f.codigo) === codigo);
                      if (!escolhida) return;
                      setVeiculoEncontrado({
                        ...veiculoEncontrado,
                        fipeData: {
                          codigo: escolhida.codigo,
                          valor: escolhida.valor,
                          mesReferencia: escolhida.mesReferencia || veiculoEncontrado.fipeData?.mesReferencia || '',
                          descricao: escolhida.descricao,
                        },
                        vehicleData: veiculoEncontrado.vehicleData ? {
                          ...veiculoEncontrado.vehicleData,
                          modelo: escolhida.descricao || veiculoEncontrado.vehicleData.modelo,
                        } : veiculoEncontrado.vehicleData,
                      });
                      form.setValue('valor_fipe', escolhida.valor);
                      toast.success('Versão FIPE atualizada');
                    }}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Selecione a versão correta" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[600px]">
                      {veiculoEncontrado.fipeAlternativas!.map((alt) => (
                        <SelectItem key={String(alt.codigo)} value={String(alt.codigo)}>
                          <div className="flex flex-col text-left">
                            <span className="font-medium">{alt.descricao}</span>
                            <span className="text-xs text-muted-foreground">
                              R$ {Number(alt.valor).toLocaleString('pt-BR')} · cód. {alt.codigo}{alt.ano ? ` · ${alt.ano}` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Divisor e Seleção manual - só aparece se FIPE não retornou dados */}
              {!(veiculoEncontrado?.success && veiculoEncontrado.vehicleData && valorFipe > 0) && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-3 text-xs text-muted-foreground">
                        ou selecione manualmente
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={tipoFipeSelecionado}
                        onValueChange={(value: 'carros' | 'motos') => {
                          setTipoFipeSelecionado(value);
                          setMarcaSelecionada('');
                          setModeloSelecionado('');
                          setAnoSelecionado('');
                          setModelos([]);
                          setAnos([]);
                          form.setValue('valor_fipe', 0);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carros">
                            <span className="flex items-center gap-1.5">
                              <Car className="h-3.5 w-3.5" /> Carro
                            </span>
                          </SelectItem>
                          <SelectItem value="motos">
                            <span className="flex items-center gap-1.5">
                              🏍️ Moto
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Marca</Label>
                       <SearchableSelect
                         options={marcasFiltradas}
                        value={marcaSelecionada}
                        onValueChange={handleMarcaChange}
                        placeholder="Marca"
                        searchPlaceholder="Buscar marca..."
                        loading={loadingMarcas}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Modelo</Label>
                      <SearchableSelect
                        options={modelos.map((m) => ({ value: m.codigo.toString(), label: m.nome }))}
                        value={modeloSelecionado}
                        onValueChange={handleModeloChange}
                        placeholder="Modelo"
                        searchPlaceholder="Buscar modelo..."
                        disabled={!marcaSelecionada}
                        loading={loadingModelos}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Ano</Label>
                      <SearchableSelect
                        options={anos.map((a) => ({ value: a.codigo, label: a.nome }))}
                        value={anoSelecionado}
                        onValueChange={setAnoSelecionado}
                        placeholder="Ano"
                        searchPlaceholder="Buscar ano..."
                        disabled={!modeloSelecionado}
                        loading={loadingAnos}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Combustível */}
            {(veiculoEncontrado || valorFipe > 0) && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-primary" />
                    Combustível
                  </h3>
                  
                  {veiculoEncontrado?.vehicleData?.combustivel ? (
                    <div className="flex items-center gap-2">
                      <Input
                        disabled
                        value={combustiveisBanco.find(c => c.value === combustivelSelecionado)?.label || combustivelSelecionado}
                        className="bg-muted flex-1"
                      />
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">Via FIPE</Badge>
                    </div>
                  ) : (
                    <Select
                      value={combustivelSelecionado}
                      onValueChange={setCombustivelSelecionado}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o combustível" />
                      </SelectTrigger>
                      <SelectContent>
                        {combustiveisBanco.length > 0 ? (
                          combustiveisBanco.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="flex">Flex (Gasolina/Etanol)</SelectItem>
                            <SelectItem value="gasolina">Gasolina</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="eletrico">Elétrico</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* Valor FIPE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Valor FIPE</Label>
                {valorFipe > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {veiculoEncontrado?.fipeData?.valor ? 'Automático' : 'Manual'}
                  </Badge>
                )}
              </div>
              <FormField
                control={form.control}
                name="valor_fipe"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <CurrencyInput 
                          value={field.value} 
                          onChange={field.onChange}
                          disabled={buscandoFipe || !!veiculoEncontrado?.fipeData?.valor}
                        />
                        {buscandoFipe && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        )}
                        {field.value > 0 && !buscandoFipe && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {valorFipe > 0 && faixaAtualFipe && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Faixa enquadrada: {formatCurrency(faixaAtualFipe.min)} – {formatCurrency(faixaAtualFipe.max)}
                </p>
              )}

              {/* ===== Painel Redução de Cota (Regra do 1% / FIPE Menor) =====
                  - Aplicação AUTOMÁTICA quando elegível (sem checkbox, sem justificativa, sem trava).
                  - Quando inelegível, o card SOME por completo (não mostra amber).
                  - Supervisores apenas "tomam ciência" depois em Vendas › Aprovações › Redução de Cota. */}
              {fipeMenorAtivo && fipeMenorInfo && !fipeMenorInfo.bloqueado && fipeMenorInfo.elegivel && (() => {
                const preliminar = !!fipeMenorInfo.preliminar;
                const completo = !preliminar && fipeMenorInfo.faixaAtual && fipeMenorInfo.faixaInferior;
                if (!preliminar && !completo) return null;

                return (
                  <div className="mt-3">
                    <Card className="border-green-500/40 bg-green-500/5">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                              Redução de Cota aplicada (Regra do 1%)
                            </span>
                          </div>
                          <Badge className="bg-green-600 hover:bg-green-600 text-white border-0">
                            Automático
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">FIPE atual:</span>
                            <span className="font-medium">{formatCurrency(valorFipe)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">FIPE − 1%:</span>
                            <span className="font-medium">{formatCurrency(fipeMenorInfo.valorReduzido)}</span>
                          </div>
                          {completo && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Faixa cheia:</span>
                                <span className="font-medium line-through opacity-70">{formatCurrency(fipeMenorInfo.faixaAtual!.mensal)}/mês</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Faixa cobrada:</span>
                                <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(fipeMenorInfo.faixaInferior!.mensal)}/mês</span>
                              </div>
                              <div className="flex justify-between sm:col-span-2 pt-1 border-t border-green-500/20">
                                <span className="text-muted-foreground">Economia mensal:</span>
                                <span className="font-semibold text-green-700 dark:text-green-400">
                                  {formatCurrency(Math.max(0, fipeMenorInfo.economia))}/mês
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-snug">
                          {preliminar
                            ? 'Veículo elegível à redução de cota. Selecione um plano para ver a economia — a redução é aplicada automaticamente ao salvar.'
                            : 'A redução já está sendo aplicada nos valores acima. Supervisão tomará ciência em Vendas › Aprovações › Redução de Cota (sem necessidade de aprovação).'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Alerta FIPE acima do limite de autorização — só exibe se dupla aprovação ativa */}
              {(() => {
                if (!configDuplaAprovacao?.ativa) return null;
                if (!valorFipe || valorFipe <= 0 || !configLimites) return null;
                const limiteAplicavel = tipoVeiculoDetectado === 'moto'
                  ? configLimites.fipeLimiteAutorizacaoMoto
                  : configLimites.fipeLimiteAutorizacao;
                const excedeLimite = valorFipe > limiteAplicavel;
                if (!excedeLimite) return null;
                
                const jaAprovado = cotacaoParaEditar?.id 
                  ? aprovacaoFipeLimiteExistente?.status === 'aprovado'
                  : false;
                const jaRecusado = cotacaoParaEditar?.id 
                  ? aprovacaoFipeLimiteExistente?.status === 'recusado'
                  : false;
                const jaSolicitado = fipeLimiteSolicitado || (aprovacaoFipeLimiteExistente?.status === 'pendente');

                if (jaAprovado) {
                  return (
                    <Alert className="border-green-500/50 bg-green-500/10 mt-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                        Aprovação interna FIPE alto valor <strong>aprovada</strong>. Você pode prosseguir.
                      </AlertDescription>
                    </Alert>
                  );
                }

                if (jaRecusado) {
                  return (
                    <Alert className="border-destructive/50 bg-destructive/10 mt-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm text-destructive">
                        Aprovação interna FIPE alto valor <strong>recusada</strong>. Não é possível prosseguir com este veículo.
                      </AlertDescription>
                    </Alert>
                  );
                }

                if (jaSolicitado) {
                  return (
                    <Alert className="border-amber-500/50 bg-amber-500/10 mt-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                        Solicitação enviada. <strong>Aguarde a aprovação interna</strong> para prosseguir.
                      </AlertDescription>
                    </Alert>
                  );
                }

                return (
                  <div className="mt-2 space-y-2">
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                        FIPE ({formatCurrency(valorFipe)}) acima do limite de {formatCurrency(limiteAplicavel)} para {tipoVeiculoDetectado === 'moto' ? 'motos' : 'carros'}.
                        Você pode criar a cotação normalmente, mas a <strong>aprovação final</strong> dependerá de aprovação interna.
                      </AlertDescription>
                    </Alert>
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* ============================================= */}
            {/* BLOCO 3 — CONDIÇÕES DO VEÍCULO                */}
            {/* ============================================= */}

            {/* Região */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Região
              </h3>
              
              <Select
                value={regiaoSelecionada}
                onValueChange={setRegiaoSelecionada}
              >
                <SelectTrigger>
                  <SelectValue placeholder={regioesLoading ? 'Carregando...' : 'Selecione a região'} />
                </SelectTrigger>
                <SelectContent>
                  {regioesAtivas.map((regiao) => (
                    <SelectItem key={regiao.id} value={regiao.codigo}>
                      {regiao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A região define a tabela de preços aplicada
              </p>
            </div>

            <Separator />

            {/* Uso do Veículo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Uso do Veículo
              </h3>
              
              <Select
                value={usoVeiculo}
                onValueChange={setUsoVeiculo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o uso do veículo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposUsoAtivos.length > 0 ? (
                    tiposUsoAtivos.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="aplicativo">Aplicativo (Uber, 99, etc)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              
              {/* Alerta quando aplicativo é selecionado — cota dinâmica do plano */}
              {(usoVeiculo.toLowerCase().includes('aplicativo') || usoVeiculo.toLowerCase().includes('app')) && (
                <Alert className="border-primary/50 bg-primary/5">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    {planosSelecionados[0] ? (
                      <>
                        Categoria APP{tipoVeiculoDetectado === 'moto' ? ' (moto)' : ''}: cota de participação{' '}
                        <strong>{planosSelecionados[0].cotaPercentual}%</strong>
                        {planosSelecionados[0].cotaMinima > 0 && (
                          <> (mínimo R$ {planosSelecionados[0].cotaMinima.toLocaleString('pt-BR')})</>
                        )}.
                      </>
                    ) : tipoVeiculoDetectado === 'moto' ? (
                      <>Categoria APP (moto): cota de participação <strong>10%</strong> (mínimo R$ 1.500).</>
                    ) : (
                      <>Categoria APP: cota de participação <strong>8%</strong> (mínimo R$ 3.000).</>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Tipo da Cotação (informativo, vai para observação SGA) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Tipo da Cotação
              </h3>
              <Select
                value={tipoCotacao}
                onValueChange={setTipoCotacao}
                disabled={!!origemTroca}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adesao">Cotação nova (adesão)</SelectItem>
                  <SelectItem value="inclusao">Inclusão de veículo</SelectItem>
                  <SelectItem value="substituicao_placa">Substituição de veículo</SelectItem>
                  <SelectItem value="troca_titularidade">Troca de titularidade</SelectItem>
                  <SelectItem value="reativacao">Reativação</SelectItem>
                  <SelectItem value="migracao">Migração</SelectItem>
                  <SelectItem value="outro">Outro (descrever)</SelectItem>
                </SelectContent>
              </Select>
              {tipoCotacao === 'outro' && (
                <Input
                  placeholder="Descreva o tipo da cotação"
                  value={tipoCotacaoOutro}
                  onChange={(e) => setTipoCotacaoOutro(e.target.value)}
                  maxLength={120}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Campo informativo. Será enviado no campo <strong>observação</strong> do veículo no SGA junto ao histórico de avisos.
              </p>
            </div>

            <Separator />

            {/* Tipo de Placa */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Tipo de Placa
              </h3>
              
              <Select
                value={tipoPlacaSelecionado}
                onValueChange={setTipoPlacaSelecionado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de placa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {tiposPlacaAtivos.length > 0 ? (
                    tiposPlacaAtivos.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="mercosul">Mercosul</SelectItem>
                      <SelectItem value="antiga">Antiga</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Alerta dinâmico baseado no tipo de placa selecionado */}
            {alertaCategoria && (
              <Alert 
                className={
                  alertaCategoria.tipo === 'warning' 
                    ? 'border-amber-500/50 bg-amber-500/10' 
                    : 'border-blue-500/50 bg-blue-500/10'
                }
              >
                {alertaCategoria.tipo === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Info className="h-4 w-4 text-blue-500" />
                )}
                <AlertDescription className={
                  alertaCategoria.tipo === 'warning'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-blue-700 dark:text-blue-400'
                }>
                  {alertaCategoria.mensagem}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* ============================================= */}
            {/* BLOCO 4 — PLANO                               */}
            {/* ============================================= */}

            {/* Selecione o Plano */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Selecione o Plano
                </h3>
                {planosSelecionados.length > 0 && (
                  <Badge variant="outline" className="text-primary">
                    {planosSelecionados.length} selecionado{planosSelecionados.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {planosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : valorFipe > 0 && planosCalculados.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {planosCalculados.map((plano) => {
                    const indexSelecionado = planosSelecionados.findIndex(p => p.id === plano.id);
                    const isSelecionado = indexSelecionado >= 0;
                    const ordemSelecao = indexSelecionado + 1;
                    
                    return (
                      <Card 
                        key={plano.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md relative",
                          isSelecionado 
                            ? "ring-2 ring-primary border-primary bg-primary/5" 
                            : "hover:border-primary/50",
                          plano.destaque && !isSelecionado && "border-amber-500/50"
                        )}
                        onClick={() => handleTogglePlano(plano)}
                      >
                        {/* Badge de ordem no canto */}
                        {isSelecionado && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-10">
                            {ordemSelecao}º
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2 gap-1">
                            <h4 className="font-semibold text-sm">{plano.nome}</h4>
                            {isSelecionado ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : plano.destaque ? (
                              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                                Recomendado
                              </Badge>
                            ) : null}
                          </div>
                        <p className="text-xl font-bold text-primary mb-3">
                          {formatCurrency(plano.valorMensal + valorAdicional)}
                          <span className="text-xs font-normal text-muted-foreground">/mês</span>
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {(() => {
                            const coberturasVisiveis = plano.coberturas.filter(
                              c => !(plano.coberturasRemovidas || []).some(
                                cr => cr.toLowerCase().includes(c.toLowerCase())
                              )
                            );
                            return (
                              <>
                                {coberturasVisiveis.slice(0, 4).map((cobertura, idx) => (
                                  <li key={idx} className="flex items-start gap-1">
                                    <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                                    <span>{cobertura}</span>
                                  </li>
                                ))}
                                <div className={`overflow-hidden transition-all duration-200 ${expandedPlanos[plano.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                  {coberturasVisiveis.slice(4).map((cobertura, idx) => (
                                    <li key={idx + 4} className="flex items-start gap-1 mt-1">
                                      <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                                      <span>{cobertura}</span>
                                    </li>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                          {plano.coberturas.length > 4 && (
                            <li className="pt-1">
                              <button
                                type="button"
                                onClick={(e) => toggleExpandPlano(plano.id, e)}
                                className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                              >
                                {expandedPlanos[plano.id] ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Ver menos
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    Ver mais {plano.coberturas.length - 4}
                                  </>
                                )}
                              </button>
                            </li>
                          )}
                        </ul>
                        <Separator className="my-3" />
                        <div className="text-xs flex items-center gap-1">
                          <span className="text-muted-foreground">Filiação: </span>
                          <span className="font-medium text-primary">{formatCurrency(valorAdesao || 0)}</span>
                        </div>
                        {plano.alertaDesagio && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {plano.alertaDesagio}
                          </p>
                        )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  </div>
                </div>
              ) : valorFipe > 0 ? (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Nenhum plano disponível para este valor FIPE
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique se há planos cadastrados para a faixa de R$ {valorFipe.toLocaleString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p className="text-sm">Informe o valor FIPE para ver os planos disponíveis</p>
                </div>
              )}
            </div>

            {/* Valor Adicional */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Valor Adicional</Label>
                <div className="relative group">
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-md z-50">
                    Valor fixo que será acrescido à mensalidade (equipamentos, som, rodas, acessórios, etc.)
                  </div>
                </div>
              </div>
              <FormField
                control={form.control}
                name="valor_adicional"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CurrencyInput 
                        value={field.value || 0} 
                        onChange={field.onChange}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Será somado à mensalidade do plano selecionado
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cenário de Adesão e Instalação */}
            <>
              <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Cenário de Adesão e Instalação *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'cobra_rota' as CenarioExterno, label: 'Cobra Adesão + Rota', desc: 'Cliente paga adesão, instalação em rota' },
                      { value: 'cobra_base' as CenarioExterno, label: 'Cobra Adesão + Base', desc: 'Cliente paga adesão, instalação na base' },
                      { value: 'isenta_rota' as CenarioExterno, label: 'Isenta Adesão + Rota', desc: 'Sem adesão, instalação em rota' },
                      { value: 'isenta_base' as CenarioExterno, label: 'Isenta Adesão + Base', desc: 'Sem adesão, instalação na base' },
                    ]).map((cenario) => (
                      <button
                        key={cenario.value}
                        type="button"
                        onClick={() => {
                          setCenarioExterno(cenario.value);
                          if (cenario.value.startsWith('isenta')) {
                            form.setValue('valor_adesao', 0);
                            adesaoEditadaManualmente.current = true;
                          } else if (cenarioExterno?.startsWith('isenta')) {
                            adesaoEditadaManualmente.current = false;
                            if (valorFipe && valorFipe > 0) {
                              const adesaoCalculada = Math.max(valorFipe * (percentualAdesaoConfig / 100), minimoAdesaoConfig);
                              form.setValue('valor_adesao', Math.round(adesaoCalculada * 100) / 100);
                            }
                          }
                        }}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all text-sm',
                          cenarioExterno === cenario.value
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <span className="font-medium block">{cenario.label}</span>
                        <span className="text-xs text-muted-foreground">{cenario.desc}</span>
                      </button>
                    ))}
                  </div>
                  {!cenarioExterno && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Selecione um cenário para continuar
                    </p>
                  )}
                </div>
            </>

            {/* Taxa de Filiação */}
            {(cenarioExterno && cenarioExterno.startsWith('cobra')) && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-semibold">Taxa de Filiação *</Label>
                  <FormField
                    control={form.control}
                    name="valor_adesao"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CurrencyInput 
                            value={field.value}
                            onChange={(val) => {
                              field.onChange(val);
                              adesaoEditadaManualmente.current = true;
                            }}
                            placeholder="R$ 0,00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor sugerido: {percentualAdesaoConfig}% da FIPE{isCenarioSemMinimo ? '' : ` (mín. ${formatCurrency(minimoAdesaoConfig)})`}. Altere conforme necessário.
                  </p>
                </div>
              </>
            )}

            {/* Blocos informativos dinâmicos */}
            <div className="space-y-2">
              {/* Alerta de adesão abaixo do mínimo */}
              {!isCenarioSemMinimo && form.watch('valor_adesao') > 0 && form.watch('valor_adesao') < minimoAdesaoConfig && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm text-destructive">
                    Valor de adesão ({formatCurrency(form.watch('valor_adesao'))}) abaixo do mínimo configurado ({formatCurrency(minimoAdesaoConfig)}).
                  </AlertDescription>
                </Alert>
              )}

              {/* Repasse volante */}
              {cenarioExterno?.includes('rota') && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Repasse obrigatório:</span> {formatCurrency(repasseVolante)} será descontado (instalação rota).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* ============================================= */}
            {/* BLOCO 5 — DADOS COMERCIAIS                    */}
            {/* ============================================= */}

            {/* Consultor Responsável */}
            {podeAtribuirVendedor && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Consultor Responsável
                </h3>
                
                <FormField
                  control={form.control}
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(value) => field.onChange(value === '_none' ? null : value)} 
                        value={field.value || '_none'}
                        disabled={vendedoresLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            {vendedoresLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue placeholder="Selecione um consultor" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Não atribuído</SelectItem>
                          {vendedores.map((v) => (
                            <SelectItem key={v.id} value={v.user_id}>
                              {v.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {podeAtribuirVendedor && <Separator />}

            {/* Data de Vencimento */}
            <div id="bloco-dia-vencimento" className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Data de Vencimento <span className="text-destructive">*</span>
              </h3>
              
              <p className="text-xs text-muted-foreground">
                Selecione o dia de vencimento das mensalidades
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                {opcoesVencimento.map((dia) => (
                  <div
                    key={dia}
                    onClick={() => setDiaVencimento(dia)}
                    className={cn(
                      "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md text-center",
                      diaVencimento === dia
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <p className={cn(
                      "text-2xl font-bold",
                      diaVencimento === dia && "text-primary"
                    )}>
                      {String(dia).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todo dia {dia}
                    </p>
                    {diaVencimento === dia && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCO 4: RESUMO INLINE (quando planos selecionados) */}
            {planosSelecionados.length > 0 && (
              <>
                <Separator />
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    {/* Info do Associado e Veículo */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Associado</p>
                        <p className="font-medium">{nomeAssociado || 'Não informado'}</p>
                        <p className="text-xs text-muted-foreground mt-2">Veículo</p>
                        <p className="font-medium">
                          {getMarcaNome() && getModeloNome() 
                            ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
                            : 'Valor FIPE informado manualmente'
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">FIPE: {formatCurrency(valorFipe)}</p>
                      </div>
                    </div>

                    {/* Grade de Planos para Comparação */}
                    <div className={cn(
                      "grid gap-3 mb-4 mx-auto max-w-5xl",
                      planosSelecionados.length === 1 && "grid-cols-1 max-w-md",
                      planosSelecionados.length === 2 && "grid-cols-1 md:grid-cols-2 max-w-2xl",
                      planosSelecionados.length === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                      planosSelecionados.length >= 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    )}>
                      {planosSelecionados.map((plano, idx) => {
                        const isExpanded = expandedPlanos[`preview-${plano.id}`];
                        const LIMIT = 5;
                        const hasMore = plano.coberturas.length > LIMIT;
                        
                        return (
                          <Card key={plano.id} className="border-primary/30 bg-background">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="secondary" className="text-xs font-bold">
                                  {idx + 1}º
                                </Badge>
                                <p className="font-semibold truncate">{plano.nome}</p>
                              </div>
                              <p className="text-2xl font-bold text-primary mb-3">
                                {formatCurrency(plano.valorMensal + valorAdicional)}
                                <span className="text-sm font-normal text-muted-foreground">/mês</span>
                              </p>
                              {/* Lista de benefícios com Ver mais */}
                              <ul className="text-sm space-y-1.5 text-muted-foreground">
                                {(() => {
                                  const coberturasVisiveis = plano.coberturas.filter(
                                    c => !(plano.coberturasRemovidas || []).includes(c)
                                  );
                                  return (
                                    <>
                                      {coberturasVisiveis.slice(0, LIMIT).map((cobertura, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                          <span>{cobertura}</span>
                                        </li>
                                      ))}
                                      <div className={`overflow-hidden transition-all duration-200 ${isExpanded && hasMore ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        {coberturasVisiveis.slice(LIMIT).map((cobertura, i) => (
                                          <li key={i + LIMIT} className="flex items-start gap-2 mt-1.5">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{cobertura}</span>
                                          </li>
                                        ))}
                                      </div>
                                    </>
                                  );
                                })()}
                                {hasMore && (
                                  <li className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandPlano(`preview-${plano.id}`)}
                                      className="flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="h-4 w-4" />
                                          Ver menos
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-4 w-4" />
                                          Ver mais {plano.coberturas.length - LIMIT}
                                        </>
                                      )}
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Campos de Filiação e Validade */}
                    <div className="flex flex-wrap items-center gap-4 pt-3 border-t text-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Filiação:</span>
                          <FormField
                            control={form.control}
                            name="valor_adesao"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-1 space-y-0">
                                <FormControl>
                                  <CurrencyInput 
                                    value={field.value}
                                    onChange={(val) => { adesaoEditadaManualmente.current = true; field.onChange(val); }}
                                    className={cn(
                                      "w-28 h-7 text-center font-medium",
                                      field.value <= 0 && !isCenarioIsento && "border-destructive bg-destructive/5"
                                    )}
                                    placeholder="R$ 0,00"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        {valorAdesao <= 0 && !isCenarioIsento && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            A taxa de filiação não pode ser zero
                          </p>
                        )}
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </>
            )}

            </div>

            {/* BLOCO 5: AÇÕES - sticky no rodapé */}
            <div className="sticky bottom-0 bg-background border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 flex items-center justify-end">
              <Button 
                type="submit" 
                disabled={(createCotacao.isPending || updateCotacao.isPending) || planosSelecionados.length === 0 || (valorAdesao <= 0 && !isCenarioIsento) || !dadosAssociadoValidos}
              >
                {(createCotacao.isPending || updateCotacao.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {isEditando ? 'Salvar Alterações' : 'Criar Cotação'}
              </Button>
            </div>
            
          </form>
        </Form>
      </DialogContent>

    </Dialog>

      {/* Dialog de Confirmação de Taxa de Filiação - FORA do Dialog principal */}
      {showConfirmDialog && (
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Taxa de Filiação</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>Você está definindo a taxa de filiação como:</p>
                  <div className="text-3xl font-bold text-center text-primary py-4 bg-primary/5 rounded-lg">
                    {formatCurrency(pendingFormData?.valor_adesao || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Associado: <strong>{nomeAssociado}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Este valor será cobrado do associado. Confirma?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingFormData(null)} disabled={isSubmitting}>
                Revisar Valor
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Criando...
                  </>
                ) : (
                  'Confirmar e Criar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {/* Modal de Placa Duplicada */}
      {showPlacaDuplicadaModal && (
        <PlacaDuplicadaModal
          open={showPlacaDuplicadaModal}
          onOpenChange={setShowPlacaDuplicadaModal}
          placa={placa}
          info={placaDuplicadaInfo}
        />
      )}

      {/* Modal Veículo já cadastrado no SGA */}
      <VeiculoSGAModal
        open={showSGAModal}
        onOpenChange={setShowSGAModal}
        placa={placa}
        onIgnorarEProsseguir={() => {
          setBypassPlacaSGA((s) => new Set(s).add(placaNorm(placa)));
          setShowSGAModal(false);
          setTimeout(() => buscarPorPlaca(), 100);
        }}
      />

      {/* Modal Placa pertence a outro associado (base local) */}
      <PlacaOutroAssociadoModal
        open={showPlacaOutroAssocModal}
        onOpenChange={setShowPlacaOutroAssocModal}
        placa={placa}
        info={placaOutroAssocInfo}
        onIgnorarEProsseguir={() => {
          setBypassPlacaOutroAssoc((s) => new Set(s).add(placaNorm(placa)));
          setShowPlacaOutroAssocModal(false);
          setTimeout(() => buscarPorPlaca(), 100);
        }}
      />
    </>
  );
}
