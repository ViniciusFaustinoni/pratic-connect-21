import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdvogados } from '@/hooks/useAdvogados';
import { toast } from 'sonner';
import { Loader2, Scale, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TIPOS_JURIDICO = [
  { value: 'questao_legal_complexa', label: 'Questão legal complexa' },
  { value: 'analise_juridica_alagamento_incendio', label: 'Análise jurídica (alagamento/incêndio)' },
  { value: 'documentacao_indenizacao', label: 'Documentação de indenização' },
  { value: 'disputa_proprietario', label: 'Disputa de proprietário' },
  { value: 'gravame_judicial', label: 'Gravame judicial' },
  { value: 'espolio', label: 'Espólio ou massa falida' },
  { value: 'outro', label: 'Outro' },
] as const;

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
] as const;

interface EncaminharJuridicoEventoModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  associadoId?: string | null;
  associadoNome?: string | null;
}

export function EncaminharJuridicoEventoModal({
  open, onClose, sinistroId, protocolo, associadoId, associadoNome,
}: EncaminharJuridicoEventoModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { advogados = [] } = useAdvogados({ ativo: true });

  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [advogadoId, setAdvogadoId] = useState('');

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      if (!tipo) throw new Error('Selecione o tipo');
      if (descricao.length < 20) throw new Error('Descrição deve ter pelo menos 20 caracteres');

      const tipoLabel = TIPOS_JURIDICO.find(t => t.value === tipo)?.label || tipo;

      // Criar consulta jurídica
      const { error: consultaError } = await supabase.from('consultas_juridicas').insert({
        sinistro_id: sinistroId,
        associado_id: associadoId || undefined,
        solicitante_id: user?.id,
        assunto: `Encaminhamento Jurídico — ${tipoLabel}`,
        descricao: `Evento ${protocolo} encaminhado ao jurídico.\nTipo: ${tipoLabel}\nPrioridade: ${prioridade}\nAssociado: ${associadoNome || 'N/I'}\n\n${descricao}`,
        prioridade: prioridade as any,
        departamento: 'eventos',
        status: 'pendente',
      });
      if (consultaError) throw consultaError;

      // Atualizar sinistro
      const { error: updateError } = await supabase.from('sinistros').update({
        status: 'suspenso' as any,
        motivo_suspensao: `Encaminhado ao jurídico: ${tipoLabel}`,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistroId);
      if (updateError) throw updateError;

      // Histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: 'suspenso',
        usuario_id: user?.id,
        observacao: `Encaminhado para Jurídico. Tipo: ${tipoLabel}. Prioridade: ${prioridade}. ${descricao}`,
      });
    },
    onSuccess: () => {
      toast.success('Evento encaminhado para o Jurídico');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao encaminhar'),
  });

  const handleClose = () => {
    setTipo('');
    setDescricao('');
    setPrioridade('normal');
    setAdvogadoId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-purple-600" />
            Encaminhar para Jurídico
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-sm">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>O evento ficará com status <strong>'aguardando jurídico'</strong> até o departamento emitir parecer.</span>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo do Caso *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_JURIDICO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advogado */}
          <div className="space-y-2">
            <Label>Advogado Responsável</Label>
            <Select value={advogadoId} onValueChange={setAdvogadoId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {advogados.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome} {a.oab ? `(OAB ${a.oab})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição Detalhada *</Label>
            <Textarea
              placeholder="Descreva o problema legal e detalhes relevantes... (mín. 20 caracteres)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className={`text-xs ${descricao.length < 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {descricao.length}/20 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={encaminharMutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => encaminharMutation.mutate()}
            disabled={encaminharMutation.isPending || !tipo || descricao.length < 20}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {encaminharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
