import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, Search, ClipboardCheck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVeiculosSuspensos, type VeiculoSuspenso } from '@/hooks/useVeiculosSuspensos';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { registrarLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function VeiculoCard({ v, podeExecutar }: { v: VeiculoSuspenso; podeExecutar: boolean }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleExecutar = async () => {
    if (!podeExecutar) return;
    // Caso A: já existe serviço aberto → abre direto na rota do técnico
    if (v.servico_aberto) {
      void registrarLog({
        acao: 'iniciar',
        modulo: 'monitoramento',
        descricao: `Vistoria interna (suspenso) — ${v.placa}`,
        tabela: 'servicos',
        entidade_id: v.servico_aberto.id,
        dados_novos: {
          placa: v.placa, veiculo_id: v.id,
          motivo_suspensao: v.cobertura_suspensa_motivo,
          modo: 'vistoria_interna_coordenador_suspenso',
          reused_servico: true,
        },
      });
      window.open(`/instalador/instalacao/${v.servico_aberto.id}`, '_blank', 'noopener,noreferrer');
      return;
    }
    // Caso B: cria serviço via edge
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('abrir-servico-instalacao-suspenso', {
        body: { veiculoId: v.id },
      });
      if (error) throw error;
      const servicoId = (data as any)?.servicoId;
      if (!servicoId) throw new Error('Sem servicoId no retorno');
      toast.success('Serviço criado. Abrindo execução…');
      window.open(`/instalador/instalacao/${servicoId}`, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao abrir vistoria interna', {
        description: e?.message ?? 'Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-base">{v.placa}</span>
            <span className="text-muted-foreground text-sm truncate">
              {[v.marca, v.modelo].filter(Boolean).join(' ') || 'Modelo não informado'}
            </span>
            <Badge variant="destructive" className="gap-1">
              <ShieldOff className="h-3 w-3" />
              Suspenso
            </Badge>
            {v.servico_aberto && (
              <Badge variant="outline">
                Serviço {v.servico_aberto.status} já existente
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm font-medium">
            {v.associado_nome ?? '—'}
            {v.associado_cpf && (
              <span className="ml-2 text-xs text-muted-foreground">{v.associado_cpf}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            <strong>Motivo:</strong> {v.cobertura_suspensa_motivo ?? '—'}
          </div>
          {v.cobertura_suspensa_em && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Suspenso{' '}
              {formatDistanceToNow(new Date(v.cobertura_suspensa_em), {
                addSuffix: true, locale: ptBR,
              })}
              {' '}({v.dias_suspenso} dia{v.dias_suspenso === 1 ? '' : 's'})
            </div>
          )}
        </div>

        {podeExecutar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleExecutar}
            className="gap-1.5 h-9 border-primary/40 text-primary hover:bg-primary/5 shrink-0"
            title="Realizar vistoria interna (Coordenador de Monitoramento)"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Realizar Vistoria Interna
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function VeiculosSuspensosTab() {
  const { data, isLoading } = useVeiculosSuspensos();
  const perms = usePermissions();
  const podeExecutar =
    perms.isCoordenadorMonitoramento ||
    perms.isDiretor ||
    (perms as any).isAdminMaster ||
    (perms as any).isDesenvolvedor;
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (v) =>
        v.placa.toLowerCase().includes(q) ||
        (v.associado_nome ?? '').toLowerCase().includes(q) ||
        (v.associado_cpf ?? '').toLowerCase().includes(q),
    );
  }, [data, busca]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-destructive" />
          Veículos Suspensos
          {data && (
            <Badge variant="secondary" className="ml-1">{data.length}</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Veículos cuja cobertura de Roubo &amp; Furto foi suspensa por falta
          de instalação no prazo. O Coordenador de Monitoramento pode realizar
          a vistoria internamente — ao concluir, a cobertura é religada
          automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, nome ou CPF…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filtrados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum veículo suspenso por falta de instalação no momento.
          </div>
        )}

        <div className="space-y-2">
          {filtrados.map((v) => (
            <VeiculoCard key={v.id} v={v} podeExecutar={podeExecutar} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
