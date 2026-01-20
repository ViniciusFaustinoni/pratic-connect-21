import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  gerarPdfCotacao, 
  gerarPdfCotacaoComparativa,
  type CotacaoParaPdf,
  type CotacaoComparativaParaPdf,
  type PlanoParaPdf
} from '@/lib/gerarPdfCotacao';
import { toast } from 'sonner';

interface PlanoComparacaoExtras {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  coberturas?: string[];
}

interface DadosExtras {
  planos_comparacao?: PlanoComparacaoExtras[];
  [key: string]: unknown;
}

interface CotacaoComPlanosExtras extends Omit<CotacaoParaPdf, 'valor_adesao'> {
  dados_extras?: DadosExtras | null;
  valor_adesao: number | null;
}

interface BotaoGerarPdfProps {
  cotacao: CotacaoComPlanosExtras;
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
      const planosComparacao = cotacao.dados_extras?.planos_comparacao;
      
      // Se há planos em dados_extras (1 ou mais), usar PDF comparativo
      if (planosComparacao && planosComparacao.length > 0) {
        const valorAdesao = cotacao.valor_adesao || 0;
        
        const planosParaPdf: PlanoParaPdf[] = planosComparacao.map(plano => ({
          nome: plano.nome,
          valorMensal: plano.valorMensal,
          valorAdesao: valorAdesao,
          coberturas: plano.coberturas || [],
          naoInclui: [],
          coberturaFipe: 100,
          cota: '',
        }));

        const cotacaoComparativa: CotacaoComparativaParaPdf = {
          numero: cotacao.numero,
          created_at: cotacao.created_at,
          validade_dias: cotacao.validade_dias,
          nome_solicitante: cotacao.leads?.nome || cotacao.nome_solicitante,
          telefone1_solicitante: cotacao.leads?.telefone || cotacao.telefone1_solicitante,
          email_solicitante: cotacao.leads?.email || cotacao.email_solicitante,
          veiculo_marca: cotacao.veiculo_marca,
          veiculo_modelo: cotacao.veiculo_modelo,
          veiculo_ano: cotacao.veiculo_ano,
          veiculo_placa: cotacao.veiculo_placa,
          valor_fipe: cotacao.valor_fipe,
          planosComparar: planosParaPdf,
        };

        await gerarPdfCotacaoComparativa(cotacaoComparativa);
      } else {
        // Fallback: sem dados_extras, usar PDF padrão
        await gerarPdfCotacao(cotacao as CotacaoParaPdf);
      }
      
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
