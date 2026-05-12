import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeftRight, Users, FileInput, PlusCircle, Search, Loader2, AlertTriangle, ArrowLeft, Car, CheckCircle2, XCircle, Plus, Info } from 'lucide-react';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { useBuscaPlaca } from '@/hooks/useBuscaPlaca';
import { useVerificarDebitosAssociado } from '@/hooks/useVerificarDebitosAssociado';
import { useInclusaoBloqueioDebito } from '@/hooks/useInclusaoBloqueioDebito';
import { TrocaTitularidadeDialog } from '@/components/associados/TrocaTitularidadeDialog';
import { MigracaoDiretaDialog } from '@/components/cadastro/MigracaoDiretaDialog';
import { DebitosCard } from '@/components/cotacao/DebitosCard';
import { SgaTransientAlert } from '@/components/cotacao/SgaTransientAlert';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EntradaTipo = 'substituicao' | 'troca_titularidade' | 'migracao' | 'inclusao';

interface EntradaOption {
  key: EntradaTipo;
  label: string;
  description: string;
  icon: typeof ArrowLeftRight;
}

const OPCOES: EntradaOption[] = [
  {
    key: 'substituicao',
    label: 'Substituição de Placa',
    description: 'O associado trocou de carro e quer passar a proteção para o novo veículo.',
    icon: ArrowLeftRight,
  },
  {
    key: 'troca_titularidade',
    label: 'Troca de Titularidade',
    description: 'O veículo foi vendido e o novo dono quer manter a proteção.',
    icon: Users,
  },
  {
    key: 'migracao',
    label: 'Migração',
    description: 'O cliente está em outra associação e quer vir para a Praticcar sem perder a carência.',
    icon: FileInput,
  },
  {
    key: 'inclusao',
    label: 'Inclusão de Veículo',
    description: 'O associado já tem um veículo protegido e quer incluir um segundo.',
    icon: PlusCircle,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface NovaEntradaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNovaCotacao: () => void;
}

export function NovaEntradaDialog({ open, onOpenChange, onNovaCotacao }: NovaEntradaDialogProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [selectedTipo, setSelectedTipo] = useState<EntradaTipo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssociadoId, setSelectedAssociadoId] = useState<string | null>(null);
  const [selectedAssociadoNome, setSelectedAssociadoNome] = useState('');
  const [selectedAssociadoCpf, setSelectedAssociadoCpf] = useState<string | null>(null);
  const [selectedCodigoHinova, setSelectedCodigoHinova] = useState<number | null>(null);
  const [veiculoAntigoId, setVeiculoAntigoId] = useState<string | null>(null);
  const [veiculoAntigoPlaca, setVeiculoAntigoPlaca] = useState('');
  const [veiculoAntigoModelo, setVeiculoAntigoModelo] = useState('');

  // Migração CPF
  const [migracaoCpf, setMigracaoCpf] = useState('');

  // Dialogs
  const [showTrocaTitularidade, setShowTrocaTitularidade] = useState(false);
  const [showMigracao, setShowMigracao] = useState(false);
  const [showDetalhesSubstituicao, setShowDetalhesSubstituicao] = useState(false);
  const [solicitacaoSubstituicaoId, setSolicitacaoSubstituicaoId] = useState<string | null>(null);
  const [migracaoCpfParaDialog, setMigracaoCpfParaDialog] = useState('');

  // Search hooks (only for non-migracao types)
  // Substituição usa busca por placa primária; outros tipos buscam por associado
  const isSubstituicao = selectedTipo === 'substituicao';
  // Detecta formato de placa (Mercosul AAA0A00 ou antiga AAA0000) para
  // não disparar busca textual local com os dígitos da placa (gera ruído).
  const PLACA_REGEX_INPUT = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  const termoUpperLimpo = (searchTerm || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const termoEhPlaca = PLACA_REGEX_INPUT.test(termoUpperLimpo);
  const { data: associadoResults, isLoading: loadingAssociados } = useAssociadoSearch(
    selectedTipo && selectedTipo !== 'migracao' && !isSubstituicao && !termoEhPlaca ? searchTerm : ''
  );
  const buscaPlaca = useBuscaPlaca(
    selectedTipo && selectedTipo !== 'migracao' ? searchTerm : ''
  );
  const { data: placaResults, isLoading: loadingPlacas, refetch: refetchPlaca } = buscaPlaca;
  const placaErroTransitorio = buscaPlaca.erroTransitorio;
  const placaMotivoTransitorio = buscaPlaca.motivoTransitorio;

  // Debt check for selected associado (substituicao/inclusao)
  const { data: debitosData, isLoading: loadingDebitos } = useVerificarDebitosAssociado(selectedAssociadoId || undefined);
  const { data: bloqueioInclusaoAtivo } = useInclusaoBloqueioDebito();

  // Vehicle limit config
  const { data: limiteVeiculosConfig } = useQuery({
    queryKey: ['config-limite-veiculos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'limite_veiculos_associado')
        .maybeSingle();
      const val = parseInt(data?.valor || '0');
      return isNaN(val) || val <= 0 ? 0 : val; // 0 = sem limite
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch associado details for inclusão (status + veículos ativos)
  const { data: associadoInclusaoData, isLoading: loadingAssociadoInclusao } = useQuery({
    queryKey: ['associado-inclusao-check', selectedAssociadoId],
    queryFn: async () => {
      if (!selectedAssociadoId) return null;
      // Get associado status + details
      const { data: assoc } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, email, status')
        .eq('id', selectedAssociadoId)
        .single();
      if (!assoc) return null;
      // Get active vehicles
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_fabricacao, status')
        .eq('associado_id', selectedAssociadoId)
        .in('status', ['ativo', 'instalacao_pendente']);
      return { ...assoc, veiculos: veiculos || [] };
    },
    enabled: !!selectedAssociadoId && selectedTipo === 'inclusao',
  });

  // Repasse maior config for substituicao
  const { data: repasseConfig } = useQuery({
    queryKey: ['config-repasse-maior'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['repasse_maior_percentual', 'repasse_maior_descricao']);
      const map: Record<string, string> = {};
      data?.forEach(d => { map[d.chave] = d.valor || ''; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ===== Migração: CPF verification =====
  const migracaoCpfLimpo = migracaoCpf.replace(/\D/g, '');
  const migracaoCpfCompleto = migracaoCpfLimpo.length === 11;

  const { data: migracaoAssociado, isLoading: loadingMigracaoCheck } = useQuery({
    queryKey: ['migracao-cpf-check', migracaoCpfLimpo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, status')
        .eq('cpf', maskCPF(migracaoCpfLimpo))
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: migracaoCpfCompleto,
  });

  const migracaoAssociadoId = migracaoAssociado?.id;
  const { data: migracaoDebitos, isLoading: loadingMigracaoDebitos } = useVerificarDebitosAssociado(
    migracaoAssociadoId || undefined
  );

  const migracaoLoading = loadingMigracaoCheck || (!!migracaoAssociadoId && loadingMigracaoDebitos);

  const migracaoStatus = (() => {
    if (!migracaoCpfCompleto) return null;
    if (migracaoLoading) return 'loading';
    if (migracaoAssociado && migracaoAssociado.status === 'ativo') return 'ativo';
    if (migracaoAssociado && migracaoDebitos?.temDebito) return 'debitos';
    return 'elegivel';
  })();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setMigracaoCpf('');

      if (!showTrocaTitularidade && !showMigracao) {
        setSelectedTipo(null);
        setSelectedAssociadoId(null);
        setSelectedAssociadoNome('');
      }
    }
  }, [open, showTrocaTitularidade, showMigracao]);

  // Reset search when changing tipo
  useEffect(() => {
    setSearchTerm('');
    setSelectedAssociadoId(null);
    setSelectedAssociadoNome('');
    setSelectedAssociadoCpf(null);
    setVeiculoAntigoId(null);
    setVeiculoAntigoPlaca('');
    setVeiculoAntigoModelo('');
    setMigracaoCpf('');
  }, [selectedTipo]);

  // Merge associado + placa results
  const mergedAssociadoResults = (() => {
    if (selectedTipo === 'migracao') return [];
    if (isSubstituicao) return []; // Substituição usa lista de placas diretamente
    const map = new Map<string, AssociadoSearchResult>();
    // Prioriza resultado por placa (SGA) no topo
    (placaResults || []).forEach(p => {
      map.set(p.associadoId, {
        id: p.associadoId,
        nome: p.associadoNome,
        cpf: p.associadoCpf,
        telefone: null,
        status: p.associadoStatus,
      });
    });
    (associadoResults || []).forEach(a => {
      if (!map.has(a.id)) map.set(a.id, a);
    });
    return Array.from(map.values());
  })();

  // Handler para selecionar placa (substituição)
  const handleSelectPlaca = (result: import('@/hooks/useBuscaPlaca').PlacaSearchResult) => {
    setSelectedAssociadoId(result.associadoId);
    setSelectedAssociadoNome(result.associadoNome);
    setSelectedAssociadoCpf(result.associadoCpf);
    setVeiculoAntigoId(result.veiculoId);
    setVeiculoAntigoPlaca(result.placa);
    setVeiculoAntigoModelo(`${result.marca} ${result.modelo}`);
  };

  const handleSelectAssociado = async (associado: AssociadoSearchResult) => {
    if (selectedTipo === 'substituicao' || selectedTipo === 'inclusao') {
      setSelectedAssociadoId(associado.id);
      setSelectedAssociadoNome(associado.nome);
      setSelectedAssociadoCpf(associado.cpf);
    } else if (selectedTipo === 'troca_titularidade') {
      const cpfLimpo = (associado.cpf || '').replace(/\D/g, '');
      let finalId = associado.id;
      let finalNome = associado.nome;
      let finalCpf: string | null = associado.cpf;
      // Resultado vindo do SGA não tem UUID local — precisa importar primeiro
      if (associado.origem_sga) {
        if (cpfLimpo.length !== 11) {
          toast.error('CPF inválido retornado pelo SGA');
          return;
        }
        try {
          toast.info('Importando associado do SGA...');
          const { data, error } = await supabase.functions.invoke('importar-associado-sga', {
            body: { cpf: cpfLimpo },
          });
          // Em respostas não-2xx o SDK popula `error` (FunctionsHttpError) e `data` fica null.
          // Precisamos ler o corpo da Response para obter a mensagem amigável.
          if (error) {
            let msgAmigavel: string | undefined;
            try {
              const anyErr = error as any;
              if (anyErr?.context && typeof anyErr.context.json === 'function') {
                const body = await anyErr.context.json();
                msgAmigavel = body?.error;
              }
            } catch { /* ignore */ }
            throw new Error(msgAmigavel || error.message);
          }
          const msgAmigavel = (data as any)?.error;
          if (msgAmigavel) throw new Error(msgAmigavel);
          const associadoLocalId = (data as any)?.associado_id;
          if (!associadoLocalId) {
            toast.error('Falha ao localizar associado após import do SGA');
            return;
          }
          finalId = associadoLocalId;
          finalCpf = cpfLimpo;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Erro ao importar associado do SGA');
          return;
        }
      }
      // Abrir o dialog de Troca ANTES de fechar o pai, para evitar que o
      // useEffect de reset (disparado por open=false) zere selectedAssociadoId
      // no caso async (sem batching automático do React).
      setSelectedAssociadoId(finalId);
      setSelectedAssociadoNome(finalNome);
      setSelectedAssociadoCpf(finalCpf);
      setSelectedCodigoHinova(
        (associado.codigo_hinova ?? associado.codigo_associado ?? null) as number | null,
      );
      setShowTrocaTitularidade(true);
      // Fecha o pai no próximo tick para garantir que showTrocaTitularidade
      // esteja `true` quando o effect de reset rodar.
      setTimeout(() => onOpenChange(false), 0);
    }
  };

  const handleIniciarMigracao = () => {
    setMigracaoCpfParaDialog(migracaoCpf);
    onOpenChange(false);
    setShowMigracao(true);
  };

  const handleProsseguir = async () => {
    if (!selectedAssociadoId) return;
    if (selectedTipo === 'substituicao') {
      // Cria a Solicitação de Substituição (com snapshot SGA + termo de cancelamento pendente)
      try {
        const placa = (veiculoAntigoPlaca || '').toUpperCase();
        if (!placa) { toast.error('Placa não selecionada'); return; }
        toast.info('Criando solicitação de substituição...');
        const { data, error } = await supabase.functions.invoke('criar-solicitacao-substituicao', {
          body: { placa },
        });
        if (error) {
          let msg: string | undefined;
          try {
            const anyErr = error as any;
            if (anyErr?.context && typeof anyErr.context.json === 'function') {
              const body = await anyErr.context.json();
              msg = body?.error;
            }
          } catch { /* ignore */ }
          throw new Error(msg || error.message);
        }
        if ((data as any)?.error) throw new Error((data as any).error);
        const solId = (data as any)?.id as string;
        if (!solId) throw new Error('Solicitação não retornou id');
        onOpenChange(false);
        setSolicitacaoSubstituicaoId(solId);
        setShowDetalhesSubstituicao(true);
      } catch (e: any) {
        toast.error(e?.message || 'Falha ao criar solicitação');
      }
    } else if (selectedTipo === 'inclusao') {
      onOpenChange(false);
      navigate(`/vendas/cotacoes?associado_id=${selectedAssociadoId}&tipo_entrada=inclusao`);
    }
  };

  const handleNovaCotacao = () => {
    onOpenChange(false);
    onNovaCotacao();
  };

  const temDebitos = debitosData?.temDebito === true;
  
  // Inclusão: compute full eligibility
  const inclusaoStatusCheck = (() => {
    if (selectedTipo !== 'inclusao' || !selectedAssociadoId) return null;
    // 1. Débitos
    if (bloqueioInclusaoAtivo && temDebitos) return 'debitos' as const;
    // 2. Status do associado
    if (associadoInclusaoData && associadoInclusaoData.status !== 'ativo') return 'status_invalido' as const;
    // 3. Limite de veículos
    const limite = limiteVeiculosConfig || 0;
    if (limite > 0 && associadoInclusaoData && associadoInclusaoData.veiculos.length >= limite) return 'limite_atingido' as const;
    // All checks passed
    if (associadoInclusaoData && !loadingDebitos && !loadingAssociadoInclusao) return 'aprovado' as const;
    return null;
  })();

  const bloqueado = selectedAssociadoId && (
    (selectedTipo === 'inclusao' && (inclusaoStatusCheck === 'debitos' || inclusaoStatusCheck === 'status_invalido' || inclusaoStatusCheck === 'limite_atingido')) ||
    (selectedTipo === 'substituicao' && temDebitos)
  );

  const isSearching = loadingAssociados || loadingPlacas;
  const opcaoAtual = OPCOES.find(o => o.key === selectedTipo);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0">
          {!selectedTipo ? (
            // Step 1: Choose type
            <div className="p-5">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-lg">O que você deseja fazer?</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {/* Nova Cotação — highlighted */}
                <button
                  onClick={handleNovaCotacao}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-4 rounded-xl text-left",
                    "border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group"
                  )}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/25 transition-colors">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Nova Cotação</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Cliente novo ou lead que quer se associar.</p>
                  </div>
                </button>

                {/* Separator */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Outras entradas</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Other options */}
                {OPCOES.map((opcao) => (
                  <button
                    key={opcao.key}
                    onClick={() => setSelectedTipo(opcao.key)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left",
                      "hover:bg-accent/50 transition-colors group border border-transparent hover:border-border/50"
                    )}
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-accent transition-colors">
                      <opcao.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{opcao.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opcao.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Step 2: Search or CPF input
            <div className="flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 pr-10 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedTipo(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{opcaoAtual?.label}</p>
                  <p className="text-xs text-muted-foreground">{opcaoAtual?.description}</p>
                </div>
              </div>

              {selectedTipo === 'migracao' ? (
                // === Migração: CPF input + verification ===
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">CPF do cliente</p>
                    <p className="text-xs text-muted-foreground">
                      Digite o CPF do cliente para verificar se ele pode ser migrado.
                    </p>
                    <Input
                      placeholder="000.000.000-00"
                      value={migracaoCpf}
                      onChange={(e) => setMigracaoCpf(maskCPF(e.target.value))}
                      maxLength={14}
                      autoFocus
                    />
                  </div>

                  {migracaoCpfCompleto && (
                    <div className="space-y-3">
                      {migracaoStatus === 'loading' && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground ml-2">Verificando CPF...</span>
                        </div>
                      )}

                      {migracaoStatus === 'ativo' && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Associado ativo</AlertTitle>
                          <AlertDescription className="text-xs">
                            Este CPF já possui vínculo ativo na Praticcar ({migracaoAssociado?.nome}). Não é possível iniciar uma migração.
                          </AlertDescription>
                        </Alert>
                      )}

                      {migracaoStatus === 'debitos' && migracaoDebitos && (
                        <DebitosCard
                          debitos={migracaoDebitos.debitosPorVeiculo}
                          saldoTotal={migracaoDebitos.saldoTotal}
                          bloqueante
                          cpf={migracaoAssociadoId}
                          titulo="Débitos pendentes"
                          descricao="Este CPF possui débitos que precisam ser quitados antes de qualquer nova filiação. Após pagar, clique em 'Verificar pagamento' para liberar imediatamente, sem esperar a rotina noturna."
                        />
                      )}

                      {migracaoStatus === 'elegivel' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                              Cliente elegível para migração
                            </span>
                          </div>
                          <Button className="w-full" onClick={handleIniciarMigracao}>
                            Iniciar Migração
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : isSubstituicao ? (
                // === Substituição: busca por PLACA ===
                <>
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar pela placa do veículo atual..."
                        className="pl-9 h-9 uppercase"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value.toUpperCase());
                          setSelectedAssociadoId(null);
                          setVeiculoAntigoId(null);
                        }}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {selectedAssociadoId ? (
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{selectedAssociadoNome}</span>
                            <p className="text-xs text-muted-foreground">
                              Veículo atual: <span className="font-mono">{veiculoAntigoPlaca}</span> — {veiculoAntigoModelo}
                            </p>
                          </div>
                        </div>

                        {loadingDebitos ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground ml-2">Verificando elegibilidade...</span>
                          </div>
                        ) : bloqueado ? (
                          temDebitos && debitosData ? (
                            <DebitosCard
                              debitos={debitosData.debitosPorVeiculo}
                              saldoTotal={debitosData.saldoTotal}
                              bloqueante
                              cpf={selectedAssociadoId || undefined}
                              titulo="Substituição bloqueada — associado inadimplente"
                              descricao={
                                repasseConfig?.repasse_maior_percentual
                                  ? `Repasse maior: ${repasseConfig.repasse_maior_percentual}%${repasseConfig.repasse_maior_descricao ? ` — ${repasseConfig.repasse_maior_descricao}` : ''}. Após pagar, clique em 'Verificar pagamento' para liberar imediatamente.`
                                  : "Após pagar, clique em 'Verificar pagamento' para liberar imediatamente, sem esperar a rotina noturna."
                              }
                            />
                          ) : (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Substituição bloqueada</AlertTitle>
                              <AlertDescription className="text-xs">O associado está inadimplente.</AlertDescription>
                            </Alert>
                          )
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50 border border-border">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm font-medium">Associado elegível para substituição</span>
                            </div>
                            <Button className="w-full" onClick={handleProsseguir}>
                              Prosseguir — Cotar novo veículo
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-1">
                        {loadingPlacas && searchTerm.length >= 3 && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {!loadingPlacas && searchTerm.length >= 3 && (!placaResults || placaResults.length === 0) && (
                          placaErroTransitorio ? (
                            <div className="px-3 py-3">
                              <SgaTransientAlert
                                motivo={placaMotivoTransitorio}
                                onRetry={() => refetchPlaca()}
                                loading={loadingPlacas}
                                descricao="Não foi possível confirmar agora se esta placa está cadastrada no SGA. Tente novamente em instantes."
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum veículo ativo encontrado com esta placa</p>
                          )
                        )}

                        {searchTerm.length < 3 && (
                          <p className="text-xs text-muted-foreground text-center py-6">
                            Digite pelo menos 3 caracteres da placa
                          </p>
                        )}

                        {(placaResults || []).map((p) => (
                          <button
                            key={p.veiculoId}
                            onClick={() => handleSelectPlaca(p)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium font-mono">{p.placa}</p>
                              <p className="text-xs text-muted-foreground">{p.marca} {p.modelo} · {p.associadoNome}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                              {p.associadoStatus}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // === Other types: associado search ===
                <>
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, CPF, telefone ou placa..."
                        className="pl-9 h-9"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setSelectedAssociadoId(null);
                        }}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {selectedAssociadoId && selectedTipo === 'inclusao' ? (
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedAssociadoNome}</span>
                        </div>

                        {(loadingDebitos || loadingAssociadoInclusao) ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground ml-2">Verificando elegibilidade...</span>
                          </div>
                        ) : bloqueado ? (
                          temDebitos && debitosData ? (
                            <DebitosCard
                              debitos={debitosData.debitosPorVeiculo}
                              saldoTotal={debitosData.saldoTotal}
                              bloqueante
                              cpf={selectedAssociadoId || undefined}
                              titulo="Inclusão bloqueada — associado inadimplente"
                              descricao="O associado possui débitos em aberto. Após pagar, clique em 'Verificar pagamento' para liberar a inclusão imediatamente, sem esperar a rotina noturna."
                            />
                          ) : (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Inclusão bloqueada</AlertTitle>
                              <AlertDescription>
                                <p className="text-xs">
                                  {inclusaoStatusCheck === 'status_invalido'
                                    ? `O associado está com status "${associadoInclusaoData?.status}". Apenas associados ativos podem incluir novos veículos.`
                                    : inclusaoStatusCheck === 'limite_atingido'
                                    ? `O associado já possui ${associadoInclusaoData?.veiculos.length} veículo(s) ativo(s), atingindo o limite máximo de ${limiteVeiculosConfig} configurado.`
                                    : 'O associado está inadimplente.'}
                                </p>
                              </AlertDescription>
                            </Alert>
                          )
                        ) : inclusaoStatusCheck === 'aprovado' ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50 border border-border">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm font-medium">Associado elegível para inclusão</span>
                            </div>
                            {associadoInclusaoData && associadoInclusaoData.veiculos.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Veículos ativos:</p>
                                {associadoInclusaoData.veiculos.map((v) => (
                                  <div key={v.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/50">
                                    <span>{v.marca} {v.modelo} {v.ano_fabricacao}</span>
                                    <span className="font-mono">{v.placa}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button className="w-full" onClick={handleProsseguir}>
                              Confirmar e iniciar inclusão
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Nenhum débito em aberto encontrado.</p>
                            <Button className="w-full" onClick={handleProsseguir}>
                              Prosseguir com {opcaoAtual?.label}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-1">
                        {(() => {
                          const cleaned = searchTerm.replace(/\D/g, '');
                          const alnum = searchTerm.replace(/[^A-Za-z0-9]/g, '');
                          const isCpfCompleto = cleaned.length === 11;
                          const isPlacaCompleta = alnum.length >= 7 && /[A-Za-z]/.test(alnum);
                          const consultandoSGA = isSearching && (isCpfCompleto || isPlacaCompleta);
                          return (
                            <>
                              {isSearching && searchTerm.length >= 2 && (
                                <div className="flex items-center justify-center gap-2 py-6">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  {consultandoSGA && (
                                    <span className="text-xs text-muted-foreground">Consultando SGA…</span>
                                  )}
                                </div>
                              )}

                              {!isSearching && searchTerm.length >= 2 && mergedAssociadoResults.length === 0 && (
                                placaErroTransitorio && (isCpfCompleto || isPlacaCompleta) ? (
                                  <div className="px-3 py-4">
                                    <SgaTransientAlert
                                      motivo={placaMotivoTransitorio}
                                      onRetry={() => refetchPlaca()}
                                      loading={loadingPlacas}
                                      descricao="A consulta ao SGA falhou agora. Não significa que o cadastro não exista — tente novamente em instantes."
                                    />
                                  </div>
                                ) : (
                                  <div className="px-3 py-5 space-y-3">
                                    <p className="text-sm text-muted-foreground text-center">
                                      Nenhum associado encontrado.
                                    </p>
                                    <Alert>
                                      <Info className="h-4 w-4" />
                                      <AlertTitle className="text-xs">Use CPF ou placa para buscar no SGA</AlertTitle>
                                      <AlertDescription className="text-xs leading-relaxed space-y-1">
                                        <p>
                                          A integração do SGA (Hinova) <strong>não permite busca por nome</strong> — só por <strong>CPF exato</strong> (11 dígitos) ou <strong>placa</strong> (7 caracteres).
                                        </p>
                                        <p>
                                          A busca por nome consulta <strong>apenas a base local</strong>. Se o associado ainda não tiver sido importado, ele não aparece aqui — digite o CPF completo ou a placa para localizá-lo no SGA em tempo real.
                                        </p>
                                      </AlertDescription>
                                    </Alert>
                                  </div>
                                )
                              )}

                              {searchTerm.length < 2 && (
                                <p className="text-xs text-muted-foreground text-center py-6">
                                  Digite pelo menos 2 caracteres (nome, CPF ou placa)
                                </p>
                              )}
                            </>
                          );
                        })()}

                        {mergedAssociadoResults.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => handleSelectAssociado(a)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{a.nome}</p>
                              <p className="text-xs text-muted-foreground">{a.cpf}{a.telefone ? ` · ${a.telefone}` : ''}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                              {a.status}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Troca Titularidade Dialog */}
      {selectedAssociadoId && (
        <TrocaTitularidadeDialog
          open={showTrocaTitularidade}
          onOpenChange={(v) => {
            setShowTrocaTitularidade(v);
            if (!v) {
              setSelectedAssociadoId(null);
              setSelectedAssociadoNome('');
              setSelectedAssociadoCpf(null);
              setSelectedCodigoHinova(null);
            }
          }}
          associadoId={selectedAssociadoId}
          associadoNome={selectedAssociadoNome}
          associadoCpf={selectedAssociadoCpf}
          codigoHinova={selectedCodigoHinova}
        />
      )}

      {/* Migração Dialog */}
      <MigracaoDiretaDialog
        open={showMigracao}
        onOpenChange={setShowMigracao}
        cpfInicial={migracaoCpfParaDialog}
        consultorIdInicial={profile?.id}
      />

      {/* Substituição de Placa — detalhes da solicitação */}
      <ModalDetalhesSubstituicao
        solicitacaoId={solicitacaoSubstituicaoId}
        open={showDetalhesSubstituicao}
        onOpenChange={(v) => {
          setShowDetalhesSubstituicao(v);
          if (!v) setSolicitacaoSubstituicaoId(null);
        }}
      />
    </>
  );
}

// Keep backward-compatible export
export function OutrasEntradasMenu() {
  return null;
}
