import { useState } from 'react';
import { Key, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BotaoRedefinirSenhaProps {
  rastreadorId: string;
  nomeAssociado?: string;
}

export function BotaoRedefinirSenha({ rastreadorId, nomeAssociado }: BotaoRedefinirSenhaProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    success: boolean;
    novaSenha?: string;
    mensagem?: string;
    erro?: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const redefinirSenha = async () => {
    setLoading(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('rastreador-redefinir-senha', {
        body: { rastreador_id: rastreadorId },
      });

      if (error) throw error;

      setResultado(data);
      
      if (data.success) {
        toast.success(data.mensagem || 'Senha redefinida com sucesso!');
      } else {
        toast.error(data.erro || 'Erro ao redefinir senha');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido';
      setResultado({ success: false, erro: errorMsg });
      toast.error(`Erro: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const copiarSenha = () => {
    if (resultado?.novaSenha) {
      navigator.clipboard.writeText(resultado.novaSenha);
      setCopiado(true);
      toast.success('Senha copiada!');
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setResultado(null);
      setCopiado(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Key className="h-4 w-4" />
          Redefinir Senha
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redefinir Senha do Rastreador</AlertDialogTitle>
          <AlertDialogDescription>
            {nomeAssociado 
              ? `Redefinir a senha de acesso ao rastreador de ${nomeAssociado}?`
              : 'Redefinir a senha de acesso ao rastreador do associado?'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {resultado && (
          <div className="py-4">
            {resultado.success && resultado.novaSenha ? (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <Key className="h-4 w-4 text-green-600" />
                <AlertDescription className="space-y-3">
                  <p className="text-green-700 dark:text-green-400">{resultado.mensagem}</p>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-background rounded-md border">
                    <code className="flex-1 font-mono text-lg font-bold tracking-wider">
                      {resultado.novaSenha}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copiarSenha}>
                      {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Anote e informe ao cliente. Esta senha não será exibida novamente.
                  </p>
                </AlertDescription>
              </Alert>
            ) : resultado.success ? (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  {resultado.mensagem}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>{resultado.erro || resultado.mensagem}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
          {!resultado?.success && (
            <AlertDialogAction onClick={redefinirSenha} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
