import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Inconsistencia {
  descricao: string;
  gravidade: 'leve' | 'moderada' | 'grave';
  relatos_envolvidos: string[];
}

interface Omissao {
  descricao: string;
  presente_em: string;
  ausente_em: string;
}

interface AnaliseConsistencia {
  pontuacao_inconsistencia: number;
  resumo: string;
  consistencias: string[];
  inconsistencias: Inconsistencia[];
  omissoes: Omissao[];
  parecer: string;
  relato_comunicacao: string | null;
  relato_bo: string | null;
  relato_link: string | null;
  relatos_disponiveis: number;
  salvo_em?: string;
  sem_analise?: boolean;
  motivo?: string;
}

interface CardRelatosEventoProps {
  sinistroId: string;
  descricaoSinistro?: string | null;
  linkEvento?: any;
}

const gravidadeConfig = {
  leve: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: Info },
  moderada: { color: 'bg-orange-50 border-orange-200 text-orange-800', icon: AlertTriangle },
  grave: { color: 'bg-red-50 border-red-200 text-red-800', icon: ShieldAlert },
};

function ScoreBadge({ score }: { score: number }) {
  const config = score <= 1
    ? { bg: 'bg-green-100 text-green-800 border-green-200', label: 'Consistente' }
    : score <= 3
    ? { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Atenção' }
    : { bg: 'bg-red-100 text-red-800 border-red-200', label: 'Inconsistente' };

  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', config.bg)}>
      {score}/5 — {config.label}
    </Badge>
  );
}

export function CardRelatosEvento({ sinistroId, descricaoSinistro, linkEvento }: CardRelatosEventoProps) {
  const [analise, setAnalise] = useState<AnaliseConsistencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandedRelatos, setExpandedRelatos] = useState(false);
  const [expandedAnalise, setExpandedAnalise] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('analise-consistencia-relatos', {
          body: { sinistro_id: sinistroId },
        });
        if (error) throw error;
        if (data && !data.sem_analise && !data.error) {
          setAnalise(data as AnaliseConsistencia);
        } else if (data?.sem_analise && data?.relato_comunicacao !== undefined) {
          // Has report data but not enough for analysis
          setAnalise(data as AnaliseConsistencia);
        }
      } catch (err) {
        console.error('Erro ao carregar análise de consistência:', err);
      } finally {
        setCarregandoInicial(false);
      }
    };
    carregar();
  }, [sinistroId]);

  const executarAnalise = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('analise-consistencia-relatos', {
        body: { sinistro_id: sinistroId, forcar_reanalise: true },
      });
      if (error) throw new Error(error.message || 'Erro ao chamar análise');
      if (data?.error) throw new Error(data.error);
      if (data?.sem_analise) {
        setAnalise(data as AnaliseConsistencia);
        toast.info(data.motivo || 'Relatos insuficientes para comparação');
        return;
      }
      setAnalise(data as AnaliseConsistencia);
      toast.success('Análise de consistência concluída!');
    } catch (err: any) {
      console.error('Erro na análise:', err);
      setErro(err.message || 'Erro ao processar');
      toast.error(err.message || 'Erro na análise');
    } finally {
      setLoading(false);
    }
  };

  // Build local reports for display even without AI analysis
  const relatoComunicacao = analise?.relato_comunicacao || descricaoSinistro || null;
  const relatoBO = analise?.relato_bo || (linkEvento?.dados_etapa2 as any)?.relato_bo || (linkEvento?.dados_etapa2 as any)?.descricao_bo || null;
  const relatoLink = analise?.relato_link || (linkEvento?.dados_etapa3 as any)?.relato_texto || null;

  const temRelatos = !!(relatoComunicacao || relatoBO || relatoLink);
  const relatosCount = [relatoComunicacao, relatoBO, relatoLink].filter(Boolean).length;

  if (carregandoInicial) {
    return (
      <Card className="border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <MessageSquareText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasConsistencyAnalysis = analise && !analise.sem_analise && analise.pontuacao_inconsistencia !== undefined;

  return (
    <Card className={cn(
      'border-2',
      hasConsistencyAnalysis
        ? analise.pontuacao_inconsistencia <= 1
          ? 'border-green-200'
          : analise.pontuacao_inconsistencia <= 3
          ? 'border-yellow-200'
          : 'border-red-200'
        : 'border-blue-200'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-sm">Relatos do Evento</CardTitle>
            {hasConsistencyAnalysis && <ScoreBadge score={analise.pontuacao_inconsistencia} />}
          </div>
          <div className="flex items-center gap-2">
            {analise?.salvo_em && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(analise.salvo_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            <Button
              size="sm"
              variant={hasConsistencyAnalysis ? 'ghost' : 'default'}
              onClick={executarAnalise}
              disabled={loading || relatosCount < 2}
              title={relatosCount < 2 ? 'Necessários pelo menos 2 relatos' : 'Analisar consistência'}
              className={!hasConsistencyAnalysis ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : hasConsistencyAnalysis ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <>
                  <MessageSquareText className="h-3.5 w-3.5 mr-1.5" />
                  Analisar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error state */}
        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {/* Reports Section */}
        {temRelatos && !loading && (
          <div>
            <button
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full hover:text-foreground transition-colors"
              onClick={() => setExpandedRelatos(!expandedRelatos)}
            >
              <FileText className="h-3.5 w-3.5" />
              Relatos Originais ({relatosCount})
              {expandedRelatos ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </button>

            {expandedRelatos && (
              <div className="mt-3 space-y-3">
                {/* Relato da Comunicação */}
                {relatoComunicacao && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                        Comunicação Inicial
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{relatoComunicacao}</p>
                  </div>
                )}

                {/* Relato do B.O. */}
                {relatoBO && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                        Boletim de Ocorrência
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{relatoBO}</p>
                  </div>
                )}

                {/* Relato do Link */}
                {relatoLink && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                        Relato no Link do Evento
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{relatoLink}</p>
                  </div>
                )}

                {/* Missing reports */}
                {!relatoComunicacao && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <EyeOff className="h-3.5 w-3.5" /> Sem relato de comunicação inicial
                  </div>
                )}
                {!relatoBO && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <EyeOff className="h-3.5 w-3.5" /> Sem relato do B.O.
                  </div>
                )}
                {!relatoLink && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <EyeOff className="h-3.5 w-3.5" /> Sem relato no link do evento
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Consistency Analysis Results */}
        {hasConsistencyAnalysis && !loading && (
          <>
            <Separator />
            <div>
              <button
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full hover:text-foreground transition-colors"
                onClick={() => setExpandedAnalise(!expandedAnalise)}
              >
                <FileWarning className="h-3.5 w-3.5" />
                Relatório de Consistência
                {expandedAnalise ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
              </button>

              {expandedAnalise && (
                <div className="mt-3 space-y-3">
                  {/* Resumo */}
                  <div className="p-3 rounded-md bg-gray-900 text-white">
                    <p className="text-xs leading-relaxed">{analise.resumo}</p>
                  </div>

                  {/* Consistências */}
                  {analise.consistencias?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Pontos Consistentes ({analise.consistencias.length})
                      </p>
                      <div className="space-y-1">
                        {analise.consistencias.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded bg-green-50 border border-green-100 text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-green-800">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inconsistências */}
                  {analise.inconsistencias?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Inconsistências ({analise.inconsistencias.length})
                      </p>
                      <div className="space-y-1.5">
                        {analise.inconsistencias.map((inc, i) => {
                          const cfg = gravidadeConfig[inc.gravidade] || gravidadeConfig.leve;
                          const GravIcon = cfg.icon;
                          return (
                            <div key={i} className={cn('flex items-start gap-2 p-2 rounded border text-xs', cfg.color)}>
                              <GravIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium">{inc.descricao}</p>
                                <p className="opacity-75 text-[10px] mt-0.5">
                                  {inc.relatos_envolvidos.join(' × ')} • {inc.gravidade}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Omissões */}
                  {analise.omissoes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" /> Omissões ({analise.omissoes.length})
                      </p>
                      <div className="space-y-1">
                        {analise.omissoes.map((om, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-100 text-xs">
                            <Info className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-amber-800">{om.descricao}</p>
                              <p className="text-amber-600 text-[10px] mt-0.5">
                                Presente em: {om.presente_em} • Ausente em: {om.ausente_em}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parecer */}
                  <div className={cn(
                    'p-3 rounded-md border',
                    analise.pontuacao_inconsistencia >= 4
                      ? 'bg-red-50 border-red-200'
                      : analise.pontuacao_inconsistencia >= 2
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-green-50 border-green-200'
                  )}>
                    <h4 className="text-xs font-semibold mb-1">💡 Parecer</h4>
                    <p className="text-xs leading-relaxed">{analise.parecer}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* No reports at all */}
        {!temRelatos && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum relato disponível para este evento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
