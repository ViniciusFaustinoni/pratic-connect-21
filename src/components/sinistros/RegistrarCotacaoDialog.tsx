import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CotacaoEvento } from '@/hooks/useCotacoesEvento';
import { ItemOrcamento } from '@/hooks/useVistoriaEvento';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacoesEnviadas: CotacaoEvento[];
  itensOrcamento: ItemOrcamento[];
  onSalvar: (data: {
    cotacaoId: string;
    resposta: any;
    valorTotal: number;
    prazoGeral: string;
    observacoes: string;
  }) => void;
  isSaving: boolean;
}

interface ItemResposta {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  prazo_entrega: string;
  disponibilidade: 'disponivel' | 'indisponivel' | 'sob_consulta';
}

export function RegistrarCotacaoDialog({
  open, onOpenChange, cotacoesEnviadas, itensOrcamento, onSalvar, isSaving,
}: Props) {
  const [selectedCotacaoId, setSelectedCotacaoId] = useState('');
  const [prazoGeral, setPrazoGeral] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const pecas = useMemo(
    () => itensOrcamento.filter((i) => i.tipo === 'peca'),
    [itensOrcamento]
  );

  const [itensResposta, setItensResposta] = useState<ItemResposta[]>([]);

  // Inicializar itens quando muda a seleção
  const handleSelectCotacao = (id: string) => {
    setSelectedCotacaoId(id);
    setItensResposta(
      pecas.map((p) => ({
        descricao: p.descricao,
        quantidade: p.quantidade,
        valor_unitario: 0,
        prazo_entrega: '',
        disponibilidade: 'disponivel' as const,
      }))
    );
  };

  const updateItem = (idx: number, field: keyof ItemResposta, value: any) => {
    setItensResposta((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const valorTotal = useMemo(
    () =>
      itensResposta.reduce((sum, item) => {
        if (item.disponibilidade !== 'disponivel') return sum;
        return sum + item.valor_unitario * item.quantidade;
      }, 0),
    [itensResposta]
  );

  const handleSalvar = () => {
    if (!selectedCotacaoId) return;
    onSalvar({
      cotacaoId: selectedCotacaoId,
      resposta: { itens: itensResposta },
      valorTotal,
      prazoGeral,
      observacoes,
    });
    // Reset
    setSelectedCotacaoId('');
    setItensResposta([]);
    setPrazoGeral('');
    setObservacoes('');
  };

  const pendentes = cotacoesEnviadas.filter((c) => c.status === 'enviado' || c.status === 'expirado');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Cotação Recebida</DialogTitle>
          <DialogDescription>
            Preencha os valores informados pelo auto center
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de auto center */}
          <div>
            <Label>Auto Center</Label>
            <Select value={selectedCotacaoId} onValueChange={handleSelectCotacao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o auto center" />
              </SelectTrigger>
              <SelectContent>
                {pendentes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.auto_center?.nome_fantasia || c.auto_center?.nome || 'Auto Center'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Itens */}
          {selectedCotacaoId && itensResposta.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Itens da Cotação</Label>
              {itensResposta.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.descricao}</span>
                    <span className="text-xs text-muted-foreground">Qtd: {item.quantidade}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Valor Unit. (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.valor_unitario || ''}
                        onChange={(e) => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Prazo Entrega</Label>
                      <Input
                        value={item.prazo_entrega}
                        onChange={(e) => updateItem(idx, 'prazo_entrega', e.target.value)}
                        placeholder="Ex: 2 dias"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Disponibilidade</Label>
                      <Select
                        value={item.disponibilidade}
                        onValueChange={(v) => updateItem(idx, 'disponibilidade', v)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disponivel">Disponível</SelectItem>
                          <SelectItem value="indisponivel">Indisponível</SelectItem>
                          <SelectItem value="sob_consulta">Sob consulta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedCotacaoId && (
            <>
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">Valor Total:</span>
                <span className="font-bold text-lg">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                </span>
              </div>

              <div>
                <Label>Prazo Geral de Entrega</Label>
                <Input
                  value={prazoGeral}
                  onChange={(e) => setPrazoGeral(e.target.value)}
                  placeholder="Ex: 5 dias úteis"
                />
              </div>

              <div>
                <Label>Observações do Auto Center</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações relevantes da conversa..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={!selectedCotacaoId || isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar Cotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
