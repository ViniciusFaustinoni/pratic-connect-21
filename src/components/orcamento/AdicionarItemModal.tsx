import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type OrcamentoItem } from '@/hooks/useOrcamentoReparo';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<OrcamentoItem>, motivo: string) => void;
  editItem?: OrcamentoItem | null;
  defaultTipo?: 'peca' | 'mao_de_obra';
  orcamentoEmExecucao?: boolean;
  saving?: boolean;
}

export function AdicionarItemModal({ open, onClose, onSave, editItem, defaultTipo = 'peca', orcamentoEmExecucao, saving }: Props) {
  const [tipo, setTipo] = useState<'peca' | 'mao_de_obra'>(defaultTipo);
  const [descricao, setDescricao] = useState('');
  const [origem, setOrigem] = useState<string>('original');
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnitario, setValorUnitario] = useState(0);
  const [status, setStatus] = useState('pendente');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (editItem) {
      setTipo(editItem.tipo as 'peca' | 'mao_de_obra');
      setDescricao(editItem.descricao);
      setOrigem(editItem.origem || 'original');
      setQuantidade(editItem.quantidade);
      setValorUnitario(editItem.valor_unitario);
      setStatus(editItem.status);
      setObservacao(editItem.observacao || '');
      setMotivo('');
    } else {
      setTipo(defaultTipo);
      setDescricao('');
      setOrigem('original');
      setQuantidade(1);
      setValorUnitario(0);
      setStatus('pendente');
      setObservacao('');
      setMotivo('');
    }
  }, [editItem, defaultTipo, open]);

  const totalItem = quantidade * valorUnitario;
  const isEdit = !!editItem;
  const motivoObrigatorio = isEdit || orcamentoEmExecucao;

  const handleSubmit = () => {
    if (!descricao.trim()) return;
    if (motivoObrigatorio && !motivo.trim()) return;

    onSave(
      {
        tipo,
        descricao: descricao.trim(),
        origem: tipo === 'peca' ? (origem as any) : null,
        quantidade,
        valor_unitario: valorUnitario,
        status: status as any,
        observacao: observacao.trim() || null,
        motivo_inclusao: !isEdit ? motivo.trim() || null : undefined,
      },
      motivo.trim()
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Item' : 'Adicionar Item ao Orçamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as any)} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="peca" id="tipo-peca" />
                <Label htmlFor="tipo-peca">Peça</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mao_de_obra" id="tipo-mdo" />
                <Label htmlFor="tipo-mdo">Mão de Obra</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipo === 'peca' ? 'Ex: Para-choque dianteiro, Farol esquerdo...' : 'Ex: Funilaria lateral, Pintura parcial...'}
            />
          </div>

          {tipo === 'peca' && (
            <div>
              <Label>Origem da Peça *</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="seminova">Seminova</SelectItem>
                  <SelectItem value="paralela">Paralela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Valor Unitário (R$) *</Label>
              <Input type="number" min={0} step={0.01} value={valorUnitario} onChange={(e) => setValorUnitario(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="text-sm font-medium bg-muted p-2 rounded">
            Total do item: <span className="text-primary font-bold">R$ {totalItem.toFixed(2)}</span>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                {tipo === 'peca' && <SelectItem value="comprado">Comprado</SelectItem>}
                <SelectItem value="instalado">Instalado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Informações adicionais..." rows={2} />
          </div>

          {motivoObrigatorio && (
            <div>
              <Label>{isEdit ? 'O que mudou? *' : 'Motivo da inclusão *'}</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={isEdit ? 'Ex: Valor da peça reduziu — encontramos seminova por R$ 200 menos' : 'Ex: Dano oculto identificado ao desmontar painel...'}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!descricao.trim() || (motivoObrigatorio && !motivo.trim()) || saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Adicionar Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
