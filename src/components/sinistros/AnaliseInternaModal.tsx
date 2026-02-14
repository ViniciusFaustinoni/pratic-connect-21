import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, ClipboardCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const IRREGULARIDADES = [
  'Condutor sem CNH',
  'CNH vencida',
  'Condutor embriagado',
  'GNV irregular',
  'Sobrecarga elétrica',
  'Rastreador não instalado quando obrigatório',
  'Local inadequado',
  'Água salgada',
  'Outro',
] as const;

type Acao = 'prosseguir' | 'solicitar_docs' | 'sindicancia' | 'juridico';

interface AnaliseInternaModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  onOpenSindicancia: () => void;
  onOpenJuridico: () => void;
}

export function AnaliseInternaModal({
  open, onClose, sinistroId, protocolo, onOpenSindicancia, onOpenJuridico,
}: AnaliseInternaModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [irregularidade, setIrregularidade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [acao, setAcao] = useState<Acao | ''>('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!irregularidade) throw new Error('Selecione a irregularidade');
      if (!descricao.trim()) throw new Error('Descreva a irregularidade');
      if (!acao) throw new Error('Selecione o que fazer');

      const motivos = [irregularidade, descricao].filter(Boolean);

      if (acao === 'prosseguir') {
        await supabase.from('sinistros').update({
          analise_interna: true,
          analise_interna_motivos: motivos,
          updated_at: new Date().toISOString(),
        }).eq('id', sinistroId);
      } else if (acao === 'solicitar_docs') {
        await supabase.from('sinistros').update({
          status: 'documentacao_pendente' as any,
          analise_interna: true,
          analise_interna_motivos: motivos,
          updated_at: new Date().toISOString(),
        }).eq('id', sinistroId);
      }

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: acao === 'solicitar_docs' ? 'documentacao_pendente' : 'em_analise',
        usuario_id: user?.id,
        observacao: `[ANÁLISE INTERNA] Irregularidade: ${irregularidade}. ${descricao}. Ação: ${
          acao === 'prosseguir' ? 'Prosseguir com aprovação' :
          acao === 'solicitar_docs' ? 'Solicitar mais documentos' :
          acao === 'sindicancia' ? 'Abrir sindicância' : 'Encaminhar ao jurídico'
        }`,
      });
    },
    onSuccess: () => {
      toast.success('Análise interna registrada');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });

      if (acao === 'sindicancia') {
        handleClose();
        onOpenSindicancia();
      } else if (acao === 'juridico') {
        handleClose();
        onOpenJuridico();
      } else {
        handleClose();
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleClose = () => {
    setIrregularidade('');
    setDescricao('');
    setAcao('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Análise Interna
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Análise interna é tratamento <strong>INTERNO</strong>. O associado não é informado.</span>
          </div>

          {/* Irregularidade */}
          <div className="space-y-2">
            <Label>Irregularidade *</Label>
            <Select value={irregularidade} onValueChange={setIrregularidade}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {IRREGULARIDADES.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva a irregularidade encontrada..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          {/* Ação */}
          <div className="space-y-3">
            <Label>O que fazer agora? *</Label>
            <RadioGroup value={acao} onValueChange={(v) => setAcao(v as Acao)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="prosseguir" id="ai-prosseguir" />
                <Label htmlFor="ai-prosseguir" className="font-normal cursor-pointer">Prosseguir com aprovação</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="solicitar_docs" id="ai-docs" />
                <Label htmlFor="ai-docs" className="font-normal cursor-pointer">Solicitar mais documentos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sindicancia" id="ai-sindicancia" />
                <Label htmlFor="ai-sindicancia" className="font-normal cursor-pointer">Abrir sindicância</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="juridico" id="ai-juridico" />
                <Label htmlFor="ai-juridico" className="font-normal cursor-pointer">Encaminhar ao jurídico</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !irregularidade || !descricao.trim() || !acao}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
