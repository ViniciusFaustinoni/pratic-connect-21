import { useState } from 'react';
import { Car, Wifi, WifiOff, Shield, Camera, FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  useVeiculoCompleto,
  useFotosVistoriaPorVeiculo,
  useDocumentosAssociadoCompleto,
  useEventosVeiculo,
} from '@/hooks/useVeiculoDetalhes';
import { EnriquecerVeiculoButton } from '@/components/cadastro/EnriquecerVeiculoButton';
import { MediaViewerModal } from '@/components/cadastro/MediaViewerModal';
import { formatPlacaExibicao } from '@/lib/placa-utils';

const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR') : '—';

function Field({ label, value, mono, highlight }: { label: string; value: any; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'text-primary font-semibold' : ''}`}>
        {value || value === 0 ? value : '—'}
      </p>
    </div>
  );
}

interface Props {
  veiculoId: string | null | undefined;
}

/**
 * Bloco rico de detalhes do veículo (usado dentro de outros modais como
 * o de Troca de Titularidade). Mostra dados completos do veículo,
 * rastreador, fotos da vistoria, documentos do associado e contagem
 * de eventos. Reaproveita os hooks de useVeiculoDetalhes.
 */
export function VeiculoCompletoCard({ veiculoId }: Props) {
  const { data: completo, isLoading } = useVeiculoCompleto(veiculoId || undefined);
  const { data: fotos } = useFotosVistoriaPorVeiculo(veiculoId || undefined);
  const { data: documentosData } = useDocumentosAssociadoCompleto(completo?.associado?.id);
  const { data: eventos } = useEventosVeiculo(veiculoId || undefined);
  const [mediaIdx, setMediaIdx] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!completo?.veiculo) return <p className="text-sm text-muted-foreground">Veículo não encontrado.</p>;

  const { veiculo, rastreador, contrato } = completo;
  const todosDocumentos = [
    ...(documentosData?.documentos || []),
    ...(documentosData?.documentosCotacao || []),
  ];
  const totalEventos = (eventos?.sinistros?.length || 0) + (eventos?.assistencias?.length || 0);
  const fotosArr = fotos || [];

  const mediaItems = fotosArr.map((f: any) => ({
    url: f.url,
    tipo: f.tipo_foto || 'foto',
    mediaType: 'image' as const,
  }));

  return (
    <div className="space-y-4">
      {/* VEÍCULO */}
      <div className="rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Car className="h-4 w-4" /> Veículo
            <Badge variant="outline" className="font-mono text-xs">{formatPlacaExibicao(veiculo.placa)}</Badge>
          </h4>
          <EnriquecerVeiculoButton veiculo={veiculo as any} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Marca" value={veiculo.marca} />
          <Field label="Modelo" value={veiculo.modelo} />
          <Field label="Ano" value={`${veiculo.ano_fabricacao || '?'}/${veiculo.ano_modelo || '?'}`} />
          <Field label="Cor" value={veiculo.cor} />
          <Field label="Chassi" value={veiculo.chassi} mono />
          <Field label="Renavam" value={veiculo.renavam} />
          <Field label="Combustível" value={veiculo.combustivel} />
          <Field label="Valor FIPE" value={formatCurrency(veiculo.valor_fipe)} highlight />
          <Field label="Status" value={veiculo.status} />
          <Field label="Uso App" value={veiculo.uso_aplicativo ? `Sim - ${veiculo.plataforma_app || ''}` : 'Não'} />
        </div>
      </div>

      {/* RASTREADOR */}
      <div className="rounded border p-3 space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          {rastreador ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          Rastreador
        </h4>
        {rastreador ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Código" value={rastreador.codigo} mono />
            <Field label="IMEI" value={rastreador.imei} mono />
            <Field label="Plataforma" value={rastreador.plataforma} />
            <Field label="Status" value={rastreador.status} />
            <Field label="Última comunicação" value={formatDateTime(rastreador.ultima_comunicacao)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem rastreador instalado.</p>
        )}
      </div>

      {/* CONTRATO ATIVO */}
      {contrato && (
        <div className="rounded border p-3 space-y-2">
          <h4 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Contrato vigente</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Número" value={contrato.numero} mono />
            <Field label="Plano" value={contrato.plano_nome} />
            <Field label="Valor mensal" value={formatCurrency(contrato.valor_mensal)} highlight />
            <Field label="Status" value={contrato.status} />
          </div>
        </div>
      )}

      {/* FOTOS DA VISTORIA */}
      <div className="rounded border p-3 space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <Camera className="h-4 w-4" /> Fotos da vistoria
          {fotosArr.length > 0 && <Badge variant="secondary" className="text-xs">{fotosArr.length}</Badge>}
        </h4>
        {fotosArr.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem fotos de vistoria registradas.</p>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {fotosArr.slice(0, 12).map((f: any, idx: number) => (
              <button
                key={f.id || idx}
                type="button"
                onClick={() => setMediaIdx(idx)}
                className="aspect-square rounded overflow-hidden border hover:ring-2 hover:ring-primary transition"
              >
                <img src={f.url} alt={f.tipo_foto || 'foto'} className="w-full h-full object-cover" />
              </button>
            ))}
            {fotosArr.length > 12 && (
              <div className="aspect-square rounded border flex items-center justify-center text-xs text-muted-foreground">
                +{fotosArr.length - 12}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOCUMENTOS DO ASSOCIADO */}
      <div className="rounded border p-3 space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Documentos do associado
          {todosDocumentos.length > 0 && <Badge variant="secondary" className="text-xs">{todosDocumentos.length}</Badge>}
        </h4>
        {todosDocumentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem documentos anexados.</p>
        ) : (
          <ul className="space-y-1">
            {todosDocumentos.slice(0, 12).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="truncate">{d.tipo_documento || d.tipo || 'documento'}</span>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* EVENTOS RESUMO */}
      {totalEventos > 0 && (
        <div className="rounded border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>{eventos?.sinistros?.length || 0} sinistro(s) e {eventos?.assistencias?.length || 0} assistência(s) no histórico do veículo</span>
          </div>
        </div>
      )}

      {mediaIdx !== null && (
        <MediaViewerModal
          open={mediaIdx !== null}
          onClose={() => setMediaIdx(null)}
          items={mediaItems}
          initialIndex={mediaIdx}
        />
      )}

      <Separator className="opacity-0" />
    </div>
  );
}
