import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Download, ExternalLink, Loader2, ChevronDown } from 'lucide-react';
import { useGerarProposta } from '@/hooks/useGerarProposta';
import { DadosProposta } from '@/types/proposta';
import { Progress } from '@/components/ui/progress';

interface BotaoGerarPropostaProps {
  dados: DadosProposta;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export function BotaoGerarProposta({ dados, disabled, variant = 'default', className }: BotaoGerarPropostaProps) {
  const { gerarProposta, gerando, progresso } = useGerarProposta();

  // Bloquear se é migração e ainda não foi aprovada
  const migracaoPendente = dados.migracao && !dados.migracao.aprovada;

  const handleGerar = async (modo: 'baixar' | 'abrir') => {
    await gerarProposta(dados, { modo });
  };

  if (gerando) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <Button disabled variant={variant} className="w-full">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Gerando PDF...
        </Button>
        <Progress value={progresso} className="h-1" />
      </div>
    );
  }

  if (migracaoPendente) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={className}>
              <Button variant={variant} disabled className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Proposta
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aguardando aprovação da migração</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} disabled={disabled} className={className}>
          <FileText className="h-4 w-4 mr-2" />
          Gerar Proposta
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleGerar('baixar')}>
          <Download className="h-4 w-4 mr-2" />
          Baixar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleGerar('abrir')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir em nova aba
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
