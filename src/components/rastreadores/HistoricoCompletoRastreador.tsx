import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Package,
  Wrench,
  Settings,
  ArrowRightLeft,
  Loader2,
  History,
  CheckCircle2,
  XCircle,
  UserPlus,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FotosManutencaoGaleria } from './FotosManutencaoGaleria';
import { cn } from '@/lib/utils';

// ===== TIPOS =====

interface Movimentacao {
  id: string;
  tipo: string;
  status_anterior: string | null;
  status_novo: string | null;
  observacoes: string | null;
  created_at: string;
  usuario: { id: string; nome: string } | null;
  veiculo: { placa: string } | null;
}

interface FotoManutencao {
  url: string;
  categoria?: string;
  uploaded_at?: string;
}

interface ChecklistItem {
  item: string;
  status: 'ok' | 'nao_ok';
  verificado_em?: string;
}

interface ManutencaoCampo {
  id: string;
  protocolo: string;
  status: string;
  resultado_manutencao: string | null;
  motivo_manutencao: string | null;
  motivo_detalhe: string | null;
  observacoes_analise: string | null;
  concluida_em: string | null;
  created_at: string;
  fotos_manutencao: FotoManutencao[] | null;
  checklist_manutencao: ChecklistItem[] | null;
  profissional: { id: string; nome: string } | null;
}

interface ManutencaoInterna {
  id: string;
  etapa: string;
  diagnostico_inicial: string | null;
  defeito_identificado: string | null;
  acao_tomada: string | null;
  encaminhado_para: string | null;
  numero_protocolo_externo: string | null;
  laudo_externo: string | null;
  created_at: string;
  resolvido_em: string | null;
  servico_origem: { protocolo: string } | null;
  resolvido_por_profile: { nome: string } | null;
}

type EventoHistorico =
  | { tipo: 'movimentacao'; data: Movimentacao; created_at: string }
  | { tipo: 'manutencao_campo'; data: ManutencaoCampo; created_at: string }
  | { tipo: 'manutencao_interna'; data: ManutencaoInterna; created_at: string };

// ===== CONSTANTES =====

const TIPO_MOVIMENTACAO_ICONS: Record<string, React.ElementType> = {
  entrada: Package,
  atribuicao_portador: UserPlus,
  remocao_portador: UserPlus,
  instalacao: CheckCircle2,
  manutencao: Wrench,
  baixa: XCircle,
  transferencia: ArrowRightLeft,
  retorno_manutencao: ArrowRightLeft,
  correcao_manual: AlertCircle,
};

const TIPO_MOVIMENTACAO_LABELS: Record<string, string> = {
  entrada: 'Entrada no Estoque',
  atribuicao_portador: 'Atribuído a Portador',
  remocao_portador: 'Removido do Portador',
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  baixa: 'Baixa',
  transferencia: 'Transferência',
  retorno_manutencao: 'Retorno Manutenção',
  correcao_manual: 'Correção Manual',
};

const TIPO_MOVIMENTACAO_COLORS: Record<string, string> = {
  entrada: 'bg-green-500/10 text-green-600 border-green-500/30',
  atribuicao_portador: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  remocao_portador: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  instalacao: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  manutencao: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  baixa: 'bg-red-500/10 text-red-600 border-red-500/30',
  transferencia: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  retorno_manutencao: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  correcao_manual: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
};

const RESULTADO_MANUTENCAO_LABELS: Record<string, string> = {
  resolvido: 'Resolvido',
  substituicao: 'Substituição',
  nao_resolvido: 'Não Resolvido',
  associado_ausente: 'Associado Ausente',
};

const RESULTADO_MANUTENCAO_COLORS: Record<string, string> = {
  resolvido: 'bg-green-500/10 text-green-600 border-green-500/30',
  substituicao: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  nao_resolvido: 'bg-red-500/10 text-red-600 border-red-500/30',
  associado_ausente: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
};

const ETAPA_MANUTENCAO_INTERNA_LABELS: Record<string, string> = {
  aguardando_triagem: 'Aguardando Triagem',
  em_triagem: 'Em Triagem',
  em_analise_plataforma: 'Análise na Plataforma',
  em_garantia: 'Em Garantia',
  concluido_estoque: 'Concluído - Devolvido Estoque',
  concluido_descarte: 'Concluído - Descartado',
};

// ===== COMPONENTE PRINCIPAL =====

interface HistoricoCompletoRastreadorProps {
  rastreadorId: string;
}

export function HistoricoCompletoRastreador({ rastreadorId }: HistoricoCompletoRastreadorProps) {
  const [tab, setTab] = useState<'todos' | 'movimentacoes' | 'manutencoes'>('todos');

  // Query: Movimentações
  const { data: movimentacoes, isLoading: loadingMov } = useQuery({
    queryKey: ['rastreador-movimentacoes', rastreadorId],
    enabled: !!rastreadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          tipo,
          status_anterior,
          status_novo,
          observacoes,
          created_at,
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(id, nome),
          veiculo:veiculos(placa)
        `)
        .eq('rastreador_id', rastreadorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });

  // Query: Manutenções de Campo
  const { data: manutencoesCampo, isLoading: loadingCampo } = useQuery({
    queryKey: ['rastreador-manutencoes-campo', rastreadorId],
    enabled: !!rastreadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          protocolo,
          status,
          resultado_manutencao,
          motivo_manutencao,
          motivo_detalhe,
          observacoes_analise,
          concluida_em,
          created_at,
          fotos_manutencao,
          checklist_manutencao,
          profissional:profiles!servicos_profissional_id_fkey(id, nome)
        `)
        .eq('rastreador_id', rastreadorId)
        .eq('tipo', 'vistoria_manutencao')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ManutencaoCampo[];
    },
  });

  // Query: Manutenções Internas
  const { data: manutencoesInternas, isLoading: loadingInternas } = useQuery({
    queryKey: ['rastreador-manutencoes-internas', rastreadorId],
    enabled: !!rastreadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          id,
          etapa,
          diagnostico_inicial,
          defeito_identificado,
          acao_tomada,
          encaminhado_para,
          numero_protocolo_externo,
          laudo_externo,
          created_at,
          resolvido_em,
          servico_origem:servicos(protocolo),
          resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ManutencaoInterna[];
    },
  });

  // Unifica e ordena eventos
  const eventos = useMemo<EventoHistorico[]>(() => {
    const list: EventoHistorico[] = [];

    movimentacoes?.forEach((m) => {
      list.push({ tipo: 'movimentacao', data: m, created_at: m.created_at });
    });

    manutencoesCampo?.forEach((m) => {
      list.push({ tipo: 'manutencao_campo', data: m, created_at: m.created_at });
    });

    manutencoesInternas?.forEach((m) => {
      list.push({ tipo: 'manutencao_interna', data: m, created_at: m.created_at });
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [movimentacoes, manutencoesCampo, manutencoesInternas]);

  // Filtra por tab
  const eventosFiltrados = useMemo(() => {
    if (tab === 'todos') return eventos;
    if (tab === 'movimentacoes') return eventos.filter((e) => e.tipo === 'movimentacao');
    return eventos.filter((e) => e.tipo === 'manutencao_campo' || e.tipo === 'manutencao_interna');
  }, [eventos, tab]);

  const isLoading = loadingMov || loadingCampo || loadingInternas;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhum histórico registrado</p>
        <p className="text-xs text-muted-foreground mt-1">
          O histórico aparecerá aqui quando houver movimentações ou manutenções
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="todos" className="text-xs">
            Todos ({eventos.length})
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="text-xs">
            Estoque ({movimentacoes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="manutencoes" className="text-xs">
            Manutenções ({(manutencoesCampo?.length || 0) + (manutencoesInternas?.length || 0)})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Timeline */}
      <ScrollArea className="h-[350px] pr-4">
        <div className="relative">
          {/* Linha da timeline */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-4">
            {eventosFiltrados.map((evento) => (
              <EventoItem key={`${evento.tipo}-${evento.tipo === 'movimentacao' ? evento.data.id : evento.tipo === 'manutencao_campo' ? evento.data.id : evento.data.id}`} evento={evento} />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== SUB-COMPONENTES =====

function EventoItem({ evento }: { evento: EventoHistorico }) {
  if (evento.tipo === 'movimentacao') {
    return <MovimentacaoItem data={evento.data} />;
  }
  if (evento.tipo === 'manutencao_campo') {
    return <ManutencaoCampoItem data={evento.data} />;
  }
  return <ManutencaoInternaItem data={evento.data} />;
}

function MovimentacaoItem({ data }: { data: Movimentacao }) {
  const Icon = TIPO_MOVIMENTACAO_ICONS[data.tipo] || ArrowRightLeft;
  const label = TIPO_MOVIMENTACAO_LABELS[data.tipo] || data.tipo;
  const color = TIPO_MOVIMENTACAO_COLORS[data.tipo] || 'bg-muted text-muted-foreground border-border';

  return (
    <div className="relative pl-10">
      <div className={cn('absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center', color)}>
        <Icon className="h-3 w-3" />
      </div>

      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className={color}>
              {label}
            </Badge>
            {data.status_anterior && data.status_novo && (
              <p className="text-xs text-muted-foreground">
                {data.status_anterior} → {data.status_novo}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(data.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {data.observacoes && (
          <p className="text-sm text-muted-foreground">{data.observacoes}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {data.usuario?.nome && (
            <span>
              Por: <span className="font-medium">{data.usuario.nome}</span>
            </span>
          )}
          {data.veiculo?.placa && (
            <span>
              Veículo: <span className="font-medium">{data.veiculo.placa}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ManutencaoCampoItem({ data }: { data: ManutencaoCampo }) {
  const [checklistOpen, setChecklistOpen] = useState(false);

  const checklistItems = data.checklist_manutencao || [];
  const checklistOk = checklistItems.filter((i) => i.status === 'ok').length;

  const fotos: FotoManutencao[] = data.fotos_manutencao || [];

  return (
    <div className="relative pl-10">
      <div className="absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-600 border border-amber-500/30">
        <Wrench className="h-3 w-3" />
      </div>

      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                Manutenção de Campo
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">{data.protocolo}</span>
            </div>
            {data.resultado_manutencao && (
              <Badge
                variant="outline"
                className={cn('text-xs', RESULTADO_MANUTENCAO_COLORS[data.resultado_manutencao] || '')}
              >
                {RESULTADO_MANUTENCAO_LABELS[data.resultado_manutencao] || data.resultado_manutencao}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(data.concluida_em || data.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Detalhes */}
        <div className="space-y-1 text-sm">
          {data.motivo_manutencao && (
            <p className="text-muted-foreground">
              <span className="font-medium">Motivo:</span> {data.motivo_manutencao}
              {data.motivo_detalhe && ` - ${data.motivo_detalhe}`}
            </p>
          )}
          {data.profissional?.nome && (
            <p className="text-muted-foreground">
              <span className="font-medium">Técnico:</span> {data.profissional.nome}
            </p>
          )}
          {data.observacoes_analise && (
            <p className="text-muted-foreground mt-2 text-xs italic">
              "{data.observacoes_analise}"
            </p>
          )}
        </div>

        {/* Checklist Colapsável */}
        {checklistItems.length > 0 && (
          <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <ClipboardCheck className="h-3 w-3" />
              <span>
                Checklist ({checklistOk}/{checklistItems.length} verificados)
              </span>
              {checklistOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 pl-5 space-y-1">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  {item.status === 'ok' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(item.status === 'nao_ok' && 'text-red-600')}>
                    {item.item}
                  </span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Galeria de Fotos */}
        {fotos.length > 0 && <FotosManutencaoGaleria fotos={fotos} />}
      </div>
    </div>
  );
}

function ManutencaoInternaItem({ data }: { data: ManutencaoInterna }) {
  return (
    <div className="relative pl-10">
      <div className="absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center bg-purple-500/10 text-purple-600 border border-purple-500/30">
        <Settings className="h-3 w-3" />
      </div>

      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
              Manutenção Interna
            </Badge>
            {data.servico_origem?.protocolo && (
              <span className="text-xs font-mono text-muted-foreground block">
                Origem: {data.servico_origem.protocolo}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(data.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Detalhes */}
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium">Etapa:</span>{' '}
            {ETAPA_MANUTENCAO_INTERNA_LABELS[data.etapa] || data.etapa}
          </p>
          {data.diagnostico_inicial && (
            <p className="text-muted-foreground">
              <span className="font-medium">Diagnóstico:</span> {data.diagnostico_inicial}
            </p>
          )}
          {data.defeito_identificado && (
            <p className="text-muted-foreground">
              <span className="font-medium">Defeito:</span> {data.defeito_identificado}
            </p>
          )}
          {data.acao_tomada && (
            <p className="text-muted-foreground">
              <span className="font-medium">Ação:</span> {data.acao_tomada}
            </p>
          )}
          {data.encaminhado_para && (
            <p className="text-muted-foreground">
              <span className="font-medium">Encaminhado para:</span> {data.encaminhado_para}
            </p>
          )}
          {data.numero_protocolo_externo && (
            <p className="text-muted-foreground">
              <span className="font-medium">Protocolo externo:</span> {data.numero_protocolo_externo}
            </p>
          )}
          {data.laudo_externo && (
            <p className="text-muted-foreground text-xs italic mt-1">
              Laudo: "{data.laudo_externo}"
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {data.resolvido_por_profile?.nome && (
            <span>
              Resolvido por: <span className="font-medium">{data.resolvido_por_profile.nome}</span>
            </span>
          )}
          {data.resolvido_em && (
            <span>
              em {format(new Date(data.resolvido_em), "dd/MM/yy", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
