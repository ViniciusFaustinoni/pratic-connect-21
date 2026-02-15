import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, DollarSign, FileText, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  eventoId: string;
}

const TIMELINE_STEPS = [
  { key: 'data_ocorrencia', label: 'Evento' },
  { key: 'created_at', label: 'Abertura' },
  { key: 'documentacao_completa', label: 'Documentação' },
  { key: 'data_aprovacao', label: 'Aprovação' },
  { key: 'data_conclusao', label: 'Conclusão' },
];

export default function ConsultaEvento({ eventoId }: Props) {
  const { data: sinistro, isLoading } = useQuery({
    queryKey: ['consulta-evento', eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('*, associado:associados(id, nome, cpf), veiculo:veiculos(id, placa, marca, modelo)')
        .eq('id', eventoId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ['consulta-evento-processos', eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, tipo, status')
        .eq('sinistro_id', eventoId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventoId,
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!sinistro) return <p className="text-muted-foreground text-center py-8">Evento não encontrado.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{sinistro.protocolo} — {sinistro.tipo}</CardTitle>
            <Badge variant="outline">{sinistro.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Associado:</span> {(sinistro as any).associado?.nome || '-'}</div>
            <div><span className="text-muted-foreground">Veículo:</span> {(sinistro as any).veiculo?.placa || '-'} {(sinistro as any).veiculo?.marca} {(sinistro as any).veiculo?.modelo}</div>
            <div><span className="text-muted-foreground">Data evento:</span> {sinistro.data_ocorrencia ? format(new Date(sinistro.data_ocorrencia), 'dd/MM/yyyy') : '-'}</div>
            <div><span className="text-muted-foreground">Abertura:</span> {format(new Date(sinistro.created_at), 'dd/MM/yyyy')}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline do Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TIMELINE_STEPS.map(step => {
              const value = (sinistro as any)[step.key];
              const completed = !!value;
              return (
                <div key={step.key} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${completed ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                  {completed && <CheckCircle className="h-3 w-3" />}
                  {step.label}
                  {completed && typeof value === 'string' && <span className="ml-1 opacity-70">{format(new Date(value), 'dd/MM')}</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Valores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">FIPE:</span> <strong>{sinistro.valor_fipe ? `R$ ${Number(sinistro.valor_fipe).toLocaleString('pt-BR')}` : '-'}</strong></div>
            <div><span className="text-muted-foreground">Participação:</span> {sinistro.valor_participacao ? `R$ ${Number(sinistro.valor_participacao).toLocaleString('pt-BR')}` : '-'}</div>
            <div><span className="text-muted-foreground">Indenização:</span> {sinistro.valor_indenizacao ? `R$ ${Number(sinistro.valor_indenizacao).toLocaleString('pt-BR')}` : '-'}</div>
            <div><span className="text-muted-foreground">Pago:</span> {sinistro.valor_pago ? `R$ ${Number(sinistro.valor_pago).toLocaleString('pt-BR')}` : '-'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Processos Vinculados ({processos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {processos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum processo vinculado.</p>
          ) : (
            <div className="space-y-2">
              {processos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div><strong>{p.numero}</strong> — {p.tipo}</div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
