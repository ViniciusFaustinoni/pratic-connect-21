import { useState, useMemo, useEffect } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAsaas } from '@/hooks/useAsaas';

interface Associado {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  status: string;
}

interface NovaCobrancaModalProps {
  open: boolean;
  onClose: () => void;
  associadoId?: string;
}

const tipoOptions = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'adesao', label: 'Adesão' },
  { value: 'taxa_instalacao', label: 'Taxa de Instalação' },
  { value: 'taxa_vistoria', label: 'Taxa de Vistoria' },
  { value: 'participacao_sinistro', label: 'Participação Sinistro' },
  { value: 'avulso', label: 'Avulso' },
  { value: 'outros', label: 'Outros' },
];

const mesesOptions = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const formatCPF = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, '') || '';
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getAnos = () => {
  const anoAtual = new Date().getFullYear();
  return [anoAtual - 1, anoAtual, anoAtual + 1];
};

export function NovaCobrancaModal({ open, onClose, associadoId }: NovaCobrancaModalProps) {
  const queryClient = useQueryClient();
  const { sincronizarCliente, criarCobranca } = useAsaas();
  const [associadoSelecionado, setAssociadoSelecionado] = useState<Associado | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [gerarBoleto, setGerarBoleto] = useState(true);
  const [formData, setFormData] = useState({
    tipo: '',
    valor: '',
    desconto: '',
    data_vencimento: '',
    mes_referencia: new Date().getMonth() + 1,
    ano_referencia: new Date().getFullYear(),
    descricao: '',
  });

  // Buscar associado por ID se fornecido
  const { data: associadoPreCarregado } = useQuery({
    queryKey: ['associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, status')
        .eq('id', associadoId)
        .single();
      if (error) throw error;
      return data as Associado;
    },
    enabled: !!associadoId,
  });

  // Setar associado pré-carregado
  useEffect(() => {
    if (associadoPreCarregado && !associadoSelecionado) {
      setAssociadoSelecionado(associadoPreCarregado);
    }
  }, [associadoPreCarregado, associadoSelecionado]);

  // Buscar associados por termo
  const { data: resultadosBusca, isLoading: buscando } = useQuery({
    queryKey: ['buscar-associados', termoBusca],
    queryFn: async () => {
      if (termoBusca.length < 2) return [];
      const { data } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, status')
        .or(`nome.ilike.%${termoBusca}%,cpf.ilike.%${termoBusca}%`)
        .eq('status', 'ativo')
        .limit(10);
      return (data || []) as Associado[];
    },
    enabled: termoBusca.length >= 2 && !associadoId && !associadoSelecionado,
  });

  // Calcular valor final
  const valorFinal = useMemo(() => {
    const valor = parseFloat(formData.valor) || 0;
    const desconto = parseFloat(formData.desconto) || 0;
    return valor - desconto;
  }, [formData.valor, formData.desconto]);

  // Mutation para criar cobrança
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetAssociadoId = associadoSelecionado?.id || associadoId;
      
      if (!targetAssociadoId) {
        throw new Error('Associado não selecionado');
      }

      const valor = parseFloat(formData.valor) || 0;
      const desconto = parseFloat(formData.desconto) || 0;
      const valorLiquido = valor - desconto;

      // Formatar competência como "MM/YYYY"
      const competencia = formData.tipo === 'mensalidade'
        ? `${String(formData.mes_referencia).padStart(2, '0')}/${formData.ano_referencia}`
        : undefined;

      if (gerarBoleto) {
        // Integração real com ASAAS
        // 1. Sincronizar cliente
        await sincronizarCliente.mutateAsync(targetAssociadoId);
        
        // 2. Criar cobrança via Edge Function
        const result = await criarCobranca.mutateAsync({
          billingType: 'UNDEFINED', // Gera boleto + PIX
          value: valorLiquido,
          dueDate: formData.data_vencimento,
          description: formData.descricao || `${formData.tipo} - ${competencia || 'avulso'}`,
          tipo: formData.tipo,
          competencia: competencia,
          associado_id: targetAssociadoId,
          desconto: desconto,
        });
        
        return result.cobranca;
      } else {
        // Cobrança local sem ASAAS
        const tempAsaasId = `local_${Date.now()}`;

        const { data, error } = await supabase
          .from('asaas_cobrancas')
          .insert({
            associado_id: targetAssociadoId,
            asaas_id: tempAsaasId,
            tipo: formData.tipo,
            valor: valor,
            desconto: desconto,
            valor_liquido: valorLiquido,
            data_vencimento: formData.data_vencimento,
            data_emissao: new Date().toISOString().split('T')[0],
            competencia: competencia,
            referencia: formData.descricao || null,
            status: 'PENDING',
            criado_por: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success(gerarBoleto ? 'Cobrança criada com boleto/PIX!' : 'Cobrança criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista'] });
      queryClient.invalidateQueries({ queryKey: ['asaas-cobrancas'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar cobrança: ' + error.message);
    },
  });

  const handleClose = () => {
    setFormData({
      tipo: '',
      valor: '',
      desconto: '',
      data_vencimento: '',
      mes_referencia: new Date().getMonth() + 1,
      ano_referencia: new Date().getFullYear(),
      descricao: '',
    });
    if (!associadoId) {
      setAssociadoSelecionado(null);
    }
    setTermoBusca('');
    setGerarBoleto(true);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const isFormValid = useMemo(() => {
    return (
      (associadoSelecionado || associadoId) &&
      formData.tipo &&
      parseFloat(formData.valor) > 0 &&
      formData.data_vencimento
    );
  }, [associadoSelecionado, associadoId, formData]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção: Buscar Associado */}
          {!associadoId && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Associado</Label>

              {!associadoSelecionado ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {buscando && (
                    <p className="text-sm text-muted-foreground">Buscando...</p>
                  )}

                  {resultadosBusca && resultadosBusca.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {resultadosBusca.map((associado) => (
                        <button
                          key={associado.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => {
                            setAssociadoSelecionado(associado);
                            setTermoBusca('');
                          }}
                        >
                          <p className="font-medium text-sm">{associado.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            CPF: {formatCPF(associado.cpf)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {termoBusca.length >= 2 && resultadosBusca?.length === 0 && !buscando && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum associado encontrado.
                    </p>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{associadoSelecionado.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            CPF: {formatCPF(associadoSelecionado.cpf)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Tel: {associadoSelecionado.telefone}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAssociadoSelecionado(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Associado pré-carregado */}
          {associadoId && associadoSelecionado && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{associadoSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      CPF: {formatCPF(associadoSelecionado.cpf)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Seção: Dados da Cobrança */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Dados da Cobrança</Label>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desconto">Desconto (R$)</Label>
                <Input
                  id="desconto"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.desconto}
                  onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Data de Vencimento *</Label>
              <Input
                id="data_vencimento"
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>

            {formData.tipo === 'mensalidade' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês Referência</Label>
                  <Select
                    value={String(formData.mes_referencia)}
                    onValueChange={(value) =>
                      setFormData({ ...formData, mes_referencia: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mesesOptions.map((mes) => (
                        <SelectItem key={mes.value} value={String(mes.value)}>
                          {mes.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano Referência</Label>
                  <Select
                    value={String(formData.ano_referencia)}
                    onValueChange={(value) =>
                      setFormData({ ...formData, ano_referencia: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAnos().map((ano) => (
                        <SelectItem key={ano} value={String(ano)}>
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição ou observações sobre a cobrança..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          {/* Card de Resumo */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Resumo</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor original:</span>
                  <span>{formatCurrency(parseFloat(formData.valor) || 0)}</span>
                </div>
                {parseFloat(formData.desconto) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto:</span>
                    <span>- {formatCurrency(parseFloat(formData.desconto) || 0)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-base">
                  <span>Valor Final:</span>
                  <span>{formatCurrency(valorFinal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checkbox ASAAS */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="gerar-boleto"
              checked={gerarBoleto}
              onCheckedChange={(checked) => setGerarBoleto(checked as boolean)}
            />
            <Label htmlFor="gerar-boleto" className="text-sm cursor-pointer">
              Gerar boleto no ASAAS automaticamente
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isFormValid || createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar Cobrança'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
