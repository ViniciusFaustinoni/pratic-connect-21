import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCotacoesItem,
  useAdicionarCotacao,
  useSelecionarCotacao,
  useRemoverCotacao,
  type CotacaoPeca,
} from '@/hooks/useOrcamentoReparo';

interface Props {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemDescricao: string;
  canEdit?: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  original: 'Original',
  seminova: 'Seminova',
  paralela: 'Paralela',
};

export function CotacoesPecaModal({ open, onClose, itemId, itemDescricao, canEdit = true }: Props) {
  const { data: cotacoes = [], isLoading } = useCotacoesItem(itemId);
  const adicionarCotacao = useAdicionarCotacao();
  const selecionarCotacao = useSelecionarCotacao();
  const removerCotacao = useRemoverCotacao();

  const [showForm, setShowForm] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [tipoPeca, setTipoPeca] = useState('');
  const [valor, setValor] = useState('');
  const [prazo, setPrazo] = useState('');
  const [obs, setObs] = useState('');

  const resetForm = () => {
    setFornecedor(''); setTipoPeca(''); setValor(''); setPrazo(''); setObs('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!fornecedor) { toast.error('Informe o fornecedor'); return; }
    try {
      await adicionarCotacao.mutateAsync({
        itemId,
        cotacao: {
          fornecedor,
          tipo_peca: tipoPeca || undefined,
          valor: parseFloat(valor) || undefined,
          prazo_entrega: prazo || undefined,
          observacao: obs || undefined,
          selecionada: cotacoes.length === 0, // auto-selecionar se primeira
        },
      });
      toast.success('Cotação adicionada!');
      resetForm();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleSelect = async (cotacao: CotacaoPeca) => {
    try {
      await selecionarCotacao.mutateAsync({ cotacao, itemId });
      toast.success('Cotação selecionada!');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleRemove = async (cotacaoId: string) => {
    try {
      await removerCotacao.mutateAsync({ cotacaoId, itemId });
      toast.success('Cotação removida!');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cotações — {itemDescricao}</DialogTitle>
        </DialogHeader>

        {cotacoes.length < 3 && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Recomendável pelo menos 3 cotações (art. 11.3 do regulamento)</span>
          </div>
        )}

        {cotacoes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead className="text-center">Selecionada</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotacoes.map((c) => (
                <TableRow key={c.id} className={c.selecionada ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">{c.fornecedor}</TableCell>
                  <TableCell>
                    {c.tipo_peca && (
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_LABEL[c.tipo_peca] || c.tipo_peca}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.valor ? `R$ ${c.valor.toFixed(2)}` : '—'}</TableCell>
                  <TableCell className="text-xs">{c.prazo_entrega || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{c.observacao || '—'}</TableCell>
                  <TableCell className="text-center">
                    <input
                      type="radio"
                      name="cotacao-selecionada"
                      checked={c.selecionada}
                      onChange={() => handleSelect(c)}
                      disabled={!canEdit}
                      className="cursor-pointer"
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {cotacoes.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cotação registrada.</p>
        )}

        {/* Formulário de nova cotação */}
        {canEdit && showForm && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Nova Cotação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fornecedor *</Label>
                <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Tipo da peça</Label>
                <Select value={tipoPeca} onValueChange={setTipoPeca}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="seminova">Seminova</SelectItem>
                    <SelectItem value="paralela">Paralela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Prazo de entrega</Label>
                <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex: 2 dias" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: Inclui frete, só aceita PIX..." className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={adicionarCotacao.isPending}>
                {adicionarCotacao.isPending ? 'Salvando...' : 'Adicionar'}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {canEdit && !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Cotação
            </Button>
          )}
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
