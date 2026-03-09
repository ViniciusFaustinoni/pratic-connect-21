import { Phone, MessageSquare, Headphones, Loader2 } from 'lucide-react';
import { useContatos } from '@/hooks/useConteudosSistema';

export function ContatosRapidos() {
  const { data: contatos, isLoading } = useContatos();

  if (isLoading || !contatos) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
          <a 
            href={`tel:${contatos.cadastro.replace(/\D/g, '')}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Cadastro:</span>
            <span className="font-medium">{contatos.cadastro}</span>
          </a>
          
          <span className="text-muted-foreground hidden md:inline">|</span>
          
          <a 
            href={`tel:${contatos.comercial.replace(/\D/g, '')}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comercial:</span>
            <span className="font-medium">{contatos.comercial}</span>
          </a>
          
          <span className="text-muted-foreground hidden md:inline">|</span>
          
          <a 
            href={`tel:${contatos.assistencia.replace(/\D/g, '')}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Assistência 24h:</span>
            <span className="font-medium">{contatos.assistencia}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function ContatosInline() {
  const { data: contatos, isLoading } = useContatos();

  if (isLoading || !contatos) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 flex-wrap text-xs py-4 border-t bg-muted/30 rounded-lg">
      <a 
        href={`tel:${contatos.cadastro.replace(/\D/g, '')}`}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
      >
        <Phone className="h-3.5 w-3.5" />
        <span>Cadastro: {contatos.cadastro}</span>
      </a>
      
      <span className="text-muted-foreground">•</span>
      
      <a 
        href={`tel:${contatos.comercial.replace(/\D/g, '')}`}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Comercial: {contatos.comercial}</span>
      </a>
      
      <span className="text-muted-foreground">•</span>
      
      <a 
        href={`tel:${contatos.assistencia.replace(/\D/g, '')}`}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
      >
        <Headphones className="h-3.5 w-3.5" />
        <span>Assistência: {contatos.assistencia}</span>
      </a>
    </div>
  );
}
