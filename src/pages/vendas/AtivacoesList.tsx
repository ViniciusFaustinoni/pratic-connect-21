import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Rocket, RefreshCw, Clock, 
  AlertTriangle, CheckCircle2, Timer, Search,
  ChevronRight, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtivacoes, useAtivarContrato, useAtivacaoMetricas, useExcluirAtivacao, FiltroAtivacao } from "@/hooks/useAtivacoes";
import { AtivacaoCardNew } from "@/components/ativacao/AtivacaoCardNew";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function AtivacoesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filtro, setFiltro] = useState<FiltroAtivacao>("todos");
  
  const { isDiretor, isAdminMaster, isVendedor } = usePermissions();
  const canDeleteAtivacoes = isDiretor || isAdminMaster;
  
  const { data: ativacoes, isLoading, error, refetch } = useAtivacoes(filtro);
  const { mutate: ativarContrato, isPending: isAtivando } = useAtivarContrato();
  const { mutate: excluirAtivacao, isPending: isExcluindo } = useExcluirAtivacao();
  const metrics = useAtivacaoMetricas();

  // Filtrar por busca
  const filteredItems = ativacoes?.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.lead?.nome?.toLowerCase().includes(query) ||
      item.numero?.toLowerCase().includes(query) ||
      item.lead?.veiculo_placa?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAtivar = (contratoId: string) => {
    ativarContrato(contratoId);
  };

  const handleClickRequisito = (contratoId: string, tipo: 'proposta' | 'vistoria') => {
    if (tipo === 'proposta') {
      toast.info('Redirecione o cliente para assinar a proposta');
      // navigate(`/vendas/contratos/${contratoId}`);
    } else {
      toast.info('Agende uma instalação para este cliente');
      // navigate(`/monitoramento/instalacoes`);
    }
  };

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ativações</h1>
            <p className="text-muted-foreground">Erro ao carregar dados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <span>Erro ao carregar dados. Tente novamente mais tarde.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 space-y-4">
        {/* Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Rocket className="h-7 w-7 text-white" />
            </div>
            
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <span>CRM</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Ativações</span>
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight">Ativações de Contratos</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as ativações pendentes e concluídas
              </p>
            </div>
          </div>

          {!isVendedor && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          )}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.totalPendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.prontosParaAtivar}</p>
                  <p className="text-xs text-muted-foreground">Prontos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.ativadosHoje}</p>
                  <p className="text-xs text-muted-foreground">Ativados Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : `${metrics.tempoMedio}d`}</p>
                  <p className="text-xs text-muted-foreground">Tempo Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar por nome, número, placa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="h-6 w-px bg-border/50 hidden sm:block" />

          {/* Status Filter */}
          <ToggleGroup 
            type="single" 
            value={filtro}
            onValueChange={(v) => v && setFiltro(v as FiltroAtivacao)}
            className="bg-muted/50 rounded-lg p-0.5"
          >
            <ToggleGroupItem value="todos" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem value="pendentes" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <Clock className="h-3 w-3 mr-1 text-amber-500" />
              Pendentes
            </ToggleGroupItem>
            <ToggleGroupItem value="prontos" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <Zap className="h-3 w-3 mr-1 text-emerald-500" />
              Prontos
            </ToggleGroupItem>
            <ToggleGroupItem value="ativados" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <CheckCircle2 className="h-3 w-3 mr-1 text-blue-500" />
              Ativados
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 pt-0">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[320px] rounded-xl" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhuma ativação encontrada</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery 
                ? 'Tente ajustar os termos da busca'
                : filtro === 'prontos'
                  ? 'Não há contratos prontos para ativar no momento'
                  : filtro === 'ativados'
                    ? 'Nenhum contrato foi ativado ainda'
                    : 'Não há ativações pendentes no momento'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((contrato) => (
              <AtivacaoCardNew
                key={contrato.id}
                contrato={contrato}
                onAtivar={() => handleAtivar(contrato.id)}
                onClickRequisito={(tipo) => handleClickRequisito(contrato.id, tipo)}
                onExcluir={() => excluirAtivacao(contrato.id)}
                canDelete={canDeleteAtivacoes}
                isAtivando={isAtivando}
                isExcluindo={isExcluindo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
