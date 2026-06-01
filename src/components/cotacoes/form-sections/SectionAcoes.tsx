import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SectionAcoesProps {
  isPending: boolean;
  isEditando: boolean;
  podeSubmeter: boolean;
}

export function SectionAcoes({ isPending, isEditando, podeSubmeter }: SectionAcoesProps) {
  // Label dinâmico: quando pending, deixa explícito ao operador que o sistema
  // está trabalhando — evita o duplo-clique que agrava o lock wedge do auth.
  const label = isPending
    ? (isEditando ? 'Salvando alterações…' : 'Criando cotação…')
    : (isEditando ? 'Salvar Alterações' : 'Criar Cotação');

  return (
    <div className="sticky bottom-0 bg-background border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 flex items-center justify-end">
      <Button
        type="submit"
        disabled={!podeSubmeter || isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Check className="h-4 w-4 mr-1" />
        )}
        {label}
      </Button>
    </div>
  );
}
