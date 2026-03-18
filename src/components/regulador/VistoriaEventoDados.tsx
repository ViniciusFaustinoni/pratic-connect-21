import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, User, Car, FileText, AlertTriangle, Play, ExternalLink, Image as ImageIcon, File } from 'lucide-react';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { cn } from '@/lib/utils';

const TIPO_DOC_LABELS: Record<string, string> = {
  crlv: 'CRLV - Documento do Veículo',
  laudo_vistoria: 'Laudo de Vistoria',
  cnh: 'CNH',
  comprovante_residencia: 'Comprovante de Residência',
  selfie_documento: 'Selfie com Documento',
  contrato_assinado: 'Contrato Assinado',
  foto_veiculo_frente: 'Foto Frente',
  foto_veiculo_traseira: 'Foto Traseira',
  foto_veiculo_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_veiculo_lateral_direita: 'Foto Lateral Direita',
  foto_hodometro: 'Hodômetro',
  foto_chassi: 'Chassi',
};

const STATUS_DOC_COLORS: Record<string, string> = {
  aprovado: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  reprovado: 'bg-red-100 text-red-700',
};

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
}

interface VistoriaEventoDadosProps {
  associado: any;
  veiculo: any;
  sinistro: any;
  linkEvento: any;
  documentosVeiculo?: any[];
}

function calcularTempoEntre(dataEvento: string, dataComunicacao: string): string {
  const evento = new Date(dataEvento);
  const comunicacao = new Date(dataComunicacao);
  const diffMs = comunicacao.getTime() - evento.getTime();
  if (diffMs < 0) return 'Comunicado antes do evento';

  const totalMinutos = Math.floor(diffMs / (1000 * 60));
  const totalHoras = Math.floor(totalMinutos / 60);
  const dias = Math.floor(totalHoras / 24);
  const horas = totalHoras % 24;
  const minutos = totalMinutos % 60;

  if (totalMinutos < 60) return `${totalMinutos} minutos após`;
  if (totalHoras < 24) return `${totalHoras} horas após`;
  return `${dias} dia${dias > 1 ? 's' : ''} e ${horas} hora${horas !== 1 ? 's' : ''} após`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SectionCollapsible({ title, icon: Icon, defaultOpen = false, children }: { title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-2 pb-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function VistoriaEventoDados({ associado, veiculo, sinistro, linkEvento, documentosVeiculo = [] }: VistoriaEventoDadosProps) {
  const [fotoViewer, setFotoViewer] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const dadosEtapa1 = linkEvento?.dados_etapa1 as any;
  const dadosEtapa2 = linkEvento?.dados_etapa2 as any;
  const dadosEtapa3 = linkEvento?.dados_etapa3 as any;

  // Fotos da auto vistoria
  const fotosAutoVistoria: { url: string; label: string }[] = [];
  if (dadosEtapa1?.fotos_urls) {
    (dadosEtapa1.fotos_urls as string[]).forEach((url: string, i: number) => {
      fotosAutoVistoria.push({ url, label: `Foto ${i + 1}` });
    });
  }

  const tempoEntre = sinistro?.data_ocorrencia && sinistro?.created_at
    ? calcularTempoEntre(sinistro.data_ocorrencia, sinistro.created_at)
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dados do Evento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Associado */}
        <SectionCollapsible title="Associado" icon={User} defaultOpen>
          <InfoRow label="Nome" value={associado?.nome} />
          <InfoRow label="CPF" value={associado?.cpf} />
          <InfoRow label="Telefone" value={associado?.telefone} />
          <InfoRow label="E-mail" value={associado?.email} />
          <InfoRow label="Plano" value={associado?.plano?.nome} />
          <InfoRow label="Categoria" value={associado?.plano?.categoria} />
          <InfoRow label="Adimplência" value={
            associado?.adimplente === null ? '—' :
            associado?.adimplente ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Em dia</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Inadimplente</Badge>
            )
          } />
        </SectionCollapsible>

        {/* Veículo */}
        <SectionCollapsible title="Veículo" icon={Car}>
          <InfoRow label="Placa" value={veiculo?.placa} />
          <InfoRow label="Marca" value={veiculo?.marca} />
          <InfoRow label="Modelo" value={veiculo?.modelo} />
          <InfoRow label="Ano" value={veiculo?.ano_modelo} />
          <InfoRow label="Cor" value={veiculo?.cor} />
          <InfoRow label="Chassi" value={veiculo?.chassi} />
          <InfoRow label="Valor FIPE" value={veiculo?.valor_fipe ? `R$ ${Number(veiculo.valor_fipe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'} />
        </SectionCollapsible>

        {/* Evento */}
        <SectionCollapsible title="Evento" icon={AlertTriangle}>
          <InfoRow label="Tipo" value={sinistro?.tipo?.replace(/_/g, ' ') || 'Evento'} />
          <InfoRow label="Data/hora evento" value={sinistro?.data_ocorrencia ? new Date(sinistro.data_ocorrencia).toLocaleString('pt-BR') : '—'} />
          <InfoRow label="Data/hora comunicação" value={sinistro?.created_at ? new Date(sinistro.created_at).toLocaleString('pt-BR') : '—'} />
          {tempoEntre && (
            <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-400 mt-1">
              ⏱ O associado comunicou o evento <strong>{tempoEntre}</strong>
            </div>
          )}
          {sinistro?.descricao && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Relato do associado:</p>
              <p className="text-sm bg-muted/50 rounded p-2">{sinistro.descricao}</p>
            </div>
          )}
          {dadosEtapa3?.audio_url && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Áudio do associado:</p>
              <audio controls src={dadosEtapa3.audio_url} className="w-full h-10" />
            </div>
          )}
          {sinistro?.local_descricao && (
            <InfoRow label="Local" value={`${sinistro.local_descricao}${sinistro.cidade_ocorrencia ? ` — ${sinistro.cidade_ocorrencia}` : ''}${sinistro.estado_ocorrencia ? `/${sinistro.estado_ocorrencia}` : ''}`} />
          )}
          {dadosEtapa3?.terceiro_envolvido && (
            <div className="mt-2 border-t pt-2">
              <p className="text-xs font-semibold mb-1">Terceiro envolvido:</p>
              <InfoRow label="Nome" value={dadosEtapa3.terceiro_nome} />
              <InfoRow label="Placa" value={dadosEtapa3.terceiro_placa} />
              <InfoRow label="Telefone" value={dadosEtapa3.terceiro_telefone} />
              <InfoRow label="Seguradora" value={dadosEtapa3.terceiro_seguradora} />
            </div>
          )}
        </SectionCollapsible>

        {/* Documentos */}
        <SectionCollapsible title="Documentos" icon={FileText}>
          {/* Fotos auto vistoria */}
          {fotosAutoVistoria.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fotos da auto vistoria ({fotosAutoVistoria.length}):</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
                {fotosAutoVistoria.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setFotoViewer({ open: true, index: i })}
                    className="aspect-square overflow-hidden rounded border hover:opacity-80 transition"
                  >
                    <img src={f.url} alt={f.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* B.O. */}
          {dadosEtapa2?.numero_bo && (
            <InfoRow label="Nº do B.O." value={dadosEtapa2.numero_bo} />
          )}
          {dadosEtapa2?.resumo_bo && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Resumo do B.O.:</p>
              <p className="text-sm bg-muted/50 rounded p-2">{dadosEtapa2.resumo_bo}</p>
            </div>
          )}
          {dadosEtapa2?.bo_url && (
            <div className="mt-2">
              <a
                href={dadosEtapa2.bo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Visualizar B.O.
              </a>
            </div>
          )}

          {/* Documentos do veículo/associado */}
          {documentosVeiculo.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Documentos ({documentosVeiculo.length}):</p>
              <div className="space-y-2">
                {documentosVeiculo.map((doc: any) => {
                  const label = TIPO_DOC_LABELS[doc.tipo] || doc.nome_arquivo || doc.tipo || 'Documento';
                  const statusClass = STATUS_DOC_COLORS[doc.status] || 'bg-muted text-muted-foreground';
                  const isImg = doc.arquivo_url && isImageUrl(doc.arquivo_url);

                  return (
                    <a
                      key={doc.id}
                      href={doc.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50 transition"
                    >
                      {isImg ? (
                        <img src={doc.arquivo_url} alt={label} className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <File className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        {doc.status && (
                          <Badge variant="secondary" className={cn('text-[10px] mt-0.5', statusClass)}>
                            {doc.status}
                          </Badge>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCollapsible>

        {/* Foto Viewer */}
        <VisualizadorFoto
          fotos={fotosAutoVistoria}
          indexInicial={fotoViewer.index}
          open={fotoViewer.open}
          onClose={() => setFotoViewer({ open: false, index: 0 })}
        />
      </CardContent>
    </Card>
  );
}
