import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PenTool, CheckCircle, ZoomIn } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssinaturaClienteCardProps {
  assinaturaUrl: string | null;
  dataColeta?: string | null;
  instaladorNome?: string | null;
}

export function AssinaturaClienteCard({ 
  assinaturaUrl, 
  dataColeta, 
  instaladorNome 
}: AssinaturaClienteCardProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Se não tem assinatura, não renderiza
  if (!assinaturaUrl) return null;
  
  return (
    <>
      <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <PenTool className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            Assinatura do Cliente
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              Coletada na Vistoria
            </Badge>
          </CardTitle>
          <CardDescription>
            Assinatura manuscrita do cliente confirmando os dados da vistoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="bg-white rounded-lg p-4 flex justify-center cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all group relative"
            onClick={() => setShowFullscreen(true)}
          >
            <img 
              src={assinaturaUrl} 
              alt="Assinatura do Cliente"
              className="max-h-28 object-contain"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg flex items-center justify-center transition-all">
              <ZoomIn className="h-6 w-6 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {dataColeta && (
              <span className="flex items-center gap-1">
                📅 Coletada em: {format(new Date(dataColeta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {instaladorNome && (
              <span className="flex items-center gap-1">
                👤 Por: {instaladorNome}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Fullscreen */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-amber-500" />
              Assinatura do Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <div className="bg-white rounded-lg p-6 w-full">
              <img 
                src={assinaturaUrl} 
                alt="Assinatura do Cliente"
                className="max-h-[50vh] mx-auto object-contain"
              />
            </div>
            <div className="mt-4 text-sm text-muted-foreground text-center">
              {dataColeta && (
                <p>Coletada em {format(new Date(dataColeta), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
              {instaladorNome && (
                <p className="mt-1">Testemunhada por: {instaladorNome}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
