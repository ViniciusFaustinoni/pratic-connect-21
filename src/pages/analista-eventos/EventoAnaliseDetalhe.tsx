import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, User, Car, FileText, Camera, Video, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useEventoAnaliseDetalhe } from '@/hooks/useEventoAnaliseDetalhe';
import { useFotosVistoriaPorVeiculo } from '@/hooks/useVeiculoDetalhes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const MOTIVOS_REPROVACAO = [
  'Documentação insuficiente',
  'Prazo expirado',
  'Irregularidade detectada',
  'Fraude suspeita',
  'Outro',
];

function calcularTempoComunicacao(dataOcorrencia: string, dataComunicacao: string) {
  const inicio = new Date(dataOcorrencia);
  const fim = new Date(dataComunicacao);
  const diffMs = fim.getTime() - inicio.getTime();
  const dias = Math.floor(diffMs / 86400000);
  const horas = Math.floor((diffMs % 86400000) / 3600000);
  const minutos = Math.floor((diffMs % 3600000) / 60000);

  let texto = '';
  if (dias > 0) texto += `${dias} dia${dias > 1 ? 's' : ''}`;
  if (horas > 0) texto += `${texto ? ', ' : ''}${horas} hora${horas > 1 ? 's' : ''}`;
  if (minutos > 0 && dias === 0) texto += `${texto ? ' e ' : ''}${minutos} minuto${minutos > 1 ? 's' : ''}`;

  return { texto: texto || 'Poucos minutos', dias };
}

export default function EventoAnaliseDetalhe() {
  const { id: sinistroId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sinistro, link, vistoria, eventosAnteriores, adimplencia, rastreador, isLoading } = useEventoAnaliseDetalhe(sinistroId);
  const { data: fotosAdesao } = useFotosVistoriaPorVeiculo(sinistro?.veiculo?.id);

  const [showReprovacao, setShowReprovacao] = useState(false);
  const [showAprovacao, setShowAprovacao] = useState(false);
  const [motivoPadrao, setMotivoPadrao] = useState('');
  const [motivoDetalhado, setMotivoDetalhado] = useState('');
  const [observacaoAnalista, setObservacaoAnalista] = useState('');
  const [confirmaAnalise, setConfirmaAnalise] = useState(false);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);

  const analisarMutation = useMutation({
    mutationFn: async (params: { acao: 'aprovar' | 'reprovar'; observacao?: string; motivo?: string; motivo_padrao?: string }) => {
      const { data, error } = await supabase.functions.invoke('analisar-evento', {
        body: { sinistro_id: sinistroId, ...params },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['eventos-aguardando-analise'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-contadores'] });
      toast.success(vars.acao === 'aprovar' ? 'Evento aprovado com sucesso!' : 'Evento reprovado com sucesso!');
      navigate('/analista-eventos/fila');
    },
    onError: (err: any) => {
      toast.error('Erro: ' + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sinistro) {
    return <div className="p-4 text-center text-muted-foreground">Evento não encontrado.</div>;
  }

  const dadosEtapa1 = link?.dados_etapa1 as any;
  const dadosEtapa2 = link?.dados_etapa2 as any;
  const dadosEtapa3 = link?.dados_etapa3 as any;
  const dadosVistoria = vistoria?.dados_vistoria as any;

  const tempoCom = sinistro.data_ocorrencia && sinistro.created_at
    ? calcularTempoComunicacao(sinistro.data_ocorrencia, sinistro.created_at)
    : null;

  const tempoAssociado = sinistro.associado?.created_at
    ? (() => {
        const dias = differenceInDays(new Date(), new Date(sinistro.associado.created_at));
        if (dias >= 365) return `${Math.floor(dias / 365)} ano(s) e ${Math.floor((dias % 365) / 30)} meses`;
        if (dias >= 30) return `${Math.floor(dias / 30)} meses`;
        return `${dias} dias`;
      })()
    : 'N/A';

  const adimplente = adimplencia?.status === 'RECEIVED' || adimplencia?.status === 'CONFIRMED';

  const handleReprovar = () => {
    if (!motivoDetalhado.trim()) {
      toast.error('Preencha o motivo detalhado');
      return;
    }
    analisarMutation.mutate({ acao: 'reprovar', motivo: motivoDetalhado, motivo_padrao: motivoPadrao });
  };

  const handleAprovar = () => {
    if (!confirmaAnalise) {
      toast.error('Confirme que analisou toda a documentação');
      return;
    }
    analisarMutation.mutate({ acao: 'aprovar', observacao: observacaoAnalista });
  };

  const renderFotoGrid = (fotos: string[] | undefined, label: string) => {
    if (!fotos?.length) return <p className="text-sm text-muted-foreground">Nenhuma foto disponível.</p>;
    return (
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${label} ${i + 1}`}
            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80"
            onClick={() => setFotoZoom(url)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold">Análise de Evento</h1>
          <p className="text-xs text-muted-foreground">{sinistro.associado?.nome}</p>
        </div>
        <Badge className="bg-amber-100 text-amber-700" variant="secondary">
          {sinistro.status === 'aguardando_analise' ? 'Aguardando' : sinistro.status}
        </Badge>
      </div>

      <div className="p-4">
        <Accordion type="multiple" defaultValue={['associado', 'cronologia']} className="space-y-2">
          {/* Seção 1 - Dados do Associado */}
          <AccordionItem value="associado" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><User className="h-4 w-4" /> Dados do Associado</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{sinistro.associado?.nome}</span></div>
                <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{sinistro.associado?.cpf}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{sinistro.associado?.telefone}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-xs">{sinistro.associado?.email}</span></div>
                <div><span className="text-muted-foreground">Plano:</span> <span className="font-medium">{sinistro.associado?.plano?.nome || 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{sinistro.associado?.plano?.categoria || 'N/A'}</span></div>
              </div>
              <div className="flex gap-4 pt-2 border-t">
                <Badge variant={adimplente ? 'default' : 'destructive'}>
                  {adimplente ? 'Adimplente' : 'Inadimplente'}
                </Badge>
                <span className="text-xs text-muted-foreground">Associado há {tempoAssociado}</span>
                <span className="text-xs text-muted-foreground">{eventosAnteriores} evento(s) anterior(es)</span>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 2 - Dados do Veículo */}
          <AccordionItem value="veiculo" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Car className="h-4 w-4" /> Dados do Veículo</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Placa:</span> <span className="font-bold">{sinistro.veiculo?.placa}</span></div>
                <div><span className="text-muted-foreground">Marca:</span> <span className="font-medium">{sinistro.veiculo?.marca}</span></div>
                <div><span className="text-muted-foreground">Modelo:</span> <span className="font-medium">{sinistro.veiculo?.modelo}</span></div>
                <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium">{sinistro.veiculo?.ano_modelo}</span></div>
                <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium">{sinistro.veiculo?.cor}</span></div>
                <div><span className="text-muted-foreground">FIPE:</span> <span className="font-bold text-green-600">{sinistro.veiculo?.valor_fipe ? `R$ ${Number(sinistro.veiculo.valor_fipe).toLocaleString('pt-BR')}` : 'N/A'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Chassi:</span> <span className="font-mono text-xs">{sinistro.veiculo?.chassi || 'N/A'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Rastreador:</span> <span className="font-medium">{rastreador?.rastreador ? `${rastreador.rastreador.modelo} (${rastreador.rastreador.numero_serie})` : 'Não instalado'}</span></div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 3 - Cronologia */}
          <AccordionItem value="cronologia" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Cronologia do Evento</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Data do Evento</p>
                <p className="font-medium">{sinistro.data_ocorrencia ? format(new Date(sinistro.data_ocorrencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Data da Comunicação</p>
                <p className="font-medium">{format(new Date(sinistro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              {tempoCom && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Tempo entre evento e comunicação</p>
                  <p className="font-bold">{tempoCom.texto}</p>
                  {tempoCom.dias >= 30 && (
                    <Badge variant="destructive" className="mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" /> PRAZO EXPIRADO — Comunicado após 30 dias
                    </Badge>
                  )}
                  {tempoCom.dias >= 7 && tempoCom.dias < 30 && (
                    <Badge className="mt-1 bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Atenção — Comunicado após 7 dias
                    </Badge>
                  )}
                </div>
              )}
              {link?.etapa3_completada_em && (
                <div>
                  <p className="text-muted-foreground text-xs">Documentação Completa</p>
                  <p className="font-medium">{format(new Date(link.etapa3_completada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
              {vistoria?.concluida_em && (
                <div>
                  <p className="text-muted-foreground text-xs">Vistoria do Regulador</p>
                  <p className="font-medium">{format(new Date(vistoria.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 4 - Relato do Associado */}
          <AccordionItem value="relato" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Relato do Associado</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              {dadosEtapa3?.relato_texto && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Relato Escrito</p>
                  <p className="bg-muted p-3 rounded-lg whitespace-pre-wrap">{dadosEtapa3.relato_texto}</p>
                </div>
              )}
              {(() => {
                const audioUrl = dadosEtapa3?.arquivos_urls?.find((u: string) => 
                  u?.match(/\.(mp3|wav|ogg|webm|m4a)/i) || u?.includes('audio')
                );
                return audioUrl ? (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Áudio Gravado</p>
                    <audio controls className="w-full" src={audioUrl} />
                  </div>
                ) : null;
              })()}
              {(dadosEtapa3?.local_rua || dadosEtapa3?.local_numero) && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Local do Evento</p>
                  <p>{dadosEtapa3?.local_rua}{dadosEtapa3?.local_numero ? `, ${dadosEtapa3.local_numero}` : ''}</p>
                </div>
              )}
              {dadosEtapa3?.houve_terceiro && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Dados do Terceiro</p>
                  <p>Nome: {dadosEtapa3?.terceiro?.nome || 'N/I'}</p>
                  <p>Placa: {dadosEtapa3?.terceiro?.placa || 'N/I'}</p>
                  <p>Telefone: {dadosEtapa3?.terceiro?.telefone || 'N/I'}</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 5 - Boletim de Ocorrência */}
          <AccordionItem value="bo" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Boletim de Ocorrência</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              {dadosEtapa2?.numero_bo && <p><span className="text-muted-foreground">Nº B.O.:</span> <span className="font-medium">{dadosEtapa2.numero_bo}</span></p>}
              {dadosEtapa2?.resumo_bo && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Resumo</p>
                  <p className="bg-muted p-3 rounded-lg">{dadosEtapa2.resumo_bo}</p>
                </div>
              )}
              {dadosEtapa2?.arquivos_urls?.[0] && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Documento</p>
                  {dadosEtapa2.arquivos_urls[0].endsWith('.pdf') ? (
                    <a href={dadosEtapa2.arquivos_urls[0]} target="_blank" rel="noopener noreferrer" className="text-primary underline">Visualizar PDF</a>
                  ) : (
                    <img src={dadosEtapa2.arquivos_urls[0]} alt="B.O." className="max-w-full rounded-lg cursor-pointer" onClick={() => setFotoZoom(dadosEtapa2.arquivos_urls[0])} />
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 6 - Fotos Auto Vistoria */}
          <AccordionItem value="fotos-etapa1" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Camera className="h-4 w-4" /> Fotos da Auto Vistoria (Etapa 1)</span>
            </AccordionTrigger>
            <AccordionContent>
              {renderFotoGrid(dadosEtapa1?.arquivos_urls, 'Auto Vistoria')}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 7 - Vistoria do Regulador */}
          <AccordionItem value="vistoria-regulador" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Camera className="h-4 w-4" /> Vistoria do Regulador</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 text-sm">
              {dadosVistoria?.fotos_urls && renderFotoGrid(dadosVistoria.fotos_urls, 'Regulador')}
              
              {dadosVistoria?.video_url && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Video className="h-3 w-3" /> Vídeo</p>
                  <video controls className="w-full rounded-lg" src={dadosVistoria.video_url} />
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <div><span className="text-muted-foreground">Tipo de Dano:</span> <Badge variant={dadosVistoria?.tipo_dano === 'total' ? 'destructive' : 'secondary'}>{dadosVistoria?.tipo_dano === 'total' ? 'Perda Total' : 'Parcial'}</Badge></div>
                {dadosVistoria?.descricao_tecnica && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Descrição Técnica</p>
                    <p className="bg-muted p-3 rounded-lg">{dadosVistoria.descricao_tecnica}</p>
                  </div>
                )}
              </div>

              {dadosVistoria?.etapas_reparo?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-xs">Etapas de Reparo</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {dadosVistoria.etapas_reparo
                      .filter((e: any) => typeof e === 'object' ? e.selecionada : true)
                      .map((etapa: any, i: number, arr: any[]) => (
                        <span key={i} className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {typeof etapa === 'string' ? etapa : etapa.nome}
                          </Badge>
                          {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {dadosVistoria?.itens_orcamento?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-xs">Orçamento</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">Item</th>
                          <th className="text-left p-2">Tipo</th>
                          <th className="text-right p-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosVistoria.itens_orcamento.map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{item.descricao}</td>
                            <td className="p-2 capitalize">{item.tipo?.replace(/_/g, ' ')}</td>
                            <td className="p-2 text-right">R$ {Number(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-bold">
                        <tr>
                          <td colSpan={2} className="p-2">Total</td>
                          <td className="p-2 text-right">R$ {Number(dadosVistoria.valor_total_orcamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {dadosVistoria?.parecer_tecnico && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Parecer Técnico</p>
                  <p className="bg-muted p-3 rounded-lg">{dadosVistoria.parecer_tecnico}</p>
                </div>
              )}
              {dadosVistoria?.recomendacao && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Recomendação</p>
                  <Badge variant={dadosVistoria.recomendacao === 'aprovar' ? 'default' : 'secondary'}>
                    {dadosVistoria.recomendacao === 'aprovar' ? 'Recomendar Aprovação' : 'Recomendar Análise Detalhada'}
                  </Badge>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 8 - Fotos Vistoria de Adesão */}
          <AccordionItem value="fotos-adesao" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Image className="h-4 w-4" /> Fotos da Vistoria de Adesão</span>
            </AccordionTrigger>
            <AccordionContent>
              {!fotosAdesao?.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma foto da vistoria de adesão encontrada.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {fotosAdesao.map((foto) => (
                    <img
                      key={foto.id}
                      src={foto.arquivo_url}
                      alt={foto.tipo}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={() => setFotoZoom(foto.arquivo_url)}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Barra de ações fixa */}
      {sinistro.status === 'aguardando_analise' && (
        <div className="fixed bottom-16 left-0 right-0 z-50 max-w-md mx-auto bg-background border-t p-4 flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => setShowReprovacao(true)} disabled={analisarMutation.isPending}>
            <XCircle className="h-4 w-4 mr-2" /> Reprovar
          </Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setShowAprovacao(true)} disabled={analisarMutation.isPending}>
            <CheckCircle className="h-4 w-4 mr-2" /> Aprovar
          </Button>
        </div>
      )}

      {/* Modal Reprovação */}
      <Dialog open={showReprovacao} onOpenChange={setShowReprovacao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Evento</DialogTitle>
            <DialogDescription>Informe o motivo da reprovação. O associado será notificado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo Padrão</Label>
              <Select value={motivoPadrao} onValueChange={setMotivoPadrao}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_REPROVACAO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo Detalhado *</Label>
              <Textarea value={motivoDetalhado} onChange={e => setMotivoDetalhado(e.target.value)} placeholder="Descreva o motivo da reprovação..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprovacao(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReprovar} disabled={analisarMutation.isPending}>
              {analisarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Aprovação */}
      <Dialog open={showAprovacao} onOpenChange={setShowAprovacao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Evento</DialogTitle>
            <DialogDescription>Confirme a aprovação do evento. Um novo link será gerado para o associado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <p><span className="text-muted-foreground">Associado:</span> {sinistro.associado?.nome}</p>
              <p><span className="text-muted-foreground">Veículo:</span> {sinistro.veiculo?.placa} - {sinistro.veiculo?.marca} {sinistro.veiculo?.modelo}</p>
              <p><span className="text-muted-foreground">Valor FIPE:</span> R$ {Number(sinistro.veiculo?.valor_fipe || 0).toLocaleString('pt-BR')}</p>
              {sinistro.veiculo?.valor_fipe && (
                <p><span className="text-muted-foreground">Cota Copartic.:</span>{' '}
                  R$ {Math.max(Number(sinistro.veiculo.valor_fipe) * 0.035, 350).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              {dadosVistoria?.valor_total_orcamento && (
                <p><span className="text-muted-foreground">Valor Orçamento:</span> R$ {Number(dadosVistoria.valor_total_orcamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              )}
            </div>
            <div>
              <Label>Observações do Analista (opcional)</Label>
              <Textarea value={observacaoAnalista} onChange={e => setObservacaoAnalista(e.target.value)} placeholder="Observações..." rows={3} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="confirma" checked={confirmaAnalise} onCheckedChange={(v) => setConfirmaAnalise(v === true)} />
              <Label htmlFor="confirma" className="text-xs leading-relaxed cursor-pointer">
                Confirmo que analisei toda a documentação, fotos, vídeo, orçamento e parecer do regulador, e aprovo a entrada deste evento.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAprovacao(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleAprovar} disabled={analisarMutation.isPending || !confirmaAnalise}>
              {analisarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoom foto */}
      <Dialog open={!!fotoZoom} onOpenChange={() => setFotoZoom(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-1">
          <DialogTitle className="sr-only">Visualizar foto</DialogTitle>
          {fotoZoom && <img src={fotoZoom} alt="Zoom" className="w-full h-auto max-h-[90vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
