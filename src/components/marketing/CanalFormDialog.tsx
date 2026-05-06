import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCanal, useUpdateCanal, CanalMarketing } from '@/hooks/useMarketing';

interface CanalFormDialogProps {
  open: boolean;
  onClose: () => void;
  canal?: CanalMarketing | null;
}

const tipos = [
  { value: 'organico', label: 'Orgânico' },
  { value: 'pago', label: 'Pago' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'E-mail' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'parceria', label: 'Parceria' },
  { value: 'outro', label: 'Outro' },
];

export function CanalFormDialog({ open, onClose, canal }: CanalFormDialogProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('organico');
  const [descricao, setDescricao] = useState('');
  const [custoPorLead, setCustoPorLead] = useState('');
  const [metaLeadsMes, setMetaLeadsMes] = useState('');
  const [ativo, setAtivo] = useState(true);

  const createMutation = useCreateCanal();
  const updateMutation = useUpdateCanal();

  const isEditing = !!canal;

  useEffect(() => {
    if (canal) {
      setNome(canal.nome);
      setTipo(canal.tipo);
      setDescricao(canal.descricao || '');
      setCustoPorLead(canal.custo_por_lead?.toString() || '');
      setMetaLeadsMes(canal.meta_leads_mes?.toString() || '');
      setAtivo(canal.ativo);
    } else {
      setNome('');
      setTipo('organico');
      setDescricao('');
      setCustoPorLead('');
      setMetaLeadsMes('');
      setAtivo(true);
    }
  }, [canal, open]);

  const handleSubmit = () => {
    const payload = {
      nome,
      tipo,
      descricao: descricao || undefined,
      custo_por_lead: custoPorLead ? parseFloat(custoPorLead) : undefined,
      meta_leads_mes: metaLeadsMes ? parseInt(metaLeadsMes) : undefined,
      ativo,
    };

    if (isEditing && canal) {
      updateMutation.mutate({ id: canal.id, ...payload }, { onSuccess: () => onClose() });
    } else {
      createMutation.mutate(payload, { onSuccess: () => onClose() });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Google Ads"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipos.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custo">Custo por Lead (R$)</Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                value={custoPorLead}
                onChange={(e) => setCustoPorLead(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta">Meta de Leads/Mês</Label>
              <Input
                id="meta"
                type="number"
                value={metaLeadsMes}
                onChange={(e) => setMetaLeadsMes(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="ativo">Canal ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !nome}>
            {isEditing ? 'Salvar' : 'Criar Canal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
