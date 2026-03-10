import { useState } from 'react';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import {
  Car, MapPin, Bot, User, MessageCircle, FileText,
  ExternalLink, CheckCircle, XCircle, Clock, ClipboardCheck,
  ShieldAlert, ShieldX, Flame, CloudRain, Square, HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CardSindicanciaStatus } from '@/components/sinistros/CardSindicanciaStatus';
import { SecaoSindicanciasJuridico } from '@/components/sinistros/SecaoSindicanciasJuridico';
import { SecaoTerceiros } from '@/components/sinistros/SecaoTerceiros';

function resolverUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return supabase.storage.from('sinistros').getPublicUrl(url).data.publicUrl;
}

const tipoConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: ShieldAlert },
  furto: { label: 'Furto', icon: ShieldX },
  incendio: { label: 'Incêndio', icon: Flame },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: CloudRain },
  vidros: { label: 'Vidros', icon: Square },
  outro: { label: 'Outro', icon: HelpCircle },
};

const canalConfig: Record<string, string> = {
  app: 'Aplicativo', whatsapp: 'WhatsApp', telefone: 'Telefone', presencial: 'Presencial',
};

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface SinistroDetalheInfoProps {
  sinistro: any;
  vistoriaEvento: any;
  descricaoCliente: string | null;
  mensagensChat: any[] | null;
  onOpenConversa: () => void;
}

export function SinistroDetalheInfo({ sinistro, vistoriaEvento, descricaoCliente, mensagensChat, onOpenConversa }: SinistroDetalheInfoProps) {
  const [fotoViewerOpen, setFotoViewerOpen] = useState(false);
  const [fotoViewerUrl, setFotoViewerUrl] = useState('');
  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || HelpCircle;

  return (
    <div className="space-y-6">
      {/* Informações do Sinistro */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TipoIcon className="h-5 w-5 text-primary" />
            Informações do Sinistro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</p>
              <div className="flex items-center gap-2 font-medium mt-1">
                <TipoIcon className="h-4 w-4" />
                {tipoConfig[sinistro.tipo]?.label || sinistro.tipo}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data da Ocorrência</p>
              <p className="font-medium mt-1">{formatDateTime(sinistro.data_ocorrencia)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Local</p>
            <div className="flex items-center gap-2 font-medium mt-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {sinistro.local_ocorrencia ? (
                <>{sinistro.local_ocorrencia}{sinistro.cidade_ocorrencia && `, ${sinistro.cidade_ocorrencia}`}{sinistro.estado_ocorrencia && `/${sinistro.estado_ocorrencia}`}</>
              ) : '-'}
            </div>
          </div>

          {sinistro.local_descricao && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição do Local</p>
              <p className="font-medium mt-1">{sinistro.local_descricao}</p>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                <Bot className="h-4 w-4" /> Descrição (Resumo IA)
              </p>
              <div className="bg-muted/50 p-3 rounded-lg mt-1">
                <p className="font-medium whitespace-pre-wrap">{sinistro.descricao || '-'}</p>
              </div>
            </div>

            {descricaoCliente && (
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                  <User className="h-4 w-4" /> Texto Original do Cliente
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg mt-1 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium whitespace-pre-wrap text-blue-900 dark:text-blue-100">{descricaoCliente}</p>
                </div>
              </div>
            )}

            {mensagensChat && mensagensChat.length > 0 && (
              <Button variant="outline" size="sm" onClick={onOpenConversa} className="mt-2">
                <MessageCircle className="h-4 w-4 mr-2" />
                Ver Conversa com IA ({mensagensChat.length} mensagens)
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nº B.O.</p>
              <p className="font-medium mt-1">{sinistro.bo_numero || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canal de Abertura</p>
              <p className="font-medium mt-1">{canalConfig[sinistro.canal] || sinistro.canal}</p>
            </div>
          </div>

          {sinistro.bo_arquivo_url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Arquivo B.O.</p>
              <Button variant="outline" size="sm" asChild>
                <a href={sinistro.bo_arquivo_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Visualizar B.O.
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Valores */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sinistro.valor_fipe && sinistro.valor_fipe > 0 && (
            <div className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classificação do Dano</p>
                  <p className="font-medium mt-1">
                    {sinistro.tipo_dano === 'perda_total' ? 'Perda Total (≥75% do FIPE)' : sinistro.tipo_dano === 'parcial' ? 'Dano Parcial (<75% do FIPE)' : 'Não classificado'}
                  </p>
                </div>
                <Badge variant={sinistro.tipo_dano === 'perda_total' ? 'destructive' : 'secondary'}>
                  {sinistro.tipo_dano === 'perda_total' ? 'Perda Total' : sinistro.tipo_dano === 'parcial' ? 'Parcial' : 'Pendente'}
                </Badge>
              </div>
              {(sinistro.valor_fipe || (sinistro as any).veiculo?.valor_fipe) && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Limite para Dano Parcial: {formatCurrency((sinistro.valor_fipe || (sinistro as any).veiculo?.valor_fipe) * limiteDanoParcial)}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor FIPE</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(sinistro.valor_fipe || (sinistro as any).veiculo?.valor_fipe)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Participação</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency((sinistro as any).valor_cota_participacao || sinistro.valor_participacao)}</p>
              <p className="text-xs text-muted-foreground">Dedutível do associado</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Indenização</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(sinistro.valor_indenizacao)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Pago</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(sinistro.valor_pago)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parecer */}
      {sinistro.parecer && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" /> Parecer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analista</p>
                <p className="font-medium mt-1">{sinistro.analista?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data do Parecer</p>
                <p className="font-medium mt-1">{formatDateTime(sinistro.data_parecer)}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Parecer</p>
              <p className="whitespace-pre-wrap">{sinistro.parecer}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vistoria do Regulador */}
      {(() => {
        const dados = (vistoriaEvento as any)?.dados_vistoria;
        if (!dados) return null;
        const fotosRegulador = (dados.fotos_urls || []) as string[];
        const videoRegulador = dados.video_url as string | undefined;
        const etapas = (dados.etapas_reparo || []) as any[];
        const itens = (dados.itens_orcamento || []) as any[];

        return (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-5 w-5 text-primary" /> Vistoria do Regulador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fotosRegulador.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">📸 Fotos ({fotosRegulador.length})</p>
                  <div className="grid grid-cols-5 gap-2">
                    {fotosRegulador.map((url, i) => (
                      <img key={i} src={resolverUrl(url)} alt={`Foto ${i + 1}`}
                        className="h-20 w-full rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity border"
                        onClick={() => { setFotoViewerUrl(resolverUrl(url)); setFotoViewerOpen(true); }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {videoRegulador && (
                <><Separator /><div>
                  <p className="text-sm font-semibold mb-2">🎬 Vídeo</p>
                  <Button variant="outline" size="sm" onClick={() => window.open(resolverUrl(videoRegulador), '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Assistir
                  </Button>
                </div></>
              )}
              {(dados.tipo_dano || dados.descricao_tecnica) && (
                <><Separator /><div>
                  <p className="text-sm font-semibold mb-2">🔍 Diagnóstico</p>
                  {dados.tipo_dano && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">Tipo:</span>
                      <Badge variant={dados.tipo_dano === 'total' ? 'destructive' : 'default'}>
                        {dados.tipo_dano === 'total' ? 'Perda Total' : 'Parcial'}
                      </Badge>
                    </div>
                  )}
                  {dados.descricao_tecnica && <p className="text-sm mt-1">{dados.descricao_tecnica}</p>}
                </div></>
              )}
              {etapas.length > 0 && (
                <><Separator /><div>
                  <p className="text-sm font-semibold mb-2">🔧 Etapas de Reparo</p>
                  <div className="flex flex-wrap gap-1">
                    {etapas.filter((e: any) => e.selecionada).map((e: any, i: number) => (
                      <Badge key={i} variant="outline">{e.nome}</Badge>
                    ))}
                  </div>
                </div></>
              )}
              {itens.length > 0 && (
                <><Separator /><div>
                  <p className="text-sm font-semibold mb-2">📋 Itens do Orçamento ({itens.length})</p>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted">
                        <th className="text-left p-2 font-medium">Descrição</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-center p-2 font-medium">Qtd</th>
                      </tr></thead>
                      <tbody>{itens.map((item: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{item.descricao}</td>
                          <td className="p-2"><Badge variant="outline" className="text-xs">{item.tipo === 'peca' ? 'Peça' : item.tipo === 'mao_de_obra' ? 'Mão de Obra' : item.tipo}</Badge></td>
                          <td className="p-2 text-center">{item.quantidade}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  {dados.valor_total_orcamento != null && (
                    <p className="text-sm text-muted-foreground mt-2">Custo médio estimado: <strong>{formatCurrency(dados.valor_total_orcamento)}</strong></p>
                  )}
                </div></>
              )}
              {(dados.parecer_tecnico || dados.recomendacao) && (
                <><Separator /><div>
                  <p className="text-sm font-semibold mb-2">📝 Parecer do Regulador</p>
                  {dados.parecer_tecnico && <p className="text-sm whitespace-pre-wrap mb-2">{dados.parecer_tecnico}</p>}
                  {dados.recomendacao && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Recomendação:</span>
                      <Badge variant={dados.recomendacao === 'aprovar' ? 'default' : 'secondary'}>
                        {dados.recomendacao === 'aprovar' ? '✅ Aprovar' : '🔍 Análise Detalhada'}
                      </Badge>
                    </div>
                  )}
                </div></>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Sindicância */}
      <CardSindicanciaStatus
        sinistroId={sinistro.id} protocolo={sinistro.protocolo}
        sindicanteId={sinistro.sindicante_id} prazoFim={sinistro.sindicancia_prazo_fim}
        resultadoSindicancia={sinistro.resultado_sindicancia} status={sinistro.status}
        associadoId={sinistro.associado_id} associadoNome={sinistro.associado?.nome}
      />
      <SecaoSindicanciasJuridico sinistroId={sinistro.id} />

      {/* Terceiros */}
      {sinistro.tipo === 'colisao' && (
        <SecaoTerceiros sinistroId={sinistro.id} associadoId={sinistro.associado_id} placaAssociado={sinistro.veiculo?.placa} />
      )}

      {/* Foto Viewer */}
      <Dialog open={fotoViewerOpen} onOpenChange={setFotoViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          {fotoViewerUrl && <img src={fotoViewerUrl} alt="Foto ampliada" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
