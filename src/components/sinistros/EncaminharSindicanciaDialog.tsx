import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Search, UserCheck, AlertTriangle } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MOTIVOS_SINDICANCIA_UNIFICADOS = [
  'Suspeita de fraude',
  'Inconsistência no relato',
  'Histórico de múltiplos sinistros',
  'Dados suspeitos do rastreador',
  'Documentação irregular',
  'GNV irregular',
  'Sobrecarga elétrica',
  'Local inadequado',
  'Água salgada',
  'Terceiro suspeito',
  'Outro',
];

interface EncaminharSindicanciaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  tipoEvento?: string;
  onSuccess?: () => void;
}

export function EncaminharSindicanciaDialog({
  open, onClose, sinistroId, protocolo, onSuccess,
}: EncaminharSindicanciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<'sindicancia' | 'pericia'>('sindicancia');
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoResponsavel, setTipoResponsavel] = useState<'interno' | 'terceirizado'>('interno');
  const [sindicanteId, setSindicanteId] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaContato, setEmpresaContato] = useState('');
  const [prazoDias, setPrazoDias] = useState(30);

  const prazoFim = format(addDays(new Date(), prazoDias), 'yyyy-MM-dd');

  const { data: sindicantes = [] } = useQuery({
    queryKey: ['sindicantes-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .eq('tipo', 'funcionario')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      if (tipoResponsavel === 'interno' && !sindicanteId) throw new Error('Selecione o responsável');
      if (tipoResponsavel === 'terceirizado' && !empresaNome.trim()) throw new Error('Informe a empresa');
      if (!motivo) throw new Error('Selecione o motivo');
      if (descricao.length < 50) throw new Error('Descrição deve ter pelo menos 50 caracteres');

      const responsavelInfo = tipoResponsavel === 'interno'
        ? sindicantes.find(s => s.id === sindicanteId)?.nome || ''
        : `${empresaNome} (${empresaContato})`;

      const statusNovo = tipo === 'pericia' ? 'em_pericia' : 'em_sindicancia';
      const tipoLabel = tipo === 'pericia' ? 'Perícia Técnica' : 'Sindicância';

      const { error: updateError } = await supabase.from('sinistros').update({
        status: statusNovo as any,
        sindicante_id: tipoResponsavel === 'interno' ? sindicanteId : null,
        sindicancia_prazo_fim: prazoFim,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistroId);
      if (updateError) throw updateError;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: statusNovo,
        usuario_id: user?.id,
        observacao: `Encaminhado para ${tipoLabel}. Motivo: ${motivo}. Responsável: ${responsavelInfo}. Prazo: ${prazoDias} dias (${format(new Date(prazoFim), 'dd/MM/yyyy')}). ${descricao}`,
      });

      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: sinistroId, status: statusNovo },
        });
      } catch (err) {
        console.error('Erro ao notificar:', err);
      }
    },
    onSuccess: () => {
      toast.success(`Evento encaminhado para ${tipo === 'pericia' ? 'perícia técnica' : 'sindicância'}!`);
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao encaminhar'),
  });

  const handleClose = () => {
    setTipo('sindicancia');
    setMotivo('');
    setDescricao('');
    setTipoResponsavel('interno');
    setSindicanteId('');
    setEmpresaNome('');
    setEmpresaContato('');
    setPrazoDias(30);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-amber-600" />
            Encaminhar para {tipo === 'pericia' ? 'Perícia Técnica' : 'Sindicância'}
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Ao abrir sindicância, o prazo de ressarcimento do associado será automaticamente suspenso conforme Regulamento art. 10.5. O associado <strong>não será notificado</strong>.</span>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as 'sindicancia' | 'pericia')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sindicancia" id="tipo-sindicancia" />
                <Label htmlFor="tipo-sindicancia" className="font-normal cursor-pointer">Sindicância (investigação de fraude/irregularidade)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pericia" id="tipo-pericia" />
                <Label htmlFor="tipo-pericia" className="font-normal cursor-pointer">Perícia Técnica (investigação da causa do dano)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_SINDICANCIA_UNIFICADOS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição detalhada * (mín. 50 caracteres)</Label>
            <Textarea
              placeholder="Descreva o que foi observado, por que há suspeita..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
            <p className={`text-xs ${descricao.length < 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {descricao.length}/50 caracteres mínimos
            </p>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável *</Label>
            <RadioGroup value={tipoResponsavel} onValueChange={(v) => setTipoResponsavel(v as 'interno' | 'terceirizado')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="interno" id="resp-interno" />
                <Label htmlFor="resp-interno" className="font-normal cursor-pointer">Equipe interna</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="terceirizado" id="resp-terceirizado" />
                <Label htmlFor="resp-terceirizado" className="font-normal cursor-pointer">Empresa terceirizada</Label>
              </div>
            </RadioGroup>

            {tipoResponsavel === 'interno' ? (
              <Select value={sindicanteId} onValueChange={setSindicanteId}>
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  {sindicantes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" />{s.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Nome da empresa" value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
                <Input placeholder="Contato (telefone/email)" value={empresaContato} onChange={(e) => setEmpresaContato(e.target.value)} />
              </div>
            )}
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label>Prazo (dias)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={90}
                value={prazoDias}
                onChange={(e) => setPrazoDias(Math.min(90, Math.max(1, Number(e.target.value))))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                Vencimento: {format(addDays(new Date(), prazoDias), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={encaminharMutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => encaminharMutation.mutate()}
            disabled={encaminharMutation.isPending || !motivo || descricao.length < 50 || (tipoResponsavel === 'interno' && !sindicanteId) || (tipoResponsavel === 'terceirizado' && !empresaNome.trim())}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {encaminharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
