import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Car,
  Cpu,
  Camera,
  Video,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
  FileText,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  useAprovarInstalacaoMonitoramento,
  useReprovarInstalacaoMonitoramento,
} from '@/hooks/useAprovacaoMonitoramento';

// Hook para buscar detalhes completos do serviço
function useServicoDetalheAprovacao(servicoId: string | undefined) {
  return useQuery({
    queryKey: ['servico-detalhe-aprovacao', servicoId],
    queryFn: async () => {
      if (!servicoId) throw new Error('ID não fornecido');

      // Buscar serviço com joins
      const { data: servico, error } = await supabase
        .from('servicos')
        .select(`
          *,
          profissional:profissional_id(id, nome),
          veiculo:veiculo_id(id, placa, marca, modelo, ano_modelo, cor, cobertura_roubo_furto, cobertura_total),
          associado:associado_id(id, nome, cpf, telefone, email, whatsapp, status)
        `)
        .eq('id', servicoId)
        .single();

      if (error) throw error;

      // Buscar fotos da instalação
      let fotos: any[] = [];
      if (servico.instalacao_origem_id) {
        const { data: fotosData } = await supabase
          .from('instalacao_fotos')
          .select('*')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .order('created_at');
        fotos = fotosData || [];
      }

      // Buscar fotos de vistoria (via vistoria_origem_id ou instalacao)
      let vistoriaFotos: any[] = [];
      if (servico.vistoria_origem_id) {
        const { data: vfData } = await supabase
          .from('vistoria_fotos')
          .select('*')
          .eq('vistoria_id', servico.vistoria_origem_id)
          .order('created_at');
        vistoriaFotos = vfData || [];
      } else if (servico.instalacao_origem_id) {
        // Buscar vistoria vinculada à instalação
        const { data: vistoria } = await supabase
          .from('vistorias')
          .select('id')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .maybeSingle();
        if (vistoria?.id) {
          const { data: vfData } = await supabase
            .from('vistoria_fotos')
            .select('*')
            .eq('vistoria_id', vistoria.id)
            .order('created_at');
          vistoriaFotos = vfData || [];
        }
      }

      // Buscar rastreador vinculado
      let rastreador: any = null;
      if (servico.veiculo_id) {
        const { data: rData } = await supabase
          .from('rastreadores')
          .select('*')
          .eq('veiculo_id', servico.veiculo_id)
          .eq('status', 'instalado')
          .maybeSingle();
        rastreador = rData;
      }

      // Buscar documentos do associado
      let documentos: any[] = [];
      if (servico.associado_id) {
        const { data: docsData } = await supabase
          .from('documentos')
          .select('*')
          .eq('associado_id', servico.associado_id)
          .order('created_at', { ascending: false });
        documentos = docsData || [];
      }

      // Buscar vídeo 360° do instalador (da vistoria vinculada ao serviço)
      let videoInstalador: string | null = null;
      if (servico.vistoria_origem_id) {
        const { data: vistoriaInst } = await supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('id', servico.vistoria_origem_id)
          .maybeSingle();
        videoInstalador = vistoriaInst?.video_360_url || null;
      } else if (servico.instalacao_origem_id) {
        const { data: vistoriaInst } = await supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .maybeSingle();
        videoInstalador = vistoriaInst?.video_360_url || null;
      }

      // Buscar vídeo 360° do associado (autovistoria não presencial do mesmo contrato)
      let videoAssociado: string | null = null;
      if (servico.contrato_id) {
        const { data: autoVistoria } = await supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('contrato_id', servico.contrato_id)
          .neq('modalidade', 'presencial')
          .not('video_360_url', 'is', null)
          .maybeSingle();
        videoAssociado = autoVistoria?.video_360_url || null;
      }

      // Checklist
      const checklist: any[] = [];

      return {
        servico,
        fotos: [...fotos, ...vistoriaFotos],
        rastreador,
        checklist,
        documentos,
        videoInstalador,
        videoAssociado,
      };
    },
    enabled: !!servicoId,
  });
}

const fotoLabels: Record<string, string> = {
  frente_veiculo: 'Frente do Veículo',
  traseira_veiculo: 'Traseira do Veículo',
  placa_veiculo: 'Placa',
  local_rastreador: 'Local do Rastreador',
  hodometro: 'Hodômetro',
  lateral_esquerda: 'Lateral Esquerda',
  lateral_direita: 'Lateral Direita',
  avarias: 'Avarias',
  interior: 'Interior',
  assinatura_cliente: 'Assinatura do Cliente',
  video_360: 'Vídeo 360°',
};

export default function AprovacaoInstalacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useServicoDetalheAprovacao(id);
  const aprovar = useAprovarInstalacaoMonitoramento();
  const reprovar = useReprovarInstalacaoMonitoramento();

  const [showReprovar, setShowReprovar] = useState(false);
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [observacoesAprovacao, setObservacoesAprovacao] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Serviço não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const { servico, fotos, rastreador, checklist, documentos, videoInstalador, videoAssociado } = data;
  const associado = servico.associado as any;
  const veiculo = servico.veiculo as any;
  const profissional = servico.profissional as any;

  const handleAprovar = () => {
    aprovar.mutate({
      servicoId: servico.id,
      veiculoId: veiculo.id,
      associadoId: associado.id,
      observacoes: observacoesAprovacao || undefined,
    }, {
      onSuccess: () => navigate('/monitoramento/aprovacao-associados'),
    });
  };

  const handleReprovar = () => {
    if (!motivoReprovar.trim()) return;
    reprovar.mutate({
      servicoId: servico.id,
      veiculoId: veiculo.id,
      associadoId: associado.id,
      motivo: motivoReprovar,
    }, {
      onSuccess: () => {
        setShowReprovar(false);
        navigate('/monitoramento/aprovacao-associados');
      },
    });
  };

  const imageFotos = fotos.filter((f: any) => f.tipo !== 'video_360');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Análise de Instalação
          </h1>
          <p className="text-sm text-muted-foreground">
            Revisar dados antes de ativar a Proteção 360
          </p>
        </div>
      </div>

      {/* Dados do Associado */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Associado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Nome</span>
            <p className="font-medium text-foreground">{associado?.nome || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">CPF</span>
            <p className="font-medium text-foreground">{associado?.cpf || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Telefone</span>
            <p className="font-medium text-foreground">{associado?.telefone || associado?.whatsapp || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <Badge variant="outline" className="text-xs">{associado?.status || '---'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Veículo */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-4 w-4 text-primary" />
            Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Placa</span>
            <p className="font-mono font-bold text-foreground">{veiculo?.placa || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Veículo</span>
            <p className="font-medium text-foreground">{veiculo?.marca} {veiculo?.modelo}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Ano</span>
            <p className="font-medium text-foreground">{veiculo?.ano_modelo || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Instalador</span>
            <p className="font-medium text-foreground">{profissional?.nome || '---'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Rastreador */}
      {rastreador && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-primary" />
              Rastreador Instalado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">IMEI</span>
              <p className="font-mono font-medium text-foreground">{rastreador.imei || '---'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Código</span>
              <p className="font-medium text-foreground">{rastreador.codigo || '---'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Plataforma</span>
              <Badge variant="outline" className="text-xs">{rastreador.plataforma || '---'}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Local Instalação</span>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <p className="font-medium text-foreground">{rastreador.local_instalacao || 'Não informado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentação do Associado */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Documentação do Associado ({documentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <AlertTriangle className="h-4 w-4" />
              <span>Nenhum documento enviado pelo associado</span>
            </div>
          ) : (
            <>
              {documentos.some((d: any) => d.status === 'pendente' || d.status === 'reprovado') && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Existem documentos{' '}
                    {documentos.filter((d: any) => d.status === 'pendente').length > 0 && 'pendentes'}
                    {documentos.filter((d: any) => d.status === 'pendente').length > 0 && documentos.filter((d: any) => d.status === 'reprovado').length > 0 && ' e '}
                    {documentos.filter((d: any) => d.status === 'reprovado').length > 0 && 'reprovados'}
                    {' '}que precisam de atenção.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {documentos.map((doc: any) => {
                  const isImage = doc.arquivo_url?.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
                  const tipoLabel: Record<string, string> = {
                    cnh: 'CNH',
                    crlv: 'CRLV',
                    comprovante_residencia: 'Comprovante Residência',
                    selfie_documento: 'Selfie c/ Documento',
                    contrato_assinado: 'Contrato Assinado',
                    laudo_vistoria: 'Laudo Vistoria',
                    foto_veiculo_frente: 'Frente Veículo',
                    foto_veiculo_traseira: 'Traseira Veículo',
                    foto_veiculo_lateral_esquerda: 'Lateral Esquerda',
                    foto_veiculo_lateral_direita: 'Lateral Direita',
                    foto_hodometro: 'Hodômetro',
                    foto_chassi: 'Chassi',
                  };
                  const statusConfig: Record<string, { class: string; label: string }> = {
                    aprovado: { class: 'bg-success/15 text-success border-success/30', label: 'Aprovado' },
                    pendente: { class: 'bg-warning/15 text-warning border-warning/30', label: 'Pendente' },
                    em_analise: { class: 'bg-primary/15 text-primary border-primary/30', label: 'Em análise' },
                    reprovado: { class: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Reprovado' },
                  };
                  const st = statusConfig[doc.status] || statusConfig.pendente;

                  return (
                    <div
                      key={doc.id}
                      className="group relative rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                      onClick={() => {
                        if (isImage) {
                          setSelectedImage(doc.arquivo_url);
                        } else {
                          window.open(doc.arquivo_url, '_blank');
                        }
                      }}
                    >
                      <div className="aspect-square bg-muted/30 flex items-center justify-center">
                        {isImage ? (
                          <img
                            src={doc.arquivo_url}
                            alt={tipoLabel[doc.tipo] || doc.tipo}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileText className="h-8 w-8" />
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {tipoLabel[doc.tipo] || doc.tipo || 'Documento'}
                        </p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.class}`}>
                          {st.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Checklist */}
      {checklist.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Checklist ({checklist.filter((c: any) => c.concluido).length}/{checklist.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklist.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30"
                >
                  {item.concluido ? (
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className="text-foreground">{item.descricao}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Fotos da Instalação ({imageFotos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {imageFotos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma foto disponível</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imageFotos.map((foto: any) => (
                <div
                  key={foto.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setSelectedImage(foto.arquivo_url)}
                >
                  <img
                    src={foto.arquivo_url}
                    alt={fotoLabels[foto.tipo] || foto.tipo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-[10px] font-medium">
                      {fotoLabels[foto.tipo] || foto.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vídeos 360° */}
      {(videoInstalador || videoAssociado) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-purple-500" />
              Vídeos 360°
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoInstalador && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                    Instalador
                  </Badge>
                  <span className="text-xs text-muted-foreground">Gravado pelo vistoriador durante a instalação</span>
                </div>
                <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
                  <video
                    src={videoInstalador}
                    controls
                    className="w-full aspect-video object-contain bg-black"
                    preload="metadata"
                    playsInline
                  />
                </div>
              </div>
            )}
            {videoAssociado && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                    Associado
                  </Badge>
                  <span className="text-xs text-muted-foreground">Autovistoria gravada pelo associado</span>
                </div>
                <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
                  <video
                    src={videoAssociado}
                    controls
                    className="w-full aspect-video object-contain bg-black"
                    preload="metadata"
                    playsInline
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Observações de aprovação */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observações sobre a análise..."
            value={observacoesAprovacao}
            onChange={(e) => setObservacoesAprovacao(e.target.value)}
            className="bg-muted/30 border-border"
          />
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-3 pb-8">
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => setShowReprovar(true)}
          disabled={aprovar.isPending || reprovar.isPending}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reprovar
        </Button>
        <Button
          className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
          onClick={handleAprovar}
          disabled={aprovar.isPending || reprovar.isPending}
        >
          {aprovar.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Aprovar — Ativar Proteção 360
        </Button>
      </div>

      {/* Dialog Reprovar */}
      <Dialog open={showReprovar} onOpenChange={setShowReprovar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Instalação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da reprovação..."
            value={motivoReprovar}
            onChange={(e) => setMotivoReprovar(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprovar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReprovar}
              disabled={!motivoReprovar.trim() || reprovar.isPending}
            >
              {reprovar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-1">
          {selectedImage && (
            <img src={selectedImage} alt="Foto ampliada" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
