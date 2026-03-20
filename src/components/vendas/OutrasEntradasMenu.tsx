import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeftRight, Users, FileInput, PlusCircle, Search, Loader2, AlertTriangle, ArrowLeft, Car, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { useBuscaPlaca } from '@/hooks/useBuscaPlaca';
import { useVerificarDebitosAssociado } from '@/hooks/useVerificarDebitosAssociado';
import { useInclusaoBloqueioDebito } from '@/hooks/useInclusaoBloqueioDebito';
import { TrocaTitularidadeDialog } from '@/components/associados/TrocaTitularidadeDialog';
import { MigracaoDiretaDialog } from '@/components/cadastro/MigracaoDiretaDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF } from '@/lib/validations';
import { cn } from '@/lib/utils';

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

  // Migração CPF
  const [migracaoCpf, setMigracaoCpf] = useState('');

  // Dialogs
  const [showTrocaTitularidade, setShowTrocaTitularidade] = useState(false);
  const [showMigracao, setShowMigracao] = useState(false);
  const [migracaoCpfParaDialog, setMigracaoCpfParaDialog] = useState('');

  // Search hooks (only for non-migracao types)
  const { data: associadoResults, isLoading: loadingAssociados } = useAssociadoSearch(
    selectedTipo && selectedTipo !== 'migracao' ? searchTerm : ''
  );
  const { data: placaResults, isLoading: loadingPlacas } = useBuscaPlaca(
    selectedTipo && selectedTipo !== 'migracao' ? searchTerm : ''
  );

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
      setSelectedTipo(null);
      setSearchTerm('');
      setSelectedAssociadoId(null);
      setSelectedAssociadoNome('');
      setMigracaoCpf('');
    }
  }, [open]);

  // Reset search when changing tipo
  useEffect(() => {
    setSearchTerm('');
    setSelectedAssociadoId(null);
    setSelectedAssociadoNome('');
    setMigracaoCpf('');
  }, [selectedTipo]);

  // Merge associado + placa results
  const mergedAssociadoResults = (() => {
    if (selectedTipo === 'migracao') return [];
    const map = new Map<string, AssociadoSearchResult>();
    (associadoResults || []).forEach(a => map.set(a.id, a));
    (placaResults || []).forEach(p => {
      if (!map.has(p.associadoId)) {
        map.set(p.associadoId, {
          id: p.associadoId,
          nome: p.associadoNome,
          cpf: p.associadoCpf,
          telefone: null,
          status: p.associadoStatus,
        });
      }
    });
    return Array.from(map.values());
  })();

  const handleSelectAssociado = (associado: AssociadoSearchResult) => {
    if (selectedTipo === 'substituicao' || selectedTipo === 'inclusao') {
      setSelectedAssociadoId(associado.id);
      setSelectedAssociadoNome(associado.nome);
    } else if (selectedTipo === 'troca_titularidade') {
      setSelectedAssociadoId(associado.id);
      setSelectedAssociadoNome(associado.nome);
      onOpenChange(false);
      setShowTrocaTitularidade(true);
    }
  };

  const handleIniciarMigracao = () => {
    setMigracaoCpfParaDialog(migracaoCpf);
    onOpenChange(false);
    setShowMigracao(true);
  };

  const handleProsseguir = () => {
    if (!selectedAssociadoId) return;
    if (selectedTipo === 'substituicao') {
      onOpenChange(false);
      navigate(`/cadastro/associados/${selectedAssociadoId}/substituicao`);
    } else if (selectedTipo === 'inclusao') {
      onOpenChange(false);
      navigate(`/vendas/cotador?associado_id=${selectedAssociadoId}&tipo_entrada=inclusao`);
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

                      {migracaoStatus === 'debitos' && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Débitos pendentes</AlertTitle>
                          <AlertDescription className="text-xs space-y-2">
                            <p>Este CPF possui débitos pendentes que precisam ser quitados antes de qualquer nova filiação.</p>
                            {migracaoDebitos?.debitosPorVeiculo.map((dv, i) => (
                              <div key={i} className="flex justify-between items-center bg-destructive/10 px-2 py-1.5 rounded">
                                <span>{dv.marca} {dv.modelo} — {dv.placa}</span>
                                <span className="font-semibold">{formatCurrency(dv.total)}</span>
                              </div>
                            ))}
                          </AlertDescription>
                        </Alert>
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
                    {selectedAssociadoId && (selectedTipo === 'substituicao' || selectedTipo === 'inclusao') ? (
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedAssociadoNome}</span>
                        </div>

                        {(loadingDebitos || (selectedTipo === 'inclusao' && loadingAssociadoInclusao)) ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground ml-2">Verificando elegibilidade...</span>
                          </div>
                        ) : bloqueado ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>
                              {selectedTipo === 'inclusao' ? 'Inclusão bloqueada' : 'Substituição bloqueada'}
                            </AlertTitle>
                            <AlertDescription className="space-y-2">
                              <p className="text-xs">
                                {inclusaoStatusCheck === 'debitos'
                                  ? 'O associado possui débitos em aberto. É necessário quitar antes de incluir um novo veículo.'
                                  : inclusaoStatusCheck === 'status_invalido'
                                  ? `O associado está com status "${associadoInclusaoData?.status}". Apenas associados ativos podem incluir novos veículos.`
                                  : inclusaoStatusCheck === 'limite_atingido'
                                  ? `O associado já possui ${associadoInclusaoData?.veiculos.length} veículo(s) ativo(s), atingindo o limite máximo de ${limiteVeiculosConfig} configurado.`
                                  : 'O associado está inadimplente. Aplica-se a Regra do Repasse Maior.'}
                              </p>
                              {temDebitos && debitosData?.debitosPorVeiculo.map((dv, i) => (
                                <div key={i} className="flex justify-between items-center text-xs bg-destructive/10 px-2 py-1.5 rounded">
                                  <span>{dv.marca} {dv.modelo} — {dv.placa}</span>
                                  <span className="font-semibold">{formatCurrency(dv.total)} ({dv.quantidade}x)</span>
                                </div>
                              ))}
                              {selectedTipo === 'substituicao' && repasseConfig?.repasse_maior_percentual && (
                                <p className="text-xs mt-2 font-medium">
                                  Repasse maior: {repasseConfig.repasse_maior_percentual}%
                                  {repasseConfig.repasse_maior_descricao && ` — ${repasseConfig.repasse_maior_descricao}`}
                                </p>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : selectedTipo === 'inclusao' && inclusaoStatusCheck === 'aprovado' ? (
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
                        {isSearching && searchTerm.length >= 2 && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {!isSearching && searchTerm.length >= 2 && mergedAssociadoResults.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">Nenhum associado encontrado</p>
                        )}

                        {searchTerm.length < 2 && (
                          <p className="text-xs text-muted-foreground text-center py-6">
                            Digite pelo menos 2 caracteres para buscar
                          </p>
                        )}

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
            }
          }}
          associadoId={selectedAssociadoId}
          associadoNome={selectedAssociadoNome}
        />
      )}

      {/* Migração Dialog */}
      <MigracaoDiretaDialog
        open={showMigracao}
        onOpenChange={setShowMigracao}
        cpfInicial={migracaoCpfParaDialog}
        consultorIdInicial={profile?.id}
      />
    </>
  );
}

// Keep backward-compatible export
export function OutrasEntradasMenu() {
  return null;
}
