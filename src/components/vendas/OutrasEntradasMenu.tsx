import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeftRight, Users, FileInput, PlusCircle, ChevronRight, Search, Loader2, AlertTriangle, ArrowLeft, Car } from 'lucide-react';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { useBuscaPlaca, type PlacaSearchResult } from '@/hooks/useBuscaPlaca';
import { useVerificarDebitosAssociado } from '@/hooks/useVerificarDebitosAssociado';
import { useInclusaoBloqueioDebito } from '@/hooks/useInclusaoBloqueioDebito';
import { TrocaTitularidadeDialog } from '@/components/associados/TrocaTitularidadeDialog';
import { MigracaoDiretaDialog } from '@/components/cadastro/MigracaoDiretaDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type EntradaTipo = 'substituicao' | 'troca_titularidade' | 'migracao' | 'inclusao';

interface EntradaOption {
  key: EntradaTipo;
  label: string;
  description: string;
  icon: typeof ArrowLeftRight;
  searchTarget: 'associado' | 'lead';
}

const OPCOES: EntradaOption[] = [
  {
    key: 'substituicao',
    label: 'Substituição de Placa',
    description: 'O associado trocou de carro e quer passar a proteção para o novo veículo.',
    icon: ArrowLeftRight,
    searchTarget: 'associado',
  },
  {
    key: 'troca_titularidade',
    label: 'Troca de Titularidade',
    description: 'O veículo foi vendido e o novo dono quer manter a proteção.',
    icon: Users,
    searchTarget: 'associado',
  },
  {
    key: 'migracao',
    label: 'Migração',
    description: 'O cliente está em outra associação e quer vir para a Praticcar sem perder a carência.',
    icon: FileInput,
    searchTarget: 'lead',
  },
  {
    key: 'inclusao',
    label: 'Inclusão de Veículo',
    description: 'O associado já tem um veículo protegido e quer incluir um segundo.',
    icon: PlusCircle,
    searchTarget: 'associado',
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function OutrasEntradasMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<EntradaTipo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssociadoId, setSelectedAssociadoId] = useState<string | null>(null);
  const [selectedAssociadoNome, setSelectedAssociadoNome] = useState('');

  // Dialogs
  const [showTrocaTitularidade, setShowTrocaTitularidade] = useState(false);
  const [showMigracao, setShowMigracao] = useState(false);

  // Search hooks
  const { data: associadoResults, isLoading: loadingAssociados } = useAssociadoSearch(
    selectedTipo && selectedTipo !== 'migracao' ? searchTerm : ''
  );
  const { data: placaResults, isLoading: loadingPlacas } = useBuscaPlaca(
    selectedTipo && selectedTipo !== 'migracao' ? searchTerm : ''
  );

  // Lead search for migration
  const { data: leadResults, isLoading: loadingLeads } = useQuery({
    queryKey: ['lead-search-migracao', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const cleaned = searchTerm.replace(/\D/g, '');
      let query = supabase.from('leads').select('id, nome, telefone, cpf, email').limit(10);
      if (cleaned.length >= 3) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${cleaned}%,telefone.ilike.%${cleaned}%`);
      } else {
        query = query.ilike('nome', `%${searchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: selectedTipo === 'migracao' && searchTerm.length >= 2,
  });

  // Debt check for selected associado
  const { data: debitosData, isLoading: loadingDebitos } = useVerificarDebitosAssociado(selectedAssociadoId || undefined);
  const { data: bloqueioInclusaoAtivo } = useInclusaoBloqueioDebito();

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

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedTipo(null);
      setSearchTerm('');
      setSelectedAssociadoId(null);
      setSelectedAssociadoNome('');
    }
  }, [open]);

  // Reset search when changing tipo
  useEffect(() => {
    setSearchTerm('');
    setSelectedAssociadoId(null);
    setSelectedAssociadoNome('');
  }, [selectedTipo]);

  // Merge associado + placa results (dedup by associadoId)
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
      setOpen(false);
      setShowTrocaTitularidade(true);
    }
  };

  const handleSelectLead = (lead: { id: string; nome: string; cpf: string | null }) => {
    setOpen(false);
    setShowMigracao(true);
  };

  const handleProsseguir = () => {
    if (!selectedAssociadoId) return;
    if (selectedTipo === 'substituicao') {
      setOpen(false);
      navigate(`/cadastro/substituicao-veiculo/${selectedAssociadoId}`);
    } else if (selectedTipo === 'inclusao') {
      setOpen(false);
      navigate(`/vendas/cotacoes?novo=true`);
    }
  };

  // Check if can proceed
  const temDebitos = debitosData?.temDebito === true;
  const bloqueado = selectedAssociadoId && (
    (selectedTipo === 'inclusao' && bloqueioInclusaoAtivo && temDebitos) ||
    (selectedTipo === 'substituicao' && temDebitos)
  );

  const isSearching = loadingAssociados || loadingPlacas || loadingLeads;
  const opcaoAtual = OPCOES.find(o => o.key === selectedTipo);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 shadow-sm">
            <ChevronRight className="h-4 w-4" />
            Outras Entradas
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="end" sideOffset={8}>
          {!selectedTipo ? (
            // Step 1: Choose type
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-3 pt-2 pb-3 font-medium">Selecione o tipo de entrada</p>
              <div className="space-y-1">
                {OPCOES.map((opcao) => (
                  <button
                    key={opcao.key}
                    onClick={() => setSelectedTipo(opcao.key)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left",
                      "hover:bg-accent/50 transition-colors group"
                    )}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                      <opcao.icon className="h-4.5 w-4.5 text-primary" />
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
            // Step 2: Search
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedTipo(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{opcaoAtual?.label}</p>
                </div>
              </div>

              {/* Search input */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={
                      selectedTipo === 'migracao'
                        ? 'Buscar por nome, CPF ou telefone...'
                        : 'Buscar por nome, CPF, telefone ou placa...'
                    }
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

              {/* Results / Debt check */}
              <div className="max-h-[320px] overflow-y-auto">
                {/* If associado selected, show debt check */}
                {selectedAssociadoId && (selectedTipo === 'substituicao' || selectedTipo === 'inclusao') ? (
                  <div className="p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedAssociadoNome}</span>
                    </div>

                    {loadingDebitos ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground ml-2">Verificando débitos...</span>
                      </div>
                    ) : bloqueado ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                          {selectedTipo === 'inclusao' ? 'Inclusão bloqueada' : 'Substituição bloqueada'}
                        </AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p className="text-xs">
                            {selectedTipo === 'inclusao'
                              ? 'O associado possui débitos em aberto. É necessário quitar antes de incluir um novo veículo.'
                              : 'O associado está inadimplente. Aplica-se a Regra do Repasse Maior.'}
                          </p>
                          {debitosData?.debitosPorVeiculo.map((dv, i) => (
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
                  // Search results
                  <div className="p-1">
                    {isSearching && searchTerm.length >= 2 && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {!isSearching && searchTerm.length >= 2 && selectedTipo !== 'migracao' && mergedAssociadoResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum associado encontrado</p>
                    )}

                    {!isSearching && searchTerm.length >= 2 && selectedTipo === 'migracao' && (!leadResults || leadResults.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
                    )}

                    {searchTerm.length < 2 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Digite pelo menos 2 caracteres para buscar
                      </p>
                    )}

                    {/* Associado results */}
                    {selectedTipo !== 'migracao' && mergedAssociadoResults.map((a) => (
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

                    {/* Lead results */}
                    {selectedTipo === 'migracao' && leadResults?.map((l: any) => (
                      <button
                        key={l.id}
                        onClick={() => handleSelectLead(l)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{l.nome}</p>
                          <p className="text-xs text-muted-foreground">{l.cpf || l.email || l.telefone || ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

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
      />
    </>
  );
}
