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
  X,
  ZoomIn,
  CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VistoriaFotoInfo } from '@/hooks/usePropostasPendentes';

interface PropostaMidiaGridProps {
  video360Url?: string | null;
  fotos: VistoriaFotoInfo[];
  assinaturaUrl?: string | null;
  assinaturaData?: string | null;
  assinaturaPor?: string | null;
}

export function PropostaMidiaGrid({
  video360Url,
  fotos,
  assinaturaUrl,
  assinaturaData,
  assinaturaPor,
}: PropostaMidiaGridProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);
  const [galeriaIndex, setGaleriaIndex] = useState(0);
  const [showAssinatura, setShowAssinatura] = useState(false);

  // Se não tem nenhuma mídia, não renderiza
  if (!video360Url && fotos.length === 0 && !assinaturaUrl) {
    return null;
  }

  // Pegar as 4 primeiras fotos para preview
  const fotosPreview = fotos.slice(0, 4);
  const totalFotos = fotos.length;

  const navegarGaleria = (direcao: 'prev' | 'next') => {
    if (direcao === 'prev') {
      setGaleriaIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
    } else {
      setGaleriaIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
    }
  };

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card Vídeo 360° */}
        {video360Url && (
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-purple-500/50 group border-2 border-purple-500/30 bg-purple-500/5"
            onClick={() => setShowVideo(true)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Video className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Vídeo 360°</h3>
                  <p className="text-xs text-muted-foreground">Volta completa no veículo</p>
                </div>
                <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">
                  <Play className="h-3 w-3 mr-1" />
                  360°
                </Badge>
              </div>
              
              {/* Thumbnail area */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                <video
                  src={video360Url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-purple-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-7 w-7 text-white ml-1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Galeria de Fotos */}
        {fotos.length > 0 && (
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
            onClick={() => {
              setGaleriaIndex(0);
              setShowGaleria(true);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Fotos da Vistoria</h3>
                  <p className="text-xs text-muted-foreground">Clique para ver todas</p>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {totalFotos}
                </Badge>
              </div>
              
              {/* Grid 2x2 de thumbnails */}
              <div className="grid grid-cols-2 gap-2">
                {fotosPreview.map((foto, idx) => (
                  <div
                    key={foto.id}
                    className={cn(
                      "aspect-square bg-muted rounded-lg overflow-hidden relative",
                      idx === 3 && totalFotos > 4 && "after:absolute after:inset-0 after:bg-black/50 after:flex after:items-center after:justify-center"
                    )}
                  >
                    <img
                      src={foto.arquivo_url}
                      alt={foto.tipo || `Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {idx === 3 && totalFotos > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">+{totalFotos - 4}</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Preencher slots vazios se menos de 4 fotos */}
                {fotosPreview.length < 4 && Array.from({ length: 4 - fotosPreview.length }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="aspect-square bg-muted rounded-lg flex items-center justify-center"
                  >
                    <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Assinatura */}
        {assinaturaUrl && (
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/50 group border-2 border-amber-500/30 bg-amber-500/5"
            onClick={() => setShowAssinatura(true)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <PenTool className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Assinatura</h3>
                  <p className="text-xs text-muted-foreground">Coletada na vistoria</p>
                </div>
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Válida
                </Badge>
              </div>
              
              {/* Preview da assinatura */}
              <div className="aspect-video bg-white rounded-lg flex items-center justify-center p-3 relative group-hover:ring-2 group-hover:ring-amber-500/30 transition-all">
                <img
                  src={assinaturaUrl}
                  alt="Assinatura do cliente"
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              
              {assinaturaData && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {format(new Date(assinaturaData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

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
            <video
              src={video360Url || ''}
              controls
              autoPlay
              className="w-full max-h-[70vh] object-contain"
              playsInline
            />
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
            
            {/* Navegação */}
            {totalFotos > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navegarGaleria('prev');
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navegarGaleria('next');
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
          
          {/* Thumbnails */}
          <div className="p-4 border-t bg-muted/50 overflow-x-auto">
            <div className="flex gap-2 justify-center">
              {fotos.map((foto, idx) => (
                <button
                  key={foto.id}
                  onClick={() => setGaleriaIndex(idx)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                    idx === galeriaIndex
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-primary/50"
                  )}
                >
                  <img
                    src={foto.arquivo_url}
                    alt={foto.tipo || `Foto ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
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
            <img
              src={assinaturaUrl || ''}
              alt="Assinatura do cliente"
              className="max-h-[50vh] max-w-full object-contain"
            />
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
