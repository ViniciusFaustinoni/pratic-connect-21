import { useState, useEffect } from 'react';
import { Gift, DollarSign, Calendar, Settings, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Programa {
  id: string;
  nome: string;
  descricao?: string;
  valor_indicador: number;
  valor_indicado?: number;
  tipo_recompensa?: string;
  limite_indicacoes_mes?: number;
  prazo_validade_dias?: number;
  condicao_pagamento?: string;
  data_inicio?: string;
  data_fim?: string;
  ativo: boolean;
}

interface ConfigurarProgramaModalProps {
  open: boolean;
  onClose: () => void;
  programa?: Programa | null;
}

const tiposRecompensa = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'desconto', label: 'Desconto' },
  { value: 'credito', label: 'Crédito' },
  { value: 'brinde', label: 'Brinde' },
];

const condicoesPagamento = [
  { value: 'cadastro_aprovado', label: 'Cadastro Aprovado' },
  { value: 'primeira_mensalidade', label: 'Primeira Mensalidade Paga' },
  { value: 'terceira_mensalidade', label: 'Terceira Mensalidade Paga' },
];

export function ConfigurarProgramaModal({ open, onClose, programa }: ConfigurarProgramaModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!programa;

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorIndicador, setValorIndicador] = useState('');
  const [valorIndicado, setValorIndicado] = useState('');
  const [tipoRecompensa, setTipoRecompensa] = useState('dinheiro');
  const [limiteIndicacoes, setLimiteIndicacoes] = useState('');
  const [prazoValidade, setPrazoValidade] = useState('');
  const [condicaoPagamento, setCondicaoPagamento] = useState('primeira_mensalidade');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (programa) {
      setNome(programa.nome || '');
      setDescricao(programa.descricao || '');
      setValorIndicador(programa.valor_indicador?.toString() || '');
      setValorIndicado(programa.valor_indicado?.toString() || '');
      setTipoRecompensa(programa.tipo_recompensa || 'dinheiro');
      setLimiteIndicacoes(programa.limite_indicacoes_mes?.toString() || '');
      setPrazoValidade(programa.prazo_validade_dias?.toString() || '');
      setCondicaoPagamento(programa.condicao_pagamento || 'primeira_mensalidade');
      setDataInicio(programa.data_inicio ? new Date(programa.data_inicio) : new Date());
      setDataFim(programa.data_fim ? new Date(programa.data_fim) : undefined);
      setAtivo(programa.ativo ?? true);
    } else {
      resetForm();
    }
  }, [programa, open]);

  const resetForm = () => {
    setNome('');
    setDescricao('');
    setValorIndicador('');
    setValorIndicado('');
    setTipoRecompensa('dinheiro');
    setLimiteIndicacoes('');
    setPrazoValidade('');
    setCondicaoPagamento('primeira_mensalidade');
    setDataInicio(new Date());
    setDataFim(undefined);
    setAtivo(true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const dados = {
        nome,
        descricao: descricao || null,
        valor_indicador: parseFloat(valorIndicador) || 0,
        valor_indicado: valorIndicado ? parseFloat(valorIndicado) : null,
        tipo_recompensa: tipoRecompensa,
        limite_indicacoes_mes: limiteIndicacoes ? parseInt(limiteIndicacoes) : null,
        prazo_validade_dias: prazoValidade ? parseInt(prazoValidade) : null,
        condicao_pagamento: condicaoPagamento,
        data_inicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null,
        data_fim: dataFim ? format(dataFim, 'yyyy-MM-dd') : null,
        ativo,
      };

      if (programa?.id) {
        const { error } = await supabase
          .from('programa_indicacao')
          .update(dados)
          .eq('id', programa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('programa_indicacao')
          .insert(dados);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Programa atualizado!' : 'Programa criado!');
      queryClient.invalidateQueries({ queryKey: ['programa-indicacao'] });
      queryClient.invalidateQueries({ queryKey: ['programa-ativo'] });
      onClose();
    },
    onError: (error) => {
      toast.error('Erro ao salvar programa');
      console.error(error);
    }
  });

  const handleSubmit = () => {
    if (!nome || !valorIndicador) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            {isEditing ? 'Editar Programa' : 'Novo Programa de Indicação'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label>Nome do Programa *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Indique e Ganhe"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva as regras do programa..."
              rows={3}
            />
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor para Indicador (R$) *
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorIndicador}
                onChange={(e) => setValorIndicador(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Desconto para Indicado (R$)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorIndicado}
                onChange={(e) => setValorIndicado(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Tipo e Condição */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Recompensa</Label>
              <Select value={tipoRecompensa} onValueChange={setTipoRecompensa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposRecompensa.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {condicoesPagamento.map((cond) => (
                    <SelectItem key={cond.value} value={cond.value}>
                      {cond.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Limite Indicações/Mês</Label>
              <Input
                type="number"
                min="0"
                value={limiteIndicacoes}
                onChange={(e) => setLimiteIndicacoes(e.target.value)}
                placeholder="Sem limite"
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo de Validade (dias)</Label>
              <Input
                type="number"
                min="0"
                value={prazoValidade}
                onChange={(e) => setPrazoValidade(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Fim (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Sem fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Programa Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Programas ativos ficam visíveis para associados
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Programa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
