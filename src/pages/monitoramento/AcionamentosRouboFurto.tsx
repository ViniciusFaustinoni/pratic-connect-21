import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye,
  Search,
  ShieldCheck,
  Inbox,
  Wrench,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useInstalacoesAguardandoAprovacao } from '@/hooks/useAprovacaoMonitoramento';
import { useInstalacoesAguardandoAtivacao } from '@/hooks/useVistoriaCompletaAnalise';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';

type ItemTipo = 'analise' | 'ativacao';

interface ItemUnificado {
  id: string;
  tipo: ItemTipo;
  associado_nome?: string;
  associado_cpf?: string;
  veiculo_placa?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: string | number;
  veiculo_chassi?: string;
  profissional_nome?: string;
  rastreador_imei?: string;
  data_referencia?: string | null;
}

function getWaitColor(date?: string | null) {
  if (!date) return 'border-l-border';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'border-l-destructive';
  if (hours > 24) return 'border-l-warning';
  return 'border-l-success';
}

function getWaitTextColor(date?: string | null) {
  if (!date) return 'text-muted-foreground';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'text-destructive';
  if (hours > 24) return 'text-warning';
  return 'text-success';
}

export default function AprovacaoAssociadosMonitoramento() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: instalacoesAnalise, isLoading: loadingAnalise } = useInstalacoesAguardandoAprovacao();
  const { data: instalacoesAtivacao, isLoading: loadingAtivacao } = useInstalacoesAguardandoAtivacao();

  const isLoading = loadingAnalise || loadingAtivacao;

  const itens: ItemUnificado[] = useMemo(() => {
    const fromAnalise: ItemUnificado[] = (instalacoesAnalise || []).map((s: any) => ({
      id: s.id,
      tipo: 'analise',
      associado_nome: s.associado?.nome,
      associado_cpf: s.associado?.cpf,
      veiculo_placa: s.veiculo?.placa,
      veiculo_marca: s.veiculo?.marca,
      veiculo_modelo: s.veiculo?.modelo,
      veiculo_ano: s.veiculo?.ano_modelo,
      veiculo_chassi: s.veiculo?.chassi,
      profissional_nome: s.profissional?.nome,
      data_referencia: s.concluida_em,
    }));

    const fromAtivacao: ItemUnificado[] = (instalacoesAtivacao || []).map((inst: any) => ({
      id: inst.id,
      tipo: 'ativacao',
      associado_nome: inst.associados?.nome,
      associado_cpf: inst.associados?.cpf,
      veiculo_placa: inst.veiculos?.placa,
      veiculo_marca: inst.veiculos?.marca,
      veiculo_modelo: inst.veiculos?.modelo,
      veiculo_ano: inst.veiculos?.ano_modelo,
      veiculo_chassi: inst.veiculos?.chassi,
      rastreador_imei: inst.rastreadores?.imei,
      data_referencia: inst.concluida_em ?? inst.created_at,
    }));

    return [...fromAtivacao, ...fromAnalise];
  }, [instalacoesAnalise, instalacoesAtivacao]);

  const filtradas = itens.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.associado_nome?.toLowerCase().includes(q) ||
      item.associado_cpf?.includes(search) ||
      item.veiculo_placa?.toLowerCase().includes(q) ||
      item.veiculo_chassi?.toLowerCase().includes(q)
    );
  });

  const handleAbrir = (item: ItemUnificado) => {
    if (item.tipo === 'ativacao') {
      navigate(`/cadastro/instalacoes/${item.id}/ativar`);
    } else {
      navigate(`/monitoramento/aprovacao-associados/${item.id}`);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Aprovação de Associados</h1>
          <p className="text-sm text-muted-foreground">
            Análise de instalações concluídas para ativação da Proteção 360
          </p>
        </div>
      </div>

      {/* Busca — topo */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, CPF ou placa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border h-10 text-sm rounded-xl"
        />
      </div>

      {/* Lista única */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-muted rounded-xl" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground text-base">Nenhuma aprovação pendente</p>
          <p className="text-sm mt-1">Tudo em dia. Bom trabalho! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((item) => {
            const isAtivacao = item.tipo === 'ativacao';
            return (
              <div
                key={`${item.tipo}-${item.id}`}
                className={cn(
                  'group flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4',
                  'hover:bg-accent/30 hover:shadow-sm hover:translate-x-1',
                  isAtivacao ? 'border-l-purple-500' : getWaitColor(item.data_referencia),
                )}
                onClick={() => handleAbrir(item)}
              >
                <UserAvatar name={item.associado_nome} size="sm" className="flex-shrink-0" />

                <div className="flex-shrink-0">
                  <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-md">
                    {item.veiculo_placa || '---'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.associado_nome || '---'}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">
                      {item.veiculo_marca} {item.veiculo_modelo} {item.veiculo_ano || ''}
                    </span>
                    {item.profissional_nome && (
                      <>
                        <span className="text-border">•</span>
                        <div className="flex items-center gap-0.5">
                          <Wrench className="h-3 w-3" />
                          <span className="truncate">{item.profissional_nome}</span>
                        </div>
                      </>
                    )}
                    {item.rastreador_imei && (
                      <>
                        <span className="text-border">•</span>
                        <span className="font-mono text-[10px]">IMEI {item.rastreador_imei.slice(-6)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAtivacao ? (
                    <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[10px] px-1.5">
                      Ativar rastreador
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5">
                      Aguardando
                    </Badge>
                  )}
                  {item.data_referencia && (
                    <span
                      className={cn(
                        'text-[10px] font-semibold tabular-nums',
                        isAtivacao ? 'text-purple-500' : getWaitTextColor(item.data_referencia),
                      )}
                    >
                      {formatDistanceToNow(new Date(item.data_referencia), { locale: ptBR, addSuffix: false })}
                    </span>
                  )}
                </div>

                {isAtivacao ? (
                  <Button
                    size="sm"
                    className="bg-purple-500 hover:bg-purple-600 text-white text-xs flex-shrink-0 h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbrir(item);
                    }}
                  >
                    <Zap className="mr-1 h-3 w-3" />
                    Ativar
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbrir(item);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Analisar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
