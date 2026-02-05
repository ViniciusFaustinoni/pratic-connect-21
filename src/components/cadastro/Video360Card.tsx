import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Play } from 'lucide-react';

interface Video360CardProps {
  videoUrl: string;
}

export function Video360Card({ videoUrl }: Video360CardProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Video className="h-5 w-5 text-purple-500" />
            Vídeo 360° do Veículo
          </CardTitle>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
            <Play className="h-3 w-3 mr-1" />
            360°
          </Badge>
        </div>
        <CardDescription>
          Gravado pelo vistoriador - Volta completa no veículo
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
          <video
            src={videoUrl}
            controls
            className="w-full aspect-video object-contain bg-black"
            preload="metadata"
            playsInline
          >
            Seu navegador não suporta a reprodução de vídeos.
          </video>
        </div>
      </CardContent>
    </Card>
  );
}
