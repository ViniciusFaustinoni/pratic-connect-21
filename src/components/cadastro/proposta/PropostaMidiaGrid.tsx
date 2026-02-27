import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Video,
  Camera,
  PenTool,
  Play,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VistoriaFotoInfo } from '@/hooks/usePropostasPendentes';
import { DocumentosSolicitadosCard, type DocumentoSolicitadoEnviado } from '@/components/cadastro/DocumentosSolicitadosCard';

interface PropostaMidiaGridProps {
  video360Url?: string | null;
  fotos: VistoriaFotoInfo[];
  assinaturaUrl?: string | null;
  assinaturaData?: string | null;
  assinaturaPor?: string | null;
  documentosSolicitados?: DocumentoSolicitadoEnviado[];
}

export function PropostaMidiaGrid({
  video360Url,
  fotos,
  assinaturaUrl,
  assinaturaData,
  assinaturaPor,
  documentosSolicitados,
}: PropostaMidiaGridProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);
  const [galeriaIndex, setGaleriaIndex] = useState(0);
  const [showAssinatura, setShowAssinatura] = useState(false);

  if (!video360Url && fotos.length === 0 && !assinaturaUrl) {
    return null;
  }

  const fotosPreview = fotos.slice(0, 6);
  const totalFotos = fotos.length;

  const navegarGaleria = (direcao: 'prev' | 'next') => {
    if (direcao === 'prev') {
      setGaleriaIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
    } else {
      setGaleriaIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
    }
  };

  const hasDocsSolicitados = documentosSolicitados && documentosSolicitados.length > 0;

  const midiaContent = (
    <div className={cn(
      "grid gap-3",
      hasDocsSolicitados ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    )}>
      {/* Card Vídeo 360° */}
      {video360Url && (
        <Card
          className="cursor-pointer transition-all hover:shadow-lg hover:border-purple-500/50 group border-2 border-purple-500/30 bg-purple-500/5 rounded-xl overflow-hidden"
          onClick={() => setShowVideo(true)}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Video className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">Vídeo 360°</h3>
              </div>
              <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[10px]">
                <Play className="h-2.5 w-2.5 mr-0.5" />
                360°
              </Badge>
            </div>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              <video src={video360Url} className="w-full h-full object-cover" muted preload="metadata" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-white ml-0.5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Galeria de Fotos - Grid 3 colunas */}
      {fotos.length > 0 && (
        <Card
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group rounded-xl overflow-hidden"
          onClick={() => { setGaleriaIndex(0); setShowGaleria(true); }}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 rounded-lg bg-primary/20">
                <Camera className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">Fotos da Vistoria</h3>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                <ImageIcon className="h-2.5 w-2.5 mr-0.5" />
                {totalFotos}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {fotosPreview.map((foto, idx) => (
                <div
                  key={foto.id}
                  className={cn(
                    "aspect-square bg-muted rounded-lg overflow-hidden relative"
                  )}
                >
                  <img src={foto.arquivo_url} alt={foto.tipo || `Foto ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  {idx === 5 && totalFotos > 6 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">+{totalFotos - 6}</span>
                    </div>
                  )}
                </div>
              ))}
              {fotosPreview.length < 6 && Array.from({ length: Math.min(6, 3) - fotosPreview.length }).map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground/20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Assinatura */}
      {assinaturaUrl && (
        <Card
          className="cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/50 group border-2 border-amber-500/30 bg-amber-500/5 rounded-xl overflow-hidden"
          onClick={() => setShowAssinatura(true)}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <PenTool className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">Assinatura</h3>
              </div>
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                Válida
              </Badge>
            </div>
            <div className="aspect-video bg-white rounded-lg flex items-center justify-center p-3 relative group-hover:ring-2 group-hover:ring-amber-500/30 transition-all">
              <img src={assinaturaUrl} alt="Assinatura do cliente" className="max-h-full max-w-full object-contain" />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            {assinaturaData && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                {format(new Date(assinaturaData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <>
      {hasDocsSolicitados ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {midiaContent}
          <DocumentosSolicitadosCard documentosSolicitados={documentosSolicitados} />
        </div>
      ) : (
        midiaContent
      )}

      {/* Modal Vídeo 360° */}
      <Dialog open={showVideo} onOpenChange={setShowVideo}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              Vídeo 360° do Veículo
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black">
            <video src={video360Url || ''} controls autoPlay className="w-full max-h-[70vh] object-contain" playsInline />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Galeria de Fotos */}
      <Dialog open={showGaleria} onOpenChange={setShowGaleria}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Fotos da Vistoria
              <Badge variant="secondary" className="ml-2">
                {galeriaIndex + 1} / {totalFotos}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black min-h-[60vh] flex items-center justify-center">
            {fotos[galeriaIndex] && (
              <img
                src={fotos[galeriaIndex].arquivo_url}
                alt={fotos[galeriaIndex].tipo || `Foto ${galeriaIndex + 1}`}
                className="max-h-[70vh] max-w-full object-contain"
              />
            )}
            
            {totalFotos > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => { e.stopPropagation(); navegarGaleria('prev'); }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => { e.stopPropagation(); navegarGaleria('next'); }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
          
          {/* Thumbnails maiores */}
          <div className="p-3 border-t bg-muted/50 overflow-x-auto">
            <div className="flex gap-2 justify-center">
              {fotos.map((foto, idx) => (
                <button
                  key={foto.id}
                  onClick={() => setGaleriaIndex(idx)}
                  className={cn(
                    "w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                    idx === galeriaIndex
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-transparent hover:border-primary/50 opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={foto.arquivo_url} alt={foto.tipo || `Foto ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Assinatura */}
      <Dialog open={showAssinatura} onOpenChange={setShowAssinatura}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-amber-500" />
              Assinatura do Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <img src={assinaturaUrl || ''} alt="Assinatura do cliente" className="max-h-[50vh] max-w-full object-contain" />
            <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
              {assinaturaData && (
                <p>Coletada em {format(new Date(assinaturaData), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
              {assinaturaPor && (
                <p>Testemunhada por: {assinaturaPor}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
