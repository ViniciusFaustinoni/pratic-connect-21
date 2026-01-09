import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gerarPdfCotacao } from '@/lib/gerarPdfCotacao';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface CotacaoParaPdf {
  numero: string | null;
  valor_fipe: number | null;
  valor_adesao: number | null;
  valor_total_mensal: number | null;
  valor_cota: number | null;
  taxa_administrativa: number | null;
  valor_rastreamento: number | null;
  valor_assistencia: number | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  codigo_fipe: string | null;
  created_at: string;
  validade_dias: number | null;
  leads?: Tables<'leads'> | null;
  planos?: Tables<'planos'> | null;
}

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
