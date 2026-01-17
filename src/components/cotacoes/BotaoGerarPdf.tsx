import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gerarPdfCotacao, type CotacaoParaPdf } from '@/lib/gerarPdfCotacao';
import { toast } from 'sonner';

interface BotaoGerarPdfProps {
  cotacao: CotacaoParaPdf;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function BotaoGerarPdf({ 
  cotacao, 
  variant = 'outline', 
  size = 'sm',
  className 
}: BotaoGerarPdfProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGerarPdf = async () => {
    setIsGenerating(true);
    try {
      // Pequeno delay para mostrar loading
      await new Promise(resolve => setTimeout(resolve, 300));
      gerarPdfCotacao(cotacao);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGerarPdf}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {isGenerating ? 'Gerando...' : 'Baixar PDF'}
    </Button>
  );
}

// Re-exportar o tipo para conveniência
export type { CotacaoParaPdf };
