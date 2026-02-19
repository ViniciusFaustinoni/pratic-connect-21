import { ExternalLink, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface EventoLinkButtonProps {
  token: string;
}

export function EventoLinkButton({ token }: EventoLinkButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/evento/${token}`);
  };

  return (
    <div className="mt-3">
      <Button
        onClick={handleClick}
        className="w-full flex items-center gap-3 h-auto py-3 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
          <Camera className="h-5 w-5" />
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-semibold text-sm">Acessar Link do Evento</span>
          <span className="text-xs opacity-80">Envie fotos, B.O. e relato</span>
        </div>
        <ExternalLink className="h-4 w-4 ml-auto shrink-0 opacity-70" />
      </Button>
    </div>
  );
}
