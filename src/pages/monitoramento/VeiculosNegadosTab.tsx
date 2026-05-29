import { useState, useMemo } from 'react';
import { Ban, History, CalendarPlus, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useVeiculosNegados, type VeiculoNegado } from '@/hooks/useVeiculosNegados';
import { NovaVistoriaNegadoModal } from '@/components/servicos-campo/NovaVistoriaNegadoModal';
import { HistoricoNegadoDrawer } from '@/components/servicos-campo/HistoricoNegadoDrawer';

export default function VeiculosNegadosTab() {
  const { data, isLoading } = useVeiculosNegados();
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<VeiculoNegado | null>(null);
  const [modalVistoria, setModalVistoria] = useState(false);
  const [drawerHistorico, setDrawerHistorico] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((v) =>
      v.placa.toLowerCase().includes(q) ||
      (v.associado_nome ?? '').toLowerCase().includes(q) ||
      (v.associado_cpf ?? '').includes(q),
    );
  }, [data, busca]);

  return (
    <div className="space-y-4 py-2">
      <Card className="border-destructive/30 bg-destructive/5">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Ban className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Veículos Negados</h2>
            {data && data.length > 0 && (
              <Badge variant="destructive">{data.length}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Veículos com proteção negada pelo instalador, vistoriador, Cadastro ou Monitoramento.
            Contrato e histórico preservados — Monitoramento pode criar nova vistoria diretamente.
          </p>
        </div>
      </Card>

      <Input
        placeholder="Buscar por placa, nome ou CPF…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum veículo negado no momento.
        </p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold">{v.placa}</span>
                    <span className="text-sm text-muted-foreground">
                      {v.marca} {v.modelo}
                    </span>
                    <Badge variant="destructive" className="gap-1">
                      <Ban className="h-3 w-3" /> Negado
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {v.associado_nome || '—'} {v.associado_cpf && (
                      <span className="text-muted-foreground font-normal ml-1">{v.associado_cpf}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Motivo:</strong> {v.motivo_recusa_veiculo || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Negado por <strong>{v.recusado_por_nome || '—'}</strong>
                    {v.recusado_em && (
                      <> em {format(new Date(v.recusado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        {' '}({formatDistanceToNow(new Date(v.recusado_em), { locale: ptBR, addSuffix: true })})</>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.total_servicos} serviço(s) no histórico
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setSelecionado(v); setDrawerHistorico(true); }}>
                    <History className="h-4 w-4 mr-1" /> Ver Histórico
                  </Button>
                  <Button size="sm" onClick={() => { setSelecionado(v); setModalVistoria(true); }}>
                    <CalendarPlus className="h-4 w-4 mr-1" /> Criar Nova Vistoria
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NovaVistoriaNegadoModal
        veiculo={selecionado}
        open={modalVistoria}
        onOpenChange={setModalVistoria}
      />
      <HistoricoNegadoDrawer
        veiculo={selecionado}
        open={drawerHistorico}
        onOpenChange={setDrawerHistorico}
      />
    </div>
  );
}
