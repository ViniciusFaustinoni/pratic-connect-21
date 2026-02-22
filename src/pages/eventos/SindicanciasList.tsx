import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { differenceInDays, startOfMonth } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, AlertTriangle, CheckCircle, Clock, FileText, Eye, Gavel } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  STATUS_SINDICANCIA_LABELS,
  STATUS_SINDICANCIA_COLORS,
  CONCLUSAO_LAUDO_LABELS,
  type StatusSindicancia,
  type ConclusaoLaudo,
} from '@/types/sindicancia';
import { AtribuirSindicanteModal } from '@/components/sinistros/AtribuirSindicanteModal';

export default function SindicanciasList() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroConclusao, setFiltroConclusao] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [atribuirModal, setAtribuirModal] = useState<{ open: boolean; sindicanciaId: string; sinistroId: string; protocolo: string; dataLimite: string } | null>(null);

  const { data: sindicancias = [], isLoading, refetch } = useQuery({
    queryKey: ['sindicancias-list-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sindicancias')
        .select('*, empresa:empresas_sindicancia(nome_fantasia), sinistro:sinistros(protocolo, tipo)')
        .order('data_limite', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-sindicancia-filtro'],
    queryFn: async () => {
      const { data } = await supabase.from('empresas_sindicancia').select('id, nome_fantasia').eq('ativo', true);
      return data || [];
    },
  });

  const hoje = new Date();
  const inicioMes = startOfMonth(hoje);

  const kpis = useMemo(() => {
    const emAndamento = sindicancias.filter((s: any) => ['atribuido', 'em_andamento'].includes(s.status));
    const aguardandoDecisao = sindicancias.filter((s: any) => s.status === 'laudo_emitido');
    const prazoVencido = sindicancias.filter((s: any) => {
      if (!s.data_limite || ['encerrado', 'cancelado'].includes(s.status)) return false;
      return new Date(s.data_limite) < hoje;
    });
    const concluidasMes = sindicancias.filter((s: any) => s.status === 'encerrado' && new Date(s.updated_at) >= inicioMes);

    return {
      emAndamento: emAndamento.length,
      aguardandoDecisao: aguardandoDecisao.length,
      prazoVencido: prazoVencido.length,
      concluidasMes: concluidasMes.length,
    };
  }, [sindicancias]);

  const filtradas = useMemo(() => {
    let list = [...sindicancias];

    if (filtroStatus !== 'todos') {
      list = list.filter((s: any) => s.status === filtroStatus);
    }

    if (filtroConclusao !== 'todos') {
      if (filtroConclusao === 'sem_laudo') {
        list = list.filter((s: any) => !s.laudo_conclusao);
      } else if (filtroConclusao === 'irregular') {
        list = list.filter((s: any) => s.laudo_conclusao === 'irregular_comprovada' || s.laudo_conclusao === 'irregular_suspeita');
      } else {
        list = list.filter((s: any) => s.laudo_conclusao === filtroConclusao);
      }
    }

    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter((s: any) =>
        s.numero?.toLowerCase().includes(q) ||
        (s.sinistro as any)?.protocolo?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sindicancias, filtroStatus, filtroConclusao, busca]);

  const getDiasRestantes = (dataLimite: string | null, status: string) => {
    if (!dataLimite || ['encerrado', 'cancelado'].includes(status)) return null;
    return differenceInDays(new Date(dataLimite), hoje);
  };

  const CONCLUSAO_BADGE_STYLES: Record<string, string> = {
    regular: 'bg-green-100 text-green-800',
    irregular_comprovada: 'bg-red-100 text-red-800',
    irregular_suspeita: 'bg-orange-100 text-orange-800',
    inconclusivo: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/dashboard">Home</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/eventos/sinistros">Eventos</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Sindicâncias</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold">Sindicâncias</h1>
        <p className="text-muted-foreground">Acompanhamento de investigações</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><Clock className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.emAndamento}</p>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.aguardandoDecisao > 0 ? 'border-blue-300' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><Gavel className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.aguardandoDecisao}</p>
                <p className="text-xs text-muted-foreground">Aguardando Decisão</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.prazoVencido > 0 ? 'border-destructive' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.prazoVencido > 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.prazoVencido}</p>
                <p className="text-xs text-muted-foreground">Prazo Vencido</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700"><CheckCircle className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{kpis.concluidasMes}</p>
                <p className="text-xs text-muted-foreground">Concluídas (mês)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar número, protocolo..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_SINDICANCIA_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroConclusao} onValueChange={setFiltroConclusao}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Conclusão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="irregular">Irregular</SelectItem>
            <SelectItem value="inconclusivo">Inconclusivo</SelectItem>
            <SelectItem value="sem_laudo">Sem laudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Nº</th>
              <th className="text-left p-3 font-medium">Evento</th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Sindicante</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Prazo</th>
              <th className="text-left p-3 font-medium">Conclusão</th>
              <th className="text-left p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Nenhuma sindicância encontrada</td></tr>
            ) : (
              filtradas.map((s: any) => {
                const dias = getDiasRestantes(s.data_limite, s.status);
                const sinistro = s.sinistro;
                const empresa = s.empresa;
                return (
                  <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-medium">{s.numero}</td>
                    <td className="p-3">
                      {sinistro?.protocolo ? (
                        <Link to={`/eventos/sinistros/${s.sinistro_id}/analisar`} className="text-primary hover:underline text-xs font-medium">
                          {sinistro.protocolo}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-xs">{sinistro?.tipo || '—'}</td>
                    <td className="p-3 text-xs">{empresa?.nome_fantasia || 'Não atribuído'}</td>
                    <td className="p-3">
                      <Badge className={STATUS_SINDICANCIA_COLORS[s.status as StatusSindicancia] || 'bg-muted text-muted-foreground'}>
                        {STATUS_SINDICANCIA_LABELS[s.status as StatusSindicancia] || s.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {s.data_limite ? (
                        <div>
                          <span className="text-xs">{format(new Date(s.data_limite), 'dd/MM/yyyy')}</span>
                          {dias !== null && (
                            <div className={`text-xs font-semibold ${dias < 0 ? 'text-destructive' : dias <= 7 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `${dias}d restantes`}
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      {s.laudo_conclusao ? (
                        <Badge className={CONCLUSAO_BADGE_STYLES[s.laudo_conclusao] || 'bg-muted'}>
                          {CONCLUSAO_LAUDO_LABELS[s.laudo_conclusao as ConclusaoLaudo] || s.laudo_conclusao}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {s.status === 'aguardando_atribuicao' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setAtribuirModal({
                              open: true,
                              sindicanciaId: s.id,
                              sinistroId: s.sinistro_id,
                              protocolo: sinistro?.protocolo || '',
                              dataLimite: s.data_limite,
                            })}
                          >
                            Atribuir
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                          <Link to={`/eventos/sinistros/${s.sinistro_id}/analisar`}>
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Link>
                        </Button>
                        {s.status === 'laudo_emitido' && (
                          <Button size="sm" variant="default" className="h-7 text-xs" asChild>
                            <Link to={`/eventos/sinistros/${s.sinistro_id}/analisar`}>
                              <Gavel className="h-3 w-3 mr-1" />
                              Decidir
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Atribuir Sindicante */}
      {atribuirModal && (
        <AtribuirSindicanteModal
          sindicanciaId={atribuirModal.sindicanciaId}
          sinistroId={atribuirModal.sinistroId}
          protocolo={atribuirModal.protocolo}
          dataLimite={atribuirModal.dataLimite}
          open={atribuirModal.open}
          onOpenChange={(open) => !open && setAtribuirModal(null)}
          onSuccess={() => { setAtribuirModal(null); refetch(); }}
        />
      )}
    </div>
  );
}
