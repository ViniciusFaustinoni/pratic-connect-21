import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ResultadoSindicancia } from '@/types/sinistros';
import { RESULTADO_SINDICANCIA_LABELS } from '@/types/sinistros';

interface ConcluirSindicanciaModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  associadoId?: string | null;
  associadoNome?: string | null;
  onSuccess?: () => void;
}

const RESULTADO_DESCRICAO: Record<ResultadoSindicancia, string> = {
  regular: 'Sem fraude detectada. O evento retorna para APROVADO e segue o fluxo normal.',
  irregular: 'Fraude comprovada. O evento será NEGADO e um caso jurídico será criado automaticamente.',
  carta_cancelamento: 'O associado desistiu do acionamento. Evento CANCELADO, jurídico notificado.',
  juridico: 'Caso complexo. Será encaminhado diretamente ao departamento JURÍDICO.',
  inconclusivo: 'Evidências insuficientes. O caso será enviado à DIRETORIA para decisão final.',
};

export function ConcluirSindicanciaModal({
  open, onClose, sinistroId, protocolo, associadoId, associadoNome, onSuccess,
}: ConcluirSindicanciaModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resultado, setResultado] = useState<ResultadoSindicancia | ''>('');
  const [relatorio, setRelatorio] = useState('');

  const concluirMutation = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error('Selecione um resultado');
      if (relatorio.length < 200) throw new Error('Relatório deve ter pelo menos 200 caracteres');

      // Determinar novo status baseado no resultado
      const statusMap: Record<ResultadoSindicancia, string> = {
        regular: 'aprovado',
        irregular: 'negado',
        carta_cancelamento: 'cancelado',
        juridico: 'suspenso',
        inconclusivo: 'suspenso',
      };
      const novoStatus = statusMap[resultado];

      // 1. Atualizar sinistro
      const updateData: Record<string, any> = {
        status: novoStatus,
        resultado_sindicancia: resultado,
        updated_at: new Date().toISOString(),
      };
      if (resultado === 'irregular') {
        updateData.motivo_negacao = 'fraude_suspeita';
        updateData.justificativa_negacao = relatorio;
      }
      if (resultado === 'inconclusivo') {
        updateData.motivo_suspensao = 'Sindicância inconclusiva — aguardando decisão da diretoria';
      }

      const { error: updateError } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', sinistroId);
      if (updateError) throw updateError;

      // 2. Registrar histórico
      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_novo: novoStatus,
          usuario_id: user?.id,
          observacao: `Sindicância concluída — Resultado: ${RESULTADO_SINDICANCIA_LABELS[resultado]}. ${relatorio}`,
        });
      if (histError) throw histError;

      // 3. Ações automáticas por resultado
      if (resultado === 'irregular' || resultado === 'juridico') {
        await supabase.from('processos').insert({
          sinistro_id: sinistroId,
          associado_id: associadoId || undefined,
          tipo: resultado === 'irregular' ? 'sindicancia_fraude' : 'sindicancia_complexa',
          natureza: resultado === 'irregular' ? 'Fraude em sinistro' : 'Caso complexo de sindicância',
          objeto: relatorio.substring(0, 200),
          parte_contraria_nome: associadoNome || 'A definir',
          status: 'ativo',
          criado_por: user?.id,
          observacoes: relatorio,
        });
      }

      // Carta de cancelamento → criar consulta jurídica
      if (resultado === 'carta_cancelamento') {
        await supabase.from('consultas_juridicas').insert({
          sinistro_id: sinistroId,
          associado_id: associadoId || undefined,
          solicitante_id: user?.id,
          assunto: 'Carta de Cancelamento — Sindicância',
          descricao: `Associado ${associadoNome || ''} desistiu do acionamento (protocolo ${protocolo}). Providenciar registro formal e suspensão do veículo.\n\nRelatório: ${relatorio}`,
          prioridade: 'alta',
          departamento: 'eventos',
          status: 'pendente',
        });
      }

      // 4. Notificar
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: sinistroId, status: novoStatus },
        });
      } catch (err) {
        console.error('Erro ao notificar:', err);
      }
    },
    onSuccess: () => {
      toast.success('Sindicância concluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao concluir sindicância');
    },
  });

  const handleClose = () => {
    setResultado('');
    setRelatorio('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-rose-600" />
            Concluir Sindicância
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Resultado */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Resultado da Sindicância *</Label>
            <RadioGroup value={resultado} onValueChange={(v) => setResultado(v as ResultadoSindicancia)}>
              {(Object.entries(RESULTADO_SINDICANCIA_LABELS) as [ResultadoSindicancia, string][]).map(([key, label]) => (
                <div key={key} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={key} id={key} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={key} className="font-medium cursor-pointer">{label}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{RESULTADO_DESCRICAO[key]}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Relatório */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Relatório Final *</Label>
            <Textarea
              placeholder="Descreva detalhadamente as conclusões da sindicância, evidências encontradas e justificativa para o resultado... (mín. 200 caracteres)"
              value={relatorio}
              onChange={(e) => setRelatorio(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className={`text-xs ${relatorio.length < 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {relatorio.length}/200 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={concluirMutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => concluirMutation.mutate()}
            disabled={concluirMutation.isPending || !resultado || relatorio.length < 200}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {concluirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Concluir Sindicância
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
