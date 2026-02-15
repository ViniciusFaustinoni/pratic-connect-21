import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, User, Car, FileText, DollarSign } from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface Props {
  associadoId: string;
}

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-green-100 text-green-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  cancelado: 'bg-red-100 text-red-800',
  inadimplente: 'bg-orange-100 text-orange-800',
  em_adesao: 'bg-blue-100 text-blue-800',
  bloqueado: 'bg-red-100 text-red-800',
};

export default function ConsultaAssociado({ associadoId }: Props) {
  const { data: associado, isLoading: loadingAssociado } = useQuery({
    queryKey: ['consulta-associado', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('*, plano:planos(id, nome)')
        .eq('id', associadoId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['consulta-veiculos', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sinistros = [] } = useQuery({
    queryKey: ['consulta-sinistros', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, tipo, status, data_ocorrencia, created_at')
        .eq('associado_id', associadoId)
        .order('data_ocorrencia', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ['consulta-processos', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, tipo, status, advogado:advogados(nome)')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: financeiro } = useQuery({
    queryKey: ['consulta-financeiro', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select('id, valor, status, data_vencimento')
        .eq('associado_id', associadoId)
        .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue', 'vencida', 'aberta']);
      if (error) throw error;
      const total = (data || []).reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
      const atrasados = (data || []).filter((c: any) => ['OVERDUE', 'overdue', 'vencida'].includes(c.status));
      return {
        totalAberto: total,
        qtdAtrasados: atrasados.length,
        valorAtrasado: atrasados.reduce((acc: number, c: any) => acc + (c.valor || 0), 0),
        adimplente: atrasados.length === 0,
      };
    },
  });

  const limite24m = subMonths(new Date(), 24).toISOString();
  const eventosRecentes = sinistros.filter((s: any) => s.data_ocorrencia && s.data_ocorrencia >= limite24m);
  const historicoFrequente = eventosRecentes.length > 3;

  if (loadingAssociado) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  if (!associado) {
    return <p className="text-muted-foreground text-center py-8">Associado não encontrado.</p>;
  }

  return (
    <div className="space-y-4">
      {historicoFrequente && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">⚠️ Histórico frequente — {eventosRecentes.length} eventos nos últimos 24 meses.</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">Nome:</span> <strong>{associado.nome}</strong></div>
            <div><span className="text-muted-foreground">CPF:</span> {associado.cpf}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {associado.telefone || '-'}</div>
            <div><span className="text-muted-foreground">Email:</span> {associado.email || '-'}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[associado.status] || 'bg-muted text-muted-foreground'}>{associado.status}</Badge></div>
            <div><span className="text-muted-foreground">Desde:</span> {associado.data_adesao ? format(new Date(associado.data_adesao), 'dd/MM/yyyy') : '-'}</div>
            <div><span className="text-muted-foreground">Plano:</span> {(associado as any).plano?.nome || '-'}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {[associado.logradouro, associado.numero, associado.bairro, associado.cidade, associado.uf].filter(Boolean).join(', ') || '-'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4" /> Veículos ({veiculos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {veiculos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum veículo encontrado.</p>
          ) : (
            <div className="space-y-2">
              {veiculos.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <strong>{v.placa}</strong> — {v.marca} {v.modelo} {v.ano_modelo}
                    {v.valor_fipe && <span className="text-muted-foreground ml-2">FIPE: R$ {Number(v.valor_fipe).toLocaleString('pt-BR')}</span>}
                  </div>
                  <Badge variant="outline">{v.status || 'ativo'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Histórico de Eventos ({sinistros.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sinistros.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum evento encontrado.</p>
          ) : (
            <div className="space-y-2">
              {sinistros.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <strong>{s.protocolo}</strong> — {s.tipo}
                    {s.data_ocorrencia && <span className="text-muted-foreground ml-2">{format(new Date(s.data_ocorrencia), 'dd/MM/yyyy')}</span>}
                  </div>
                  <Badge variant="outline">{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Processos Jurídicos ({processos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {processos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum processo jurídico encontrado.</p>
          ) : (
            <div className="space-y-2">
              {processos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <strong>{p.numero}</strong> — {p.tipo}
                    {p.advogado?.nome && <span className="text-muted-foreground ml-2">Adv: {p.advogado.nome}</span>}
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Situação Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          {financeiro ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Situação:</span>{' '}
                <Badge className={financeiro.adimplente ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}>
                  {financeiro.adimplente ? 'Adimplente' : 'Inadimplente'}
                </Badge>
              </div>
              <div><span className="text-muted-foreground">Total em aberto:</span> <strong>R$ {financeiro.totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div><span className="text-muted-foreground">Boletos atrasados:</span> <strong>{financeiro.qtdAtrasados}</strong></div>
              <div><span className="text-muted-foreground">Valor atrasado:</span> <strong className="text-destructive">R$ {financeiro.valorAtrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
