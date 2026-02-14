import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { differenceInDays, startOfMonth, addDays } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS, RESULTADO_SINDICANCIA_LABELS } from '@/types/sinistros';
import type { ResultadoSindicancia, StatusSinistro } from '@/types/sinistros';

export default function SindicanciasList() {
  const [filtroStatus, setFiltroStatus] = useState<string>('abertas');
  const [busca, setBusca] = useState('');

  const { data: sindicancias = [], isLoading } = useQuery({
    queryKey: ['sindicancias-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id, protocolo, tipo, status, resultado_sindicancia,
          sindicancia_prazo_fim, motivo_analise_interna, motivo_suspensao,
          created_at, updated_at,
          associados:associado_id (id, nome),
          veiculos:veiculo_id (placa, modelo),
          sindicante:sindicante_id (id, nome)
        `)
        .or('status.in.(em_sindicancia,em_pericia),resultado_sindicancia.not.is.null')
        .order('sindicancia_prazo_fim', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const hoje = new Date();
  const inicioMes = startOfMonth(hoje);
  const em7dias = addDays(hoje, 7);

  const kpis = useMemo(() => {
    const abertas = sindicancias.filter((s: any) => ['em_sindicancia', 'em_pericia'].includes(s.status));
    const vencendo = abertas.filter((s: any) => {
      if (!s.sindicancia_prazo_fim) return false;
      const prazo = new Date(s.sindicancia_prazo_fim);
      return prazo <= em7dias && prazo >= hoje;
    });
    const vencidas = abertas.filter((s: any) => {
      if (!s.sindicancia_prazo_fim) return false;
      return new Date(s.sindicancia_prazo_fim) < hoje;
    });
    const concluidas = sindicancias.filter((s: any) => s.resultado_sindicancia && new Date(s.updated_at) >= inicioMes);
    const irregulares = concluidas.filter((s: any) => s.resultado_sindicancia === 'irregular');
    const taxa = concluidas.length > 0 ? Math.round((irregulares.length / concluidas.length) * 100) : 0;

    return {
      abertas: abertas.length,
      vencendo: vencendo.length + vencidas.length,
      concluidas: concluidas.length,
      taxa,
    };
  }, [sindicancias]);

  const filtradas = useMemo(() => {
    let list = [...sindicancias];
    if (filtroStatus === 'abertas') {
      list = list.filter((s: any) => ['em_sindicancia', 'em_pericia'].includes(s.status));
    } else if (filtroStatus === 'concluidas') {
      list = list.filter((s: any) => s.resultado_sindicancia != null);
    }
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter((s: any) =>
        s.protocolo?.toLowerCase().includes(q) ||
        (s.associados as any)?.nome?.toLowerCase().includes(q) ||
        (s.veiculos as any)?.placa?.toLowerCase().includes(q)
      );
    }
    // Sort: abertas primeiro, por prazo crescente
    list.sort((a: any, b: any) => {
      const aAberta = ['em_sindicancia', 'em_pericia'].includes(a.status) ? 0 : 1;
      const bAberta = ['em_sindicancia', 'em_pericia'].includes(b.status) ? 0 : 1;
      if (aAberta !== bAberta) return aAberta - bAberta;
      const pa = a.sindicancia_prazo_fim ? new Date(a.sindicancia_prazo_fim).getTime() : Infinity;
      const pb = b.sindicancia_prazo_fim ? new Date(b.sindicancia_prazo_fim).getTime() : Infinity;
      return pa - pb;
    });
    return list;
  }, [sindicancias, filtroStatus, busca]);

  const getDiasRestantes = (prazoFim: string | null) => {
    if (!prazoFim) return null;
    return differenceInDays(new Date(prazoFim), hoje);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sindicâncias & Perícias</h1>
        <p className="text-muted-foreground">Gestão de investigações em andamento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><Clock className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.abertas}</p>
                <p className="text-xs text-muted-foreground">Abertas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.vencendo > 0 ? 'border-destructive' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.vencendo > 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.vencendo}</p>
                <p className="text-xs text-muted-foreground">Vencendo/Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700"><CheckCircle className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.concluidas}</p>
                <p className="text-xs text-muted-foreground">Concluídas (mês)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.taxa}%</p>
                <p className="text-xs text-muted-foreground">Taxa Irregularidade</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar protocolo, associado, placa..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Abertas</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Protocolo</th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Associado</th>
              <th className="text-left p-3 font-medium">Placa</th>
              <th className="text-left p-3 font-medium">Responsável</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Prazo</th>
              <th className="text-left p-3 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Nenhuma sindicância encontrada</td></tr>
            ) : (
              filtradas.map((s: any) => {
                const dias = getDiasRestantes(s.sindicancia_prazo_fim);
                const isAberta = ['em_sindicancia', 'em_pericia'].includes(s.status);
                return (
                  <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link to={`/eventos/sindicancias/${s.id}`} className="text-primary hover:underline font-medium">
                        {s.protocolo}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={s.status === 'em_pericia' ? 'border-pink-300 text-pink-700' : 'border-rose-300 text-rose-700'}>
                        {s.status === 'em_pericia' ? 'Perícia' : 'Sindicância'}
                      </Badge>
                    </td>
                    <td className="p-3">{(s.associados as any)?.nome || '—'}</td>
                    <td className="p-3 font-mono text-xs">{(s.veiculos as any)?.placa || '—'}</td>
                    <td className="p-3">{(s.sindicante as any)?.nome || '—'}</td>
                    <td className="p-3">
                      <Badge className={STATUS_SINISTRO_COLORS[s.status as StatusSinistro] || 'bg-muted'}>
                        {STATUS_SINISTRO_LABELS[s.status as StatusSinistro] || s.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {s.sindicancia_prazo_fim ? (
                        <div>
                          <span className="text-xs">{format(new Date(s.sindicancia_prazo_fim), 'dd/MM/yyyy')}</span>
                          {isAberta && dias !== null && (
                            <div className={`text-xs font-semibold ${dias < 0 ? 'text-destructive' : dias <= 7 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {dias < 0 ? 'VENCIDA' : `${dias}d restantes`}
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      {s.resultado_sindicancia ? (
                        <Badge variant="secondary" className="text-xs">
                          {RESULTADO_SINDICANCIA_LABELS[s.resultado_sindicancia as ResultadoSindicancia] || s.resultado_sindicancia}
                        </Badge>
                      ) : isAberta ? (
                        <span className="text-xs text-muted-foreground">Em andamento</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
