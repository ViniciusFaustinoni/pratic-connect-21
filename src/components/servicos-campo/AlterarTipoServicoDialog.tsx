import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { registrarLog } from '@/hooks/useAuditLog';
import { TIPO_SERVICO_LABELS, type TipoServico } from '@/hooks/useServicos';

// Conjunto canônico de tipos elegíveis (pré-execução) — alinhado ao escopo aprovado.
// Subconjunto do enum do banco (tipo_servico) — exclui aliases legacy e tipo_sinistro.
type TipoServicoDB =
  | 'instalacao' | 'vistoria_entrada' | 'vistoria_manutencao'
  | 'vistoria_retirada' | 'revistoria' | 'vistoria_periodica' | 'vistoria_saida';

const TIPOS_ELEGIVEIS: TipoServicoDB[] = [
  'instalacao',
  'vistoria_entrada',
  'vistoria_manutencao',
  'vistoria_retirada',
  'revistoria',
  'vistoria_periodica',
  'vistoria_saida',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  tipoAtual: TipoServico;
  servicoLabel?: string;
  onSuccess?: () => void;
}

export function AlterarTipoServicoDialog({
  open, onOpenChange, servicoId, tipoAtual, servicoLabel, onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [novoTipo, setNovoTipo] = useState<TipoServico | ''>('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const opcoes = TIPOS_ELEGIVEIS.filter((t) => t !== tipoAtual);

  const handleConfirmar = async () => {
    if (!novoTipo) {
      toast.error('Selecione o novo tipo de serviço');
      return;
    }
    if (motivo.trim().length < 5) {
      toast.error('Informe um motivo (mín. 5 caracteres)');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ tipo: novoTipo })
        .eq('id', servicoId);

      if (error) throw error;

      await registrarLog({
        acao: 'editar',
        modulo: 'monitoramento',
        descricao: `Tipo de serviço alterado: ${TIPO_SERVICO_LABELS[tipoAtual]} → ${TIPO_SERVICO_LABELS[novoTipo]}. Motivo: ${motivo.trim()}`,
        entidade_id: servicoId,
        tabela: 'servicos',
        dados_anteriores: { tipo: tipoAtual },
        dados_novos: { tipo: novoTipo, motivo: motivo.trim() },
      });

      toast.success(`Tipo alterado para "${TIPO_SERVICO_LABELS[novoTipo]}"`);
      await qc.invalidateQueries({ queryKey: ['servicos'] });
      await qc.invalidateQueries({ queryKey: ['servico', servicoId] });
      onOpenChange(false);
      setNovoTipo('');
      setMotivo('');
      onSuccess?.();
    } catch (e: any) {
      console.error('[AlterarTipoServico] erro', e);
      toast.error(e?.message || 'Falha ao alterar tipo do serviço');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Alterar tipo do serviço
          </DialogTitle>
          <DialogDescription>
            Use quando o tipo foi atribuído errado. Disponível apenas antes da execução.
            {servicoLabel && <> · <span className="font-medium">{servicoLabel}</span></>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo atual</Label>
            <div className="text-sm rounded-md border bg-muted/40 px-3 py-2">
              {TIPO_SERVICO_LABELS[tipoAtual]}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="novo-tipo">Novo tipo *</Label>
            <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoServico)}>
              <SelectTrigger id="novo-tipo">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_SERVICO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo da correção *</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Tipo registrado como Instalação, mas trata-se de Retirada do rastreador."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={saving || !novoTipo}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Confirmar alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
