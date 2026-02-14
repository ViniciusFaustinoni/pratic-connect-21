import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { PecaSelectFields, PecaSelectValues } from '@/components/oficinas/PecaSelectFields';

const ETAPAS_REPARO = [
  { id: 'lanternagem', nome: 'Lanternagem', descricao: 'Chaparia e estrutura da carroceria' },
  { id: 'pintura', nome: 'Pintura', descricao: 'Aplicação de primer, tinta e verniz' },
  { id: 'mecanica', nome: 'Mecânica', descricao: 'Reparos no motor, câmbio, suspensão' },
  { id: 'eletrica', nome: 'Elétrica', descricao: 'Fiação, módulos, sensores, faróis' },
  { id: 'polimento', nome: 'Polimento', descricao: 'Acabamento final da pintura' },
  { id: 'lavagem', nome: 'Lavagem', descricao: 'Limpeza completa antes da entrega' },
] as const;

interface ItemOrcamento {
  descricao: string;
  tipo: 'peca' | 'mao_de_obra' | 'servico';
  valor_unitario: number;
  quantidade: number;
  valor_total: number;
  // Structured peca fields
  tipo_peca?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: string;
}

const defaultPecaValues: PecaSelectValues = {
  tipoPeca: '', marcaCodigo: '', marcaNome: '', modeloCodigo: '', modeloNome: '', anoCodigo: '', anoNome: '',
};

interface VistoriaEventoOrcamentoProps {
  open: boolean;
  onClose: () => void;
  vistoriaId: string;
  sinistroId: string;
  valorFipe: number | null;
}

export function VistoriaEventoOrcamento({
  open,
  onClose,
  vistoriaId,
  sinistroId,
  valorFipe,
}: VistoriaEventoOrcamentoProps) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Diagnóstico
  const [tipoDano, setTipoDano] = useState<'parcial' | 'total' | ''>('');
  const [descricaoTecnica, setDescricaoTecnica] = useState('');
  const [observacoesTotal, setObservacoesTotal] = useState('');
  const [etapasReparo, setEtapasReparo] = useState<string[]>([]);

  // Orçamento
  const [itens, setItens] = useState<ItemOrcamento[]>([
    { descricao: '', tipo: 'peca', valor_unitario: 0, quantidade: 1, valor_total: 0 },
  ]);
  // PecaSelectFields values per item index
  const [pecaValuesMap, setPecaValuesMap] = useState<Record<number, PecaSelectValues>>({
    0: { ...defaultPecaValues },
  });

  // Parecer
  const [parecerTecnico, setParecerTecnico] = useState('');
  const [recomendacao, setRecomendacao] = useState<'aprovar' | 'analise_detalhada' | ''>('');

  // Only sum non-peca items (peças don't have valor)
  const valorTotal = itens.reduce((sum, item) => sum + (item.tipo !== 'peca' ? item.valor_total : 0), 0);

  const handleItemChange = (index: number, field: keyof ItemOrcamento, value: any) => {
    setItens((prev) => {
      const novos = [...prev];
      (novos[index] as any)[field] = value;
      if (field === 'valor_unitario' || field === 'quantidade') {
        novos[index].valor_total = novos[index].valor_unitario * novos[index].quantidade;
      }
      // When switching to peca, clear value fields; when switching away, clear peca fields
      if (field === 'tipo') {
        if (value === 'peca') {
          novos[index].valor_unitario = 0;
          novos[index].quantidade = 1;
          novos[index].valor_total = 0;
          novos[index].descricao = '';
          setPecaValuesMap(prev => ({ ...prev, [index]: { ...defaultPecaValues } }));
        } else {
          novos[index].tipo_peca = undefined;
          novos[index].veiculo_marca = undefined;
          novos[index].veiculo_modelo = undefined;
          novos[index].veiculo_ano = undefined;
          setPecaValuesMap(prev => {
            const copy = { ...prev };
            delete copy[index];
            return copy;
          });
        }
      }
      return novos;
    });
  };

  const handlePecaValuesChange = (index: number, pv: PecaSelectValues) => {
    setPecaValuesMap(prev => ({ ...prev, [index]: pv }));
    // Update structured fields on the item
    setItens(prev => {
      const novos = [...prev];
      novos[index].tipo_peca = pv.tipoPeca;
      novos[index].veiculo_marca = pv.marcaNome;
      novos[index].veiculo_modelo = pv.modeloNome;
      novos[index].veiculo_ano = pv.anoNome;
      novos[index].descricao = pv.tipoPeca
        ? `${pv.tipoPeca}${pv.marcaNome ? ` - ${pv.marcaNome}` : ''}${pv.modeloNome ? ` ${pv.modeloNome}` : ''}${pv.anoNome ? ` ${pv.anoNome}` : ''}`
        : '';
      return novos;
    });
  };

  const adicionarItem = () => {
    const newIndex = itens.length;
    setItens((prev) => [...prev, { descricao: '', tipo: 'peca', valor_unitario: 0, quantidade: 1, valor_total: 0 }]);
    setPecaValuesMap(prev => ({ ...prev, [newIndex]: { ...defaultPecaValues } }));
  };

  const removerItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
    setPecaValuesMap(prev => {
      const newMap: Record<number, PecaSelectValues> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const key = parseInt(k);
        if (key < index) newMap[key] = v;
        else if (key > index) newMap[key - 1] = v;
      });
      return newMap;
    });
  };

  const handleFinalizar = async () => {
    if (!tipoDano) {
      toast.error('Selecione o tipo de dano');
      return;
    }
    if (!descricaoTecnica.trim()) {
      toast.error('Preencha a descrição técnica');
      return;
    }
    if (!parecerTecnico.trim()) {
      toast.error('Preencha o parecer técnico');
      return;
    }
    if (!recomendacao) {
      toast.error('Selecione a recomendação');
      return;
    }
    if (tipoDano === 'parcial' && etapasReparo.length === 0) {
      toast.error('Selecione pelo menos uma etapa de reparo');
      return;
    }
    if (tipoDano === 'parcial' && itens.length === 0) {
      toast.error('Adicione pelo menos um item ao orçamento');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const dados = {
        tipo_dano: tipoDano,
        descricao_tecnica: descricaoTecnica,
        itens_orcamento: tipoDano === 'parcial' ? itens : [],
        valor_total_orcamento: tipoDano === 'parcial' ? valorTotal : 0,
        parecer_tecnico: parecerTecnico,
        recomendacao: recomendacao,
        observacoes_perda_total: tipoDano === 'total' ? observacoesTotal : null,
        etapas_reparo: tipoDano === 'parcial'
          ? ETAPAS_REPARO
              .filter(e => etapasReparo.includes(e.id))
              .map(e => ({
                id: e.id,
                nome: e.nome,
                selecionada: true,
                status: 'pendente' as const,
              }))
          : [],
      };

      const formData = new FormData();
      formData.append('acao', 'finalizar');
      formData.append('vistoria_id', vistoriaId);
      formData.append('dados', JSON.stringify(dados));

      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/salvar-vistoria-regulador`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao finalizar');
      }

      toast.success('Vistoria finalizada com sucesso!');
      navigate('/regulador/vistorias');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao finalizar vistoria');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-full max-h-full sm:max-w-2xl sm:max-h-[90vh] sm:h-auto p-0 gap-0 rounded-none sm:rounded-lg">
        <DialogHeader className="px-4 pt-4 pb-2 border-b sticky top-0 bg-background z-10">
          <DialogTitle>Orçamento da Vistoria</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto p-4 space-y-6 flex-1">
          {/* Diagnóstico */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Diagnóstico</h3>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de dano</Label>
              <Select value={tipoDano} onValueChange={(v) => setTipoDano(v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="total">Total (≥ 75% FIPE)</SelectItem>
                </SelectContent>
              </Select>
              {valorFipe && tipoDano === 'total' && (
                <p className="text-xs text-muted-foreground">
                  Valor FIPE: R$ {Number(valorFipe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição técnica dos danos</Label>
              <Textarea
                value={descricaoTecnica}
                onChange={(e) => setDescricaoTecnica(e.target.value)}
                placeholder="Descreva tecnicamente os danos observados..."
                rows={3}
              />
            </div>

            {tipoDano === 'total' && (
              <div className="space-y-1">
                <Label className="text-xs">Observações de perda total</Label>
                <Textarea
                  value={observacoesTotal}
                  onChange={(e) => setObservacoesTotal(e.target.value)}
                  placeholder="Observações adicionais sobre a perda total..."
                  rows={3}
                />
              </div>
            )}
          </section>

          {/* Etapas do Reparo - apenas para parcial */}
          {tipoDano === 'parcial' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Etapas Necessárias para o Reparo</h3>

              <div className="space-y-2">
                {ETAPAS_REPARO.map((etapa) => (
                  <label
                    key={etapa.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={etapasReparo.includes(etapa.id)}
                      onCheckedChange={(checked) => {
                        setEtapasReparo((prev) =>
                          checked
                            ? [...prev, etapa.id]
                            : prev.filter((id) => id !== etapa.id)
                        );
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{etapa.nome}</span>
                      <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
                    </div>
                  </label>
                ))}
              </div>

              {etapasReparo.length > 0 && (
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-1.5">Sequência de execução:</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {ETAPAS_REPARO.filter((e) => etapasReparo.includes(e.id)).map((etapa, i, arr) => (
                      <span key={etapa.id} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">{etapa.nome}</Badge>
                        {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Itens do Orçamento - apenas para parcial */}
          {tipoDano === 'parcial' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Itens do Orçamento</h3>

              {itens.map((item, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                    {itens.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerItem(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <Select value={item.tipo} onValueChange={(v) => handleItemChange(i, 'tipo', v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="peca">Peça</SelectItem>
                      <SelectItem value="mao_de_obra">Mão de Obra</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>

                  {item.tipo === 'peca' ? (
                    <PecaSelectFields
                      values={pecaValuesMap[i] || defaultPecaValues}
                      onChange={(pv) => handlePecaValuesChange(i, pv)}
                      active={open}
                    />
                  ) : (
                    <>
                      <Input
                        placeholder="Descrição do serviço"
                        value={item.descricao}
                        onChange={(e) => handleItemChange(i, 'descricao', e.target.value)}
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Vlr. Unit.</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.valor_unitario || ''}
                            onChange={(e) => handleItemChange(i, 'valor_unitario', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Qtd.</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantidade || ''}
                            onChange={(e) => handleItemChange(i, 'quantidade', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Total</Label>
                          <Input
                            value={`R$ ${item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={adicionarItem} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>

              {valorTotal > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-muted px-3 py-2">
                  <span className="text-sm font-semibold">Total (Serviços/Mão de Obra)</span>
                  <span className="text-lg font-bold">
                    R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Parecer */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Parecer do Regulador</h3>

            <div className="space-y-1">
              <Label className="text-xs">Parecer técnico</Label>
              <Textarea
                value={parecerTecnico}
                onChange={(e) => setParecerTecnico(e.target.value)}
                placeholder="Conclusão técnica da vistoria..."
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Recomendação</Label>
              <Select value={recomendacao} onValueChange={(v) => setRecomendacao(v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovar">Recomendar Aprovação</SelectItem>
                  <SelectItem value="analise_detalhada">Recomendar Análise Detalhada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        {/* Footer fixo */}
        <div className="border-t p-4 sticky bottom-0 bg-background">
          <Button
            className="w-full"
            size="lg"
            onClick={handleFinalizar}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Finalizando...
              </>
            ) : (
              'Finalizar Vistoria e Enviar Orçamento'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
