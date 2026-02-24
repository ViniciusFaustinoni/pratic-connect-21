import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, ChevronDown, Plus, Save, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { OrcamentoReparo } from '@/hooks/useOrcamentoReparo';
import { useAtualizarPacote } from '@/hooks/useOrcamentoReparo';

interface Oficina {
  id: string;
  nome: string;
  endereco?: string;
  telefone?: string;
}

interface DetalheItem {
  descricao: string;
  tipo: 'peca' | 'mao_de_obra' | 'material';
  valor_estimado: number;
}

interface Props {
  orcamento: OrcamentoReparo;
  valorFipe?: number;
  canEdit: boolean;
  oficinas?: Oficina[];
  oficinaNome?: string;
}

const FORMAS_PAGAMENTO = [
  { value: 'a_vista', label: 'À vista após conclusão' },
  { value: '50_50', label: '50% entrada + 50% na entrega' },
  { value: 'faturado', label: 'Faturado (30 dias)' },
  { value: 'outro', label: 'Outro' },
];

export function FormPacoteFechado({ orcamento, valorFipe, canEdit, oficinas = [], oficinaNome }: Props) {
  const atualizarPacote = useAtualizarPacote();

  const [valorPacote, setValorPacote] = useState(orcamento.valor_pacote?.toString() || '');
  const [descricao, setDescricao] = useState(orcamento.descricao_pacote || '');
  const [prazo, setPrazo] = useState(orcamento.prazo_estimado_dias?.toString() || '');
  const [formaPagamento, setFormaPagamento] = useState(orcamento.forma_pagamento || '');
  const [obsNegociacao, setObsNegociacao] = useState(orcamento.observacao_negociacao || '');
  const [oficinaId, setOficinaId] = useState(orcamento.oficina_id || '');
  const [detalhes, setDetalhes] = useState<DetalheItem[]>(
    (orcamento.detalhamento_pacote as DetalheItem[]) || []
  );
  const [showDetalhes, setShowDetalhes] = useState(detalhes.length > 0);
  const [motivoEdicao, setMotivoEdicao] = useState('');
  const [editandoValor, setEditandoValor] = useState(false);

  const isConsolidado = orcamento.status === 'consolidado';
  const isExecucao = orcamento.status === 'execucao';
  const valorNum = parseFloat(valorPacote) || 0;
  const limiteFipe = valorFipe ? valorFipe * 0.75 : null;
  const pctFipe = valorFipe && valorFipe > 0 ? (valorNum / valorFipe) * 100 : 0;
  const alertaFipe = limiteFipe ? valorNum > limiteFipe : false;

  const handleSave = async () => {
    if (!valorPacote || !descricao) {
      toast.error('Preencha o valor e a descrição do pacote');
      return;
    }

    const dadosAnteriores = isExecucao ? {
      valor_pacote: orcamento.valor_pacote,
      descricao_pacote: orcamento.descricao_pacote,
      prazo_estimado_dias: orcamento.prazo_estimado_dias,
      forma_pagamento: orcamento.forma_pagamento,
    } : undefined;

    try {
      await atualizarPacote.mutateAsync({
        orcamentoId: orcamento.id,
        dados: {
          valor_pacote: valorNum,
          descricao_pacote: descricao,
          prazo_estimado_dias: parseInt(prazo) || null,
          forma_pagamento: formaPagamento || null,
          observacao_negociacao: obsNegociacao || null,
          detalhamento_pacote: detalhes.length > 0 ? detalhes : null,
          oficina_id: oficinaId || null,
        },
        motivo: editandoValor ? motivoEdicao : undefined,
        dadosAnteriores,
      });
      toast.success('Pacote salvo com sucesso!');
      setEditandoValor(false);
      setMotivoEdicao('');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const addDetalhe = () => {
    setDetalhes([...detalhes, { descricao: '', tipo: 'peca', valor_estimado: 0 }]);
  };

  const removeDetalhe = (idx: number) => {
    setDetalhes(detalhes.filter((_, i) => i !== idx));
  };

  const updateDetalhe = (idx: number, field: keyof DetalheItem, value: any) => {
    const copy = [...detalhes];
    copy[idx] = { ...copy[idx], [field]: value };
    setDetalhes(copy);
  };

  const readOnly = isConsolidado || !canEdit;

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border p-3 text-center bg-primary/5">
          <p className="text-xs text-muted-foreground">Valor do Pacote</p>
          <p className="text-lg font-bold text-primary">
            {valorNum > 0 ? `R$ ${valorNum.toFixed(2)}` : '—'}
          </p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Oficina</p>
          <p className="text-sm font-medium truncate">{oficinaNome || oficinas.find(o => o.id === oficinaId)?.nome || '—'}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Prazo</p>
          <p className="text-lg font-bold">{prazo ? `${prazo} dias` : '—'}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">% da FIPE</p>
          <p className={`text-lg font-bold ${pctFipe > 75 ? 'text-red-600' : pctFipe > 50 ? 'text-amber-600' : 'text-green-600'}`}>
            {pctFipe > 0 ? `${pctFipe.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* FIPE alert */}
      {alertaFipe && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span><strong>ATENÇÃO:</strong> O valor do pacote ultrapassou 75% da FIPE. Pode configurar Perda Total.</span>
        </div>
      )}

      {/* Oficina */}
      {oficinas.length > 0 && !readOnly && (
        <div>
          <Label>Oficina Responsável</Label>
          <Select value={oficinaId} onValueChange={setOficinaId} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Selecione a oficina" /></SelectTrigger>
            <SelectContent>
              {oficinas.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Valor e descrição */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Valor total do pacote *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              type="number"
              step="0.01"
              value={valorPacote}
              onChange={(e) => setValorPacote(e.target.value)}
              className="pl-10"
              disabled={readOnly && !editandoValor}
              placeholder="0,00"
            />
          </div>
        </div>
        <div>
          <Label>Prazo estimado (dias úteis)</Label>
          <Input
            type="number"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            disabled={readOnly}
            placeholder="Ex: 15"
          />
        </div>
      </div>

      <div>
        <Label>O que está incluído no pacote *</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={readOnly}
          placeholder="Descreva os serviços e peças incluídos no pacote. Ex: Troca de para-choque dianteiro (peça paralela), funilaria lateral esquerda, pintura parcial capô..."
          rows={3}
        />
      </div>

      <div>
        <Label>Forma de pagamento</Label>
        <Select value={formaPagamento} onValueChange={setFormaPagamento} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGAMENTO.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Observações da negociação (opcional)</Label>
        <Textarea
          value={obsNegociacao}
          onChange={(e) => setObsNegociacao(e.target.value)}
          disabled={readOnly}
          placeholder="Ex: Oficina deu 10% de desconto por ser parceira..."
          rows={2}
        />
      </div>

      {/* Detalhamento opcional */}
      <Collapsible open={showDetalhes} onOpenChange={setShowDetalhes}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform ${showDetalhes ? 'rotate-180' : ''}`} />
            Detalhar composição do pacote (opcional)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <p className="text-xs text-muted-foreground mb-2">
            O total dos itens abaixo NÃO precisa ser igual ao valor do pacote. É apenas uma estimativa para controle interno.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor Estimado</TableHead>
                {!readOnly && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalhes.map((d, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={d.descricao}
                      onChange={(e) => updateDetalhe(idx, 'descricao', e.target.value)}
                      placeholder="Ex: Para-choque dianteiro"
                      className="h-8 text-sm"
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={d.tipo} onValueChange={(v) => updateDetalhe(idx, 'tipo', v)} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="peca">Peça</SelectItem>
                        <SelectItem value="mao_de_obra">Mão de Obra</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={d.valor_estimado || ''}
                      onChange={(e) => updateDetalhe(idx, 'valor_estimado', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                      disabled={readOnly}
                    />
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDetalhe(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-2" onClick={addDetalhe}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Item
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Comparativo FIPE */}
      {valorFipe && valorFipe > 0 && valorNum > 0 && (
        <div className={`p-3 rounded-md border text-sm ${alertaFipe ? 'bg-red-50 border-red-200' : 'bg-muted/50'}`}>
          <div className="flex justify-between">
            <span>Valor FIPE:</span>
            <span>R$ {valorFipe.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Limite 75% (PT):</span>
            <span>R$ {limiteFipe?.toFixed(0)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Valor do pacote:</span>
            <span>R$ {valorNum.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>% da FIPE:</span>
            <span className={`flex items-center gap-1 ${alertaFipe ? 'text-red-600 font-medium' : 'text-green-600'}`}>
              {pctFipe.toFixed(1)}% {alertaFipe ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
            </span>
          </div>
        </div>
      )}

      {/* Edição de valor com motivo */}
      {isExecucao && canEdit && !editandoValor && orcamento.valor_pacote && (
        <Button variant="outline" size="sm" onClick={() => setEditandoValor(true)}>
          Editar Valor do Pacote
        </Button>
      )}

      {editandoValor && (
        <div>
          <Label>Motivo da alteração de valor *</Label>
          <Textarea
            value={motivoEdicao}
            onChange={(e) => setMotivoEdicao(e.target.value)}
            placeholder="Ex: Dano oculto encontrado ao desmontar — oficina solicitou adicional..."
            rows={2}
          />
        </div>
      )}

      {/* Botões */}
      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={atualizarPacote.isPending || (editandoValor && !motivoEdicao)}>
            <Save className="h-4 w-4 mr-1" />
            {atualizarPacote.isPending ? 'Salvando...' : 'Salvar Pacote'}
          </Button>
        </div>
      )}
    </div>
  );
}
