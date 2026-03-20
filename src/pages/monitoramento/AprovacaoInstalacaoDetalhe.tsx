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
          veiculo:veiculo_id(id, placa, marca, modelo, ano, cor, cobertura_roubo_furto, cobertura_total),
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

      // Checklist - buscar do servico.checklist_json se existir
      const checklist: any[] = [];


      return {
        servico,
        fotos: [...fotos, ...vistoriaFotos],
        rastreador,
        checklist,
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

  const { servico, fotos, rastreador, checklist } = data;
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

  const videoFotos = fotos.filter((f: any) => f.tipo === 'video_360');
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
            <p className="font-medium text-foreground">{veiculo?.ano || '---'}</p>
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

      {/* Vídeo 360 */}
      {videoFotos.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-purple-500" />
              Vídeo 360°
            </CardTitle>
          </CardHeader>
          <CardContent>
            {videoFotos.map((v: any) => (
              <div key={v.id} className="rounded-lg overflow-hidden bg-muted/50 border border-border">
                <video
                  src={v.arquivo_url}
                  controls
                  className="w-full aspect-video object-contain bg-black"
                  preload="metadata"
                  playsInline
                />
              </div>
            ))}
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
