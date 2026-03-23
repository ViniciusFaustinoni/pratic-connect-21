import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertTriangle, CheckCircle2, Phone } from 'lucide-react';
import { getHojeBrasilia } from '@/lib/date-utils';

interface VistoriadorAlerta {
  id: string;
  nome: string;
  telefone: string | null;
  inicioTurno: string;
  minutosAtivo: number;
  servicosConcluidos: number;
}

export function VistoriadoresEmAlerta() {
  const queryClient = useQueryClient();

  const { data: vistoriadores = [], isLoading } = useQuery({
    queryKey: ['vistoriadores-improdutivos'],
    queryFn: async () => {
      const hojeStr = getHojeBrasilia().toISOString().split('T')[0];

      // Ler config de limite
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'jornada_horas_alerta_improdutividade')
        .maybeSingle();
      const limiteMinutos = (parseFloat(configData?.valor ?? '2') || 2) * 60;

      // Buscar turnos ativos do dia
      const { data: turnos } = await (supabase as any)
        .from('turnos_profissionais')
        .select('id, profissional_id, inicio_turno, inicio_almoco, fim_almoco, status')
        .eq('data', hojeStr)
        .eq('status', 'ativo');

      if (!turnos?.length) return [];

      const profIds = turnos.map((t: any) => t.profissional_id);

      // Buscar profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, telefone')
        .in('id', profIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      // Buscar serviços concluídos por profissional hoje
      const { data: servicos } = await (supabase as any)
        .from('servicos')
        .select('profissional_id')
        .in('profissional_id', profIds)
        .eq('status', 'concluida')
        .gte('concluido_em', `${hojeStr}T00:00:00`)
        .lte('concluido_em', `${hojeStr}T23:59:59`);

      const contagemServicos: Record<string, number> = {};
      (servicos || []).forEach((s: any) => {
        contagemServicos[s.profissional_id] = (contagemServicos[s.profissional_id] || 0) + 1;
      });

      const agora = Date.now();
      const resultado: VistoriadorAlerta[] = [];

      for (const turno of turnos) {
        if (!turno.inicio_turno) continue;
        const inicio = new Date(turno.inicio_turno).getTime();
        let tempoAlmoco = 0;
        if (turno.inicio_almoco && turno.fim_almoco) {
          tempoAlmoco = new Date(turno.fim_almoco).getTime() - new Date(turno.inicio_almoco).getTime();
        }
        const minutosAtivo = (agora - inicio - tempoAlmoco) / (1000 * 60);
        const concluidos = contagemServicos[turno.profissional_id] || 0;

        if (minutosAtivo >= limiteMinutos && concluidos === 0) {
          const prof = profileMap[turno.profissional_id];
          resultado.push({
            id: turno.id,
            nome: prof?.nome || 'Sem nome',
            telefone: prof?.telefone || null,
            inicioTurno: turno.inicio_turno,
            minutosAtivo: Math.round(minutosAtivo),
            servicosConcluidos: concluidos,
          });
        }
      }

      return resultado;
    },
    refetchInterval: 60000,
  });

  // Realtime: invalidar ao mudar turnos ou serviços
  useEffect(() => {
    const channel = supabase
      .channel('monitor-improdutividade')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_profissionais' }, () => {
        queryClient.invalidateQueries({ queryKey: ['vistoriadores-improdutivos'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['vistoriadores-improdutivos'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const formatarTempo = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}min ativo`;
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Vistoriadores em Alerta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : vistoriadores.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Todos os vistoriadores ativos estão produtivos.
          </div>
        ) : (
          <div className="space-y-3">
            {vistoriadores.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                      {v.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.nome}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {formatarTempo(v.minutosAtivo)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {v.servicosConcluidos} serviços
                      </span>
                    </div>
                  </div>
                </div>
                {v.telefone && (
                  <a
                    href={`tel:${v.telefone}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    Ligar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
