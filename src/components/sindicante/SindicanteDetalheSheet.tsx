import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Pencil, Calendar, Clock, BarChart3 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ESPECIALIDADES_LABELS, REGIOES_LABELS, CONCLUSAO_LAUDO_LABELS, type EmpresaSindicancia, type ConclusaoLaudo } from '@/types/sindicancia';

const ESPECIALIDADE_COLORS: Record<string, string> = {
  fraude_veicular: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  roubo_furto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  incendio: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  colisao_suspeita: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  geral: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const CONCLUSAO_COLORS: Record<string, string> = {
  regular: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  irregular_comprovada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  irregular_suspeita: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  inconclusivo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

interface Props {
  empresa: EmpresaSindicancia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (e: EmpresaSindicancia) => void;
  casosAtivos: number;
}

interface SindicanciaRow {
  id: string;
  numero: string;
  sinistro_id: string;
  data_abertura: string;
  data_laudo: string | null;
  laudo_conclusao: string | null;
  status: string;
}

interface Metricas {
  total: number;
  tempoMedio: number | null;
  distribuicao: Record<string, number>;
}

export function SindicanteDetalheSheet({ empresa, open, onOpenChange, onEdit, casosAtivos }: Props) {
  const [sindicancias, setSindicancias] = useState<SindicanciaRow[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ total: 0, tempoMedio: null, distribuicao: {} });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresa || !open) return;
    setLoading(true);

    supabase
      .from('sindicancias')
      .select('id, numero, sinistro_id, data_abertura, data_laudo, laudo_conclusao, status')
      .eq('empresa_sindicancia_id', empresa.id)
      .order('data_abertura', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const rows = (data || []) as SindicanciaRow[];
        setSindicancias(rows);

        // Calculate metrics from ALL sindicancias (not just last 10)
        supabase
          .from('sindicancias')
          .select('data_abertura, data_laudo, laudo_conclusao')
          .eq('empresa_sindicancia_id', empresa.id)
          .then(({ data: allData }) => {
            const all = allData || [];
            const concluidas = all.filter(s => s.data_laudo);
            const tempos = concluidas.map(s => differenceInDays(parseISO(s.data_laudo!), parseISO(s.data_abertura)));
            const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;

            const dist: Record<string, number> = {};
            concluidas.forEach(s => {
              if (s.laudo_conclusao) {
                dist[s.laudo_conclusao] = (dist[s.laudo_conclusao] || 0) + 1;
              }
            });

            setMetricas({ total: all.length, tempoMedio, distribuicao: dist });
            setLoading(false);
          });
      });
  }, [empresa, open]);

  if (!empresa) return null;

  const totalDistribuicao = Object.values(metricas.distribuicao).reduce((a, b) => a + b, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{empresa.nome_fantasia || empresa.razao_social}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Dados da Empresa */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Dados da Empresa</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); onEdit(empresa); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Razão Social" value={empresa.razao_social} />
              {empresa.nome_fantasia && <InfoRow label="Nome Fantasia" value={empresa.nome_fantasia} />}
              <InfoRow label="CNPJ" value={empresa.cnpj} />
              <Separator />
              <InfoRow label="Responsável" value={empresa.responsavel_nome} />
              {empresa.responsavel_cpf && <InfoRow label="CPF" value={empresa.responsavel_cpf} />}
              {empresa.responsavel_telefone && <InfoRow label="Telefone" value={empresa.responsavel_telefone} />}
              {empresa.responsavel_email && <InfoRow label="Email" value={empresa.responsavel_email} />}
              <Separator />
              {empresa.especialidades?.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Especialidades</p>
                  <div className="flex flex-wrap gap-1">
                    {empresa.especialidades.map(esp => (
                      <Badge key={esp} variant="outline" className={`text-xs ${ESPECIALIDADE_COLORS[esp] || ''}`}>
                        {ESPECIALIDADES_LABELS[esp] || esp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {empresa.regioes_atuacao?.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Regiões</p>
                  <div className="flex flex-wrap gap-1">
                    {empresa.regioes_atuacao.map(r => (
                      <Badge key={r} variant="outline" className="text-xs">{REGIOES_LABELS[r] || r}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {empresa.valor_por_sindicancia && (
                <InfoRow label="Valor por Sindicância" value={`R$ ${Number(empresa.valor_por_sindicancia).toFixed(2)}`} />
              )}
              <InfoRow label="Cadastrado em" value={format(parseISO(empresa.created_at), "dd/MM/yyyy", { locale: ptBR })} />
            </CardContent>
          </Card>

          {/* Histórico de Sindicâncias */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Histórico de Sindicâncias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : sindicancias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sindicância registrada.</p>
              ) : (
                <div className="space-y-2">
                  {sindicancias.map(s => {
                    const dias = s.data_laudo
                      ? differenceInDays(parseISO(s.data_laudo), parseISO(s.data_abertura))
                      : differenceInDays(new Date(), parseISO(s.data_abertura));
                    const emAndamento = !s.data_laudo;

                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-xs">{s.numero}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(s.data_abertura), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {emAndamento ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                              Em andamento — {dias}d
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className={`text-xs ${CONCLUSAO_COLORS[s.laudo_conclusao || ''] || ''}`}>
                                {CONCLUSAO_LAUDO_LABELS[s.laudo_conclusao as ConclusaoLaudo] || s.laudo_conclusao || '—'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{dias}d</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Métricas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Realizadas</p>
                  <p className="text-xl font-bold">{metricas.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo Médio</p>
                  <p className="text-xl font-bold">
                    {metricas.tempoMedio !== null ? `${metricas.tempoMedio} dias` : '—'}
                  </p>
                </div>
              </div>

              {totalDistribuicao > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Distribuição de Resultados</p>
                  {Object.entries(metricas.distribuicao).map(([conclusao, count]) => {
                    const pct = Math.round((count / totalDistribuicao) * 100);
                    return (
                      <div key={conclusao} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{CONCLUSAO_LAUDO_LABELS[conclusao as ConclusaoLaudo] || conclusao}</span>
                          <span className="text-muted-foreground">{pct}% ({count})</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              conclusao === 'regular' ? 'bg-green-500' :
                              conclusao.startsWith('irregular') ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
