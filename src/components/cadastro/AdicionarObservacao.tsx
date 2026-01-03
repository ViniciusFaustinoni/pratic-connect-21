import { useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAssociadoHistoricoCompleto } from '@/hooks/useAssociadoHistoricoCompleto';

interface AdicionarObservacaoProps {
  associadoId: string;
}

export function AdicionarObservacao({ associadoId }: AdicionarObservacaoProps) {
  const [texto, setTexto] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { adicionarObservacao } = useAssociadoHistoricoCompleto(associadoId);

  const handleSubmit = async () => {
    if (!texto.trim()) {
      toast.error('Digite uma observação');
      return;
    }

    try {
      await adicionarObservacao.mutateAsync(texto.trim());
      setTexto('');
      setIsExpanded(false);
      toast.success('Observação adicionada com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar observação');
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="mb-4"
      >
        <MessageSquarePlus className="mr-2 h-4 w-4" />
        Adicionar Observação
      </Button>
    );
  }

  return (
    <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquarePlus className="h-4 w-4" />
        Nova Observação
      </div>
      <Textarea
        placeholder="Digite sua observação sobre este associado..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexto('');
            setIsExpanded(false);
          }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!texto.trim() || adicionarObservacao.isPending}
        >
          {adicionarObservacao.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
