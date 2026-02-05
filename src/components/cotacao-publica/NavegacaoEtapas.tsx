import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavegacaoEtapasProps {
  etapaAtual: number;
  etapaMaxima: number;
  totalEtapas: number;
  onVoltar: () => void;
  onAvancar: () => void;
  navegacaoManual?: boolean;
  mostrarVoltar?: boolean;
}

export function NavegacaoEtapas({
  etapaAtual,
  etapaMaxima,
  totalEtapas,
  onVoltar,
  onAvancar,
  navegacaoManual = false,
  mostrarVoltar = false,
}: NavegacaoEtapasProps) {
  const podeVoltar = mostrarVoltar && etapaAtual > 0;
  // CORREÇÃO: Em modo manual, permitir avançar até a etapa máxima (para revisar etapas anteriores)
  const podeAvancar = navegacaoManual && etapaAtual < etapaMaxima;
  
  // Só oculta se não pode fazer nenhuma ação
  if (!podeVoltar && !podeAvancar) return null;
  
  return (
    <motion.div 
      className="flex justify-between items-center pt-6 mt-6 border-t border-border/30"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {podeVoltar ? (
        <Button 
          variant="ghost" 
          onClick={onVoltar}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
      ) : <div />}
      
      {podeAvancar && (
        <Button 
          onClick={onAvancar}
          className="gap-2"
        >
          Continuar
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}
