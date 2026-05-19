import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MessageSquareWarning, ShieldAlert, ChevronDown, ChevronUp, Tag, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Card que expõe ao analista do Cadastro o contexto que o operador deixou
 * no momento da cotação (e que viaja para o SGA Hinova):
 *  - Observação livre (`cotacoes.dados_extras.observacao_sga`)
 *  - Tipo da Cotação (`cotacoes.tipo_entrada` + `dados_extras.tipo_entrada_descricao`)
 *  - Motivo do "Ignorar e Prosseguir" (`dados_extras.motivo_ignorar_aviso`)
 *  - Histórico de avisos SGA (tabela `cotacao_avisos_sga` por contrato_id/cpf/placa)
 *
 * Componente puramente de leitura. Não altera regras de aprovação.
 */

const TIPO_LABELS: Record<string, string> = {
  adesao: 'Cotação nova (adesão)',
  inclusao: 'Inclusão de veículo',
  substituicao_placa: 'Substituição de veículo',
  substituicao: 'Substituição de veículo',
  troca_titularidade: 'Troca de titularidade',
  reativacao: 'Reativação',
  migracao: 'Migração',
  outro: 'Outro',
};

const TIPO_BADGE_CLASS: Record<string, string> = {
  adesao: 'bg-primary/15 text-primary border-primary/30',
  inclusao: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
  substituicao_placa: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
  substituicao: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
  troca_titularidade: 'bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-400',
  outro: 'bg-muted text-muted-foreground border-border',
};

interface AvisoSGA {
  tipo: string;
  titulo: string;
  mensagem: string | null;
  decisao: string | null;
  motivo: string | null;
  decidido_por_nome: string | null;
  decidido_em: string | null;
}

interface ObservacoesCotacaoCardProps {
  cotacaoId?: string | null;
  contratoId?: string | null;
  cpf?: string | null;
  placa?: string | null;
  /** Modo compacto para listas/sidebars (sem histórico colapsável detalhado) */
  compact?: boolean;
  className?: string;
}

export function ObservacoesCotacaoCard({
  cotacaoId,
  contratoId,
  cpf,
  placa,
  compact = false,
  className,
}: ObservacoesCotacaoCardProps) {
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const { data } = useQuery({
    queryKey: ['observacoes-cotacao-card', cotacaoId, contratoId, cpf, placa],
    queryFn: async () => {
      let tipoEntrada: string | null = null;
      let dadosExtras: any = {};

      if (cotacaoId) {
        const { data: cot } = await supabase
          .from('cotacoes')
          .select('tipo_entrada, dados_extras')
          .eq('id', cotacaoId)
          .maybeSingle();
        tipoEntrada = (cot?.tipo_entrada as string | null) ?? null;
        dadosExtras = (cot?.dados_extras as any) ?? {};
      }

      const cpfLimpo = (cpf || '').replace(/\D/g, '');
      const placaLimpa = (placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const filtros: string[] = [];
      if (contratoId) filtros.push(`contrato_id.eq.${contratoId}`);
      if (cpfLimpo) filtros.push(`cpf.eq.${cpfLimpo}`);
      if (placaLimpa) filtros.push(`placa.eq.${placaLimpa}`);

      let avisos: AvisoSGA[] = [];
      if (filtros.length > 0) {
        const { data: rows } = await (supabase as any)
          .from('cotacao_avisos_sga')
          .select('tipo,titulo,mensagem,decisao,motivo,decidido_por_nome,decidido_em')
          .or(filtros.join(','))
          .order('decidido_em', { ascending: true });
        avisos = (rows || []) as AvisoSGA[];
      }

      return { tipoEntrada, dadosExtras, avisos };
    },
    enabled: !!(cotacaoId || contratoId || cpf || placa),
    staleTime: 60_000,
  });

  if (!data) return null;

  const { tipoEntrada, dadosExtras, avisos } = data;
  const observacaoLivre: string =
    typeof dadosExtras?.observacao_sga === 'string' ? dadosExtras.observacao_sga.trim() : '';
  const motivoIgnorar: string =
    typeof dadosExtras?.motivo_ignorar_aviso === 'string' ? dadosExtras.motivo_ignorar_aviso.trim() : '';
  const tipoDescricao: string =
    typeof dadosExtras?.tipo_entrada_descricao === 'string' ? dadosExtras.tipo_entrada_descricao.trim() : '';

  const temAlgo =
    !!observacaoLivre || !!motivoIgnorar || !!tipoEntrada || avisos.length > 0 || !!tipoDescricao;

  if (!temAlgo) return null;

  const tipoLabel = tipoEntrada ? TIPO_LABELS[tipoEntrada] ?? tipoEntrada : null;
  const tipoBadgeCls = tipoEntrada
    ? TIPO_BADGE_CLASS[tipoEntrada] ?? 'bg-muted text-muted-foreground border-border'
    : '';

  return (
    <div
      className={cn(
        'rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3',
        compact && 'p-3 space-y-2 border',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <MessageSquareWarning className={cn('h-5 w-5 text-primary shrink-0', compact && 'h-4 w-4')} />
        <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
          Observações do operador (enviadas ao SGA)
        </h3>
      </div>

      {/* Tipo da Cotação */}
      {tipoLabel && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tipo da cotação:</span>
          <Badge variant="outline" className={cn('font-medium', tipoBadgeCls)}>
            {tipoLabel}
          </Badge>
          {tipoDescricao && (
            <span className="text-xs text-muted-foreground italic">— {tipoDescricao}</span>
          )}
        </div>
      )}

      {/* Observação livre */}
      {observacaoLivre && (
        <div className="rounded-md border border-primary/20 bg-background/60 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Observação livre</div>
          <p
            className={cn(
              'whitespace-pre-wrap break-words text-foreground leading-relaxed',
              compact ? 'text-sm' : 'text-[15px]',
            )}
          >
            {observacaoLivre}
          </p>
        </div>
      )}

      {/* Motivo do "Ignorar e Prosseguir" */}
      {motivoIgnorar && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-destructive mb-1">
              Operador ignorou aviso do SGA
            </div>
            <p className="text-sm whitespace-pre-wrap break-words text-foreground">
              {motivoIgnorar}
            </p>
          </div>
        </div>
      )}

      {/* Histórico de avisos SGA */}
      {avisos.length > 0 && (
        <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2 text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                Histórico de avisos SGA durante a cotação ({avisos.length})
              </span>
              {historicoAberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {avisos.map((a, i) => {
              const dt = a.decidido_em
                ? new Date(a.decidido_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : '—';
              const decisaoLabel =
                a.decisao === 'ignorado_prosseguiu'
                  ? 'Concordou e prosseguiu'
                  : a.decisao === 'cancelou'
                  ? 'Cancelou'
                  : 'Visualizou';
              const isDestaque = a.decisao === 'ignorado_prosseguiu';
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-md border p-2.5 text-xs space-y-1',
                    isDestaque
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-background/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{a.titulo}</span>
                    <span className="text-muted-foreground tabular-nums">{dt}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className={cn(isDestaque && 'text-destructive font-medium')}>
                      {decisaoLabel}
                    </span>
                    {a.decidido_por_nome && <> · {a.decidido_por_nome}</>}
                  </div>
                  {a.motivo && (
                    <div className="text-foreground whitespace-pre-wrap break-words">
                      <span className="text-muted-foreground">Motivo:</span> {a.motivo}
                    </div>
                  )}
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
