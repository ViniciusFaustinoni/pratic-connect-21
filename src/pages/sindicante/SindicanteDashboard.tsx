import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileSearch, Clock, AlertTriangle, FileText, Eye } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { STATUS_SINDICANCIA_LABELS, STATUS_SINDICANCIA_COLORS, type StatusSindicancia } from '@/types/sindicancia';

export default function SindicanteDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sindicancias, setSindicancias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('sindicancias')
        .select('*, sinistros(numero, tipo, subtipo)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSindicancias(data);
      }
      setLoading(false);
    };

    fetchData();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const casosAtivos = sindicancias.filter(s => ['atribuido', 'em_andamento'].includes(s.status));
  const laudosPendentes = sindicancias.filter(s => s.status === 'em_andamento' && !s.laudo_conclusao);
  const prazoProximo = casosAtivos
    .filter(s => s.data_limite)
    .sort((a, b) => new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime())[0];
  const solicitacoesPendentes = 0; // TODO: fetch from sindicancia_solicitacoes

  const diasRestantes = prazoProximo?.data_limite 
    ? differenceInDays(new Date(prazoProximo.data_limite), new Date()) 
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Sindicante</h1>
        <p className="text-muted-foreground">Acompanhe seus casos de sindicância</p>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Ativos</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{casosAtivos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laudos Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{laudosPendentes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo Mais Próximo</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {diasRestantes !== null ? (
              <div className={`text-2xl font-bold ${diasRestantes <= 7 ? 'text-destructive' : diasRestantes <= 15 ? 'text-yellow-600' : 'text-foreground'}`}>
                {diasRestantes <= 0 ? 'Vencido!' : `${diasRestantes} dias`}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Casos</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sindicancias.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de sindicâncias */}
      <Card>
        <CardHeader>
          <CardTitle>Meus Casos</CardTitle>
        </CardHeader>
        <CardContent>
          {sindicancias.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum caso atribuído ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sindicancias.map(s => {
                const status = s.status as StatusSindicancia;
                const prazoVencendo = s.data_limite && differenceInDays(new Date(s.data_limite), new Date()) <= 7;
                const prazoVencido = s.data_limite && isPast(new Date(s.data_limite));

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{s.numero}</span>
                        <Badge className={STATUS_SINDICANCIA_COLORS[status] || ''} variant="secondary">
                          {STATUS_SINDICANCIA_LABELS[status] || status}
                        </Badge>
                        {prazoVencido && status !== 'encerrado' && status !== 'cancelado' && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Prazo vencido
                          </Badge>
                        )}
                        {prazoVencendo && !prazoVencido && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Prazo próximo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        Evento: {(s as any).sinistros?.numero || '—'} • {(s as any).sinistros?.tipo || ''}
                      </p>
                      {s.data_limite && (
                        <p className="text-xs text-muted-foreground">
                          Prazo: {format(new Date(s.data_limite), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/sindicante/caso/${s.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
