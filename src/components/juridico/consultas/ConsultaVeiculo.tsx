import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, User, History, Camera } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useFotosVistoriaPorVeiculo } from '@/hooks/useVeiculoDetalhes';

interface Props {
  veiculoId: string;
}

export default function ConsultaVeiculo({ veiculoId }: Props) {
  const { data: veiculo, isLoading } = useQuery({
    queryKey: ['consulta-veiculo', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('*, associado:associados(id, nome, cpf, status)')
        .eq('id', veiculoId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sinistros = [] } = useQuery({
    queryKey: ['consulta-veiculo-sinistros', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, tipo, status, data_ocorrencia')
        .eq('veiculo_id', veiculoId)
        .order('data_ocorrencia', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: fotosAdesao } = useFotosVistoriaPorVeiculo(veiculoId);

  const eventosRecentes = sinistros.filter((s: any) => s.data_ocorrencia && s.data_ocorrencia >= subMonths(new Date(), 24).toISOString());
  const muitosEventos = eventosRecentes.length > 3;

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!veiculo) return <p className="text-muted-foreground text-center py-8">Veículo não encontrado.</p>;

  return (
    <div className="space-y-4">
      {muitosEventos && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">⚠️ {eventosRecentes.length} eventos nos últimos 24 meses.</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4" /> Dados do Veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">Placa:</span> <strong>{veiculo.placa}</strong></div>
            <div><span className="text-muted-foreground">Marca/Modelo:</span> {veiculo.marca} {veiculo.modelo}</div>
            <div><span className="text-muted-foreground">Ano:</span> {veiculo.ano_fabricacao}/{veiculo.ano_modelo}</div>
            <div><span className="text-muted-foreground">Cor:</span> {veiculo.cor || '-'}</div>
            <div><span className="text-muted-foreground">Chassi:</span> {veiculo.chassi || '-'}</div>
            <div><span className="text-muted-foreground">RENAVAM:</span> {veiculo.renavam || '-'}</div>
            <div><span className="text-muted-foreground">FIPE:</span> {veiculo.valor_fipe ? `R$ ${Number(veiculo.valor_fipe).toLocaleString('pt-BR')}` : '-'}</div>
            <div><span className="text-muted-foreground">Combustível:</span> {veiculo.combustivel || '-'}</div>
            <div><span className="text-muted-foreground">Uso app:</span> {veiculo.uso_aplicativo ? 'Sim' : 'Não'}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{veiculo.status || 'ativo'}</Badge></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Proprietário Atual</CardTitle>
        </CardHeader>
        <CardContent>
          {veiculo.associado ? (
            <div className="text-sm grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Nome:</span> <strong>{(veiculo.associado as any).nome}</strong></div>
              <div><span className="text-muted-foreground">CPF:</span> {(veiculo.associado as any).cpf}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{(veiculo.associado as any).status}</Badge></div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sem associado vinculado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Eventos ({sinistros.length})</CardTitle>
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

      {fotosAdesao && (fotosAdesao as any[]).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Vistoria de Adesão ({(fotosAdesao as any[]).length} fotos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {(fotosAdesao as any[]).slice(0, 10).map((f: any, i: number) => (
                <img key={i} src={f.url || f.foto_url} alt={f.tipo || 'Foto'} className="rounded border object-cover aspect-square w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
