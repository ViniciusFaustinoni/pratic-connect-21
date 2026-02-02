import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { Upload, CheckCircle2, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface BotaoEnviarSGAProps {
  contratoId: string;
  veiculoId: string | null;
  associadoId: string | null;
  sincronizado: boolean;
  statusSGA: string | null;
  codigoHinova: number | null;
  isRouboFurto?: boolean;
  clienteNome?: string;
  veiculoPlaca?: string;
}

export function BotaoEnviarSGA({
  contratoId,
  veiculoId,
  associadoId,
  sincronizado,
  statusSGA,
  codigoHinova,
  isRouboFurto = false,
  clienteNome,
  veiculoPlaca,
}: BotaoEnviarSGAProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Se já sincronizado, mostrar badge de sucesso
  if (sincronizado && codigoHinova) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          SGA #{codigoHinova}
        </Badge>
        {isRouboFurto && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Roubo/Furto
          </Badge>
        )}
      </div>
    );
  }

  // Verificar se temos os IDs necessários
  if (!veiculoId || !associadoId) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Dados incompletos
      </Badge>
    );
  }

  // Status de erro - mostrar botão para tentar novamente
  const isError = statusSGA === 'erro_sincronizacao';

  const handleEnviar = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
        body: {
          veiculo_id: veiculoId,
          associado_id: associadoId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao chamar função de sincronização');
      }

      if (!data?.success) {
        // Tratar erro específico de Token Bearer expirado
        if (data?.action_required === 'update_bearer_token') {
          toast.error('Token SGA Hinova Expirado', {
            description: 'O Token Bearer da API precisa ser atualizado. Acesse Configurações > Integrações > SGA Hinova.',
            duration: 10000,
          });
          return;
        }
        
        // Tratar erro de campo faltante (RENAVAM/CHASSI)
        if (data?.campo_faltante) {
          toast.error('Campo obrigatório não preenchido', {
            description: `${data.campo_faltante.toUpperCase()} é obrigatório para enviar ao SGA. Edite o veículo e preencha este campo.`,
            duration: 10000,
          });
          return;
        }
        
        throw new Error(data?.error || 'Falha na sincronização com o SGA');
      }

      toast.success('Enviado para o SGA com sucesso!', {
        description: `Código Hinova: ${data.codigo_veiculo_hinova || 'N/A'}`,
      });

      // Invalidar queries para atualizar a tela
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    } catch (err) {
      console.error('[BotaoEnviarSGA] Erro:', err);
      toast.error('Erro ao enviar para o SGA', {
        description: err instanceof Error ? err.message : 'Tente novamente mais tarde',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isRouboFurto 
    ? (isError ? 'Reenviar para SGA (Roubo/Furto)' : 'Enviar para SGA (Roubo/Furto)')
    : (isError ? 'Reenviar para SGA' : 'Enviar para SGA');

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={isError ? "destructive" : "outline"}
          size="sm"
          disabled={isLoading || statusSGA === 'sincronizando'}
          className={!isError ? "border-blue-300 text-blue-700 hover:bg-blue-50" : ""}
        >
          {isLoading || statusSGA === 'sincronizando' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Sincronizando...
            </>
          ) : isError ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              {buttonLabel}
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {buttonLabel}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Enviar para o SGA Hinova
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {isError 
                  ? 'Deseja tentar enviar novamente os dados para o sistema SGA Hinova?'
                  : 'Deseja enviar os dados deste associado e veículo para o sistema SGA Hinova?'
                }
              </p>

              <div className="bg-muted rounded-md p-3 text-sm space-y-1">
                {clienteNome && <p><strong>Cliente:</strong> {clienteNome}</p>}
                {veiculoPlaca && <p><strong>Veículo:</strong> {veiculoPlaca}</p>}
              </div>

              {isRouboFurto && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <ShieldAlert className="h-4 w-4" />
                    Plano de Roubo/Furto
                  </div>
                  <p className="text-xs">
                    Este associado possui cobertura exclusiva para Roubo e Furto (sem colisão).
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">📤 Dados que serão enviados:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Dados do associado (nome, CPF, endereço, contato)</li>
                  <li>Dados do veículo (placa, chassi, modelo, ano)</li>
                  <li>Fotos da vistoria (se disponíveis)</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleEnviar}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Enviando...' : 'Confirmar Envio'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
