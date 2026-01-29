import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Save, Loader2, Check, AlertTriangle } from 'lucide-react';
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

interface SalvarTrajetoButtonProps {
  sinistroId: string;
  rastreadorId: string;
  dataInicio: Date;
  dataFim: Date;
  snapshotExistente?: boolean;
}

export function SalvarTrajetoButton({
  sinistroId,
  rastreadorId,
  dataInicio,
  dataFim,
  snapshotExistente = false,
}: SalvarTrajetoButtonProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      // 1. Buscar trajeto via edge function
      const { data: historico, error: histError } = await supabase.functions.invoke('rastreador-historico', {
        body: {
          rastreador_id: rastreadorId,
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
        },
      });

      if (histError) throw histError;
      if (!historico?.success) throw new Error('Erro ao buscar trajeto');

      // 2. Preparar snapshot compacto
      const snapshot = {
        periodo: {
          inicio: dataInicio.toISOString(),
          fim: dataFim.toISOString(),
        },
        fonte: historico.fonte,
        resumo: {
          total_pontos: historico.trajeto?.length || 0,
          total_paradas: historico.paradas?.length || 0,
        },
        trajeto: historico.trajeto?.slice(-500) || [], // Limitar a 500 últimos pontos
        paradas: historico.paradas || [],
        capturado_em: new Date().toISOString(),
      };

      // 3. Salvar no sinistro
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          snapshot_trajeto_json: snapshot,
          snapshot_salvo_em: new Date().toISOString(),
          snapshot_salvo_por: profile?.id,
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      return snapshot;
    },
    onSuccess: (data) => {
      toast.success(`Trajeto salvo! ${data.resumo.total_pontos} pontos anexados ao dossiê`);
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao salvar trajeto:', error);
      toast.error('Erro ao salvar trajeto como evidência');
    },
  });

  if (snapshotExistente) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Check className="h-4 w-4 text-green-500" />
        Trajeto salvo
      </Button>
    );
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          Salvar como evidência
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salvar Trajeto no Dossiê
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta ação irá buscar e salvar o trajeto das 24h anteriores ao sinistro 
              como evidência permanente no dossiê.
            </p>
            <div className="bg-muted/50 p-3 rounded-md text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                <span>
                  Importante: O snapshot será salvo com a data atual e não poderá ser alterado. 
                  Use este recurso após confirmar que os dados do trajeto estão corretos.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={salvarMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              salvarMutation.mutate();
            }}
            disabled={salvarMutation.isPending}
            className="gap-2"
          >
            {salvarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Trajeto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
