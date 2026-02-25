import { Navigation, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ComparacaoPosicoes } from '@/components/sinistros/ComparacaoPosicoes';
import { TrajetoColisaoCard } from '@/components/sinistros/TrajetoColisaoCard';
import { TrajetoSinistroCard } from '@/components/sinistros/TrajetoSinistroCard';
import { CardAcionamentoRoubo } from '@/components/sinistros/CardAcionamentoRoubo';
import { AlertasFraudeRoubo } from '@/components/sinistros/AlertasFraudeRoubo';
import { CardRecuperacaoStatus } from '@/components/sinistros/CardRecuperacaoStatus';

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const tiposComRastreador = ['roubo', 'furto', 'colisao', 'colisao_parcial', 'colisao_total'];
const tiposColisao = ['colisao', 'colisao_parcial', 'colisao_total'];

interface SinistroDetalheGPSProps {
  sinistro: any;
  rastreadorVeiculo: any;
  onOpenMapa: () => void;
  onAcionarRecuperacao: () => void;
  onIniciarIndenizacao: () => void;
}

export function SinistroDetalheGPS({
  sinistro, rastreadorVeiculo, onOpenMapa, onAcionarRecuperacao, onIniciarIndenizacao,
}: SinistroDetalheGPSProps) {
  return (
    <div className="space-y-6">
      {/* Botão Localização */}
      {tiposComRastreador.includes(sinistro.tipo) && rastreadorVeiculo && (
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Button onClick={onOpenMapa} className="w-full gap-2" variant="outline">
              <Navigation className="h-4 w-4" /> Abrir Localização do Veículo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Comparação GPS */}
      <ComparacaoPosicoes
        latitudeInformada={sinistro.latitude_informada}
        longitudeInformada={sinistro.longitude_informada}
        rastreadorLat={sinistro.rastreador_lat_momento}
        rastreadorLng={sinistro.rastreador_lng_momento}
        rastreadorCapturadoEm={sinistro.rastreador_posicao_capturada_em}
        localOcorrencia={sinistro.local_ocorrencia}
      />

      {/* Trajeto Colisão */}
      {sinistro.veiculo_id && tiposColisao.includes(sinistro.tipo) && (
        <TrajetoColisaoCard
          veiculoId={sinistro.veiculo_id}
          dataOcorrencia={sinistro.data_ocorrencia}
          localOcorrencia={sinistro.local_ocorrencia}
          sinistroId={sinistro.id}
          snapshotExistente={!!sinistro.snapshot_trajeto_json}
          protocolo={sinistro.protocolo}
          veiculo={sinistro.veiculo}
          associado={sinistro.associado}
        />
      )}

      {/* Trajeto outros tipos */}
      {sinistro.veiculo_id && !tiposColisao.includes(sinistro.tipo) && (
        <TrajetoSinistroCard
          veiculoId={sinistro.veiculo_id}
          dataOcorrencia={sinistro.data_ocorrencia}
          localOcorrencia={sinistro.local_ocorrencia}
          sinistroId={sinistro.id}
          snapshotExistente={!!sinistro.snapshot_trajeto_json}
        />
      )}

      {/* Acionamento Roubo/Furto */}
      {['roubo', 'furto'].includes(sinistro.tipo) && (
        <CardAcionamentoRoubo
          sinistroId={sinistro.id}
          veiculoId={sinistro.veiculo_id}
          veiculoPlaca={sinistro.veiculo?.placa}
          onAcionar={onAcionarRecuperacao}
          podeAcionar={!['encerrado', 'cancelado', 'negado'].includes(sinistro.status)}
        />
      )}

      {/* Alertas Fraude */}
      {['roubo', 'furto'].includes(sinistro.tipo) && sinistro.veiculo_id && (
        <AlertasFraudeRoubo veiculoId={sinistro.veiculo_id} dataOcorrencia={sinistro.data_ocorrencia} />
      )}

      {/* Recuperação */}
      {sinistro.status === 'em_recuperacao' && ['roubo', 'furto'].includes(sinistro.tipo) && (
        <CardRecuperacaoStatus
          sinistroId={sinistro.id} veiculoId={sinistro.veiculo_id}
          dataOcorrencia={sinistro.data_ocorrencia} protocolo={sinistro.protocolo}
          valorFipe={sinistro.valor_fipe}
        />
      )}

      {/* Perda Total / Indenização */}
      {sinistro.tipo_dano === 'perda_total' && ['aprovado', 'aguardando_pagamento'].includes(sinistro.status) && (
        <Card className="border-red-300 dark:border-red-800 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-red-600" /> Perda Total
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="destructive">≥ 75% do FIPE</Badge>
            <p className="text-xs text-muted-foreground">Veículo classificado como perda total.</p>
            {sinistro.status === 'aprovado' && sinistro.veiculo_id && (
              <Button className="w-full" onClick={onIniciarIndenizacao}>
                <DollarSign className="h-4 w-4 mr-2" /> Iniciar Indenização
              </Button>
            )}
            {(sinistro.status as string) === 'aguardando_pagamento' && (
              <Badge className="bg-pink-100 text-pink-800"><Clock className="h-3 w-3 mr-1" />Aguardando Pagamento</Badge>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
