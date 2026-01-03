import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle2, FileText, Car, Building2 } from 'lucide-react';
import { 
  OrdemServico, 
  OrdemServicoItem, 
  TIPO_ITEM_OS_LABELS,
  TipoItemOS,
} from '@/types/database';

interface AprovarOrcamentoModalProps {
  open: boolean;
  onClose: () => void;
  ordemServico: OrdemServico;
  itens: OrdemServicoItem[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const TIPO_ITEM_COLORS: Record<TipoItemOS, string> = {
  peca: 'bg-blue-100 text-blue-800',
  mao_de_obra: 'bg-amber-100 text-amber-800',
  servico_terceiro: 'bg-purple-100 text-purple-800',
};

export function AprovarOrcamentoModal({ 
  open, 
  onClose, 
  ordemServico, 
  itens 
}: AprovarOrcamentoModalProps) {
  const queryClient = useQueryClient();
  
  // Lista de IDs dos itens aprovados (inicia com todos selecionados)
  const [itensAprovados, setItensAprovados] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  // Reset states when modal opens
  useEffect(() => {
    if (open) {
      setItensAprovados(itens.map(item => item.id));
      setObservacoes('');
    }
  }, [open, itens]);

  // Calcular valor aprovado dinamicamente
  const valorAprovado = useMemo(() => {
    return itens
      .filter(item => itensAprovados.includes(item.id))
      .reduce((acc, item) => acc + Number(item.valor_total), 0);
  }, [itens, itensAprovados]);

  // Valor total do orçamento
  const valorTotal = useMemo(() => {
    return itens.reduce((acc, item) => acc + Number(item.valor_total), 0);
  }, [itens]);

  // Toggle individual item
  const toggleItem = (itemId: string) => {
    setItensAprovados(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Toggle all items
  const toggleAll = () => {
    if (itensAprovados.length === itens.length) {
      setItensAprovados([]);
    } else {
      setItensAprovados(itens.map(item => item.id));
    }
  };

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1. Marcar itens como aprovados
      for (const itemId of itensAprovados) {
        await supabase
          .from('ordens_servico_itens')
          .update({ aprovado: true })
          .eq('id', itemId);
      }

      // 2. Marcar itens NÃO aprovados como false
      const itensNaoAprovados = itens
        .filter(item => !itensAprovados.includes(item.id))
        .map(item => item.id);
      
      for (const itemId of itensNaoAprovados) {
        await supabase
          .from('ordens_servico_itens')
          .update({ aprovado: false })
          .eq('id', itemId);
      }

      // 3. Atualizar OS
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          status: 'aprovado',
          valor_aprovado: valorAprovado,
          aprovado_por: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ordemServico.id);

      if (error) throw error;

      // 4. Histórico
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: ordemServico.id,
        status_anterior: ordemServico.status,
        status_novo: 'aprovado',
        usuario_id: userId,
        observacao: observacoes || `Orçamento aprovado: ${itensAprovados.length} de ${itens.length} itens`,
      });
    },
    onSuccess: () => {
      toast.success('Orçamento aprovado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['ordem-servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico'] });
      queryClient.invalidateQueries({ queryKey: ['os-itens'] });
      queryClient.invalidateQueries({ queryKey: ['os_itens'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar orçamento: ' + error.message);
    },
  });

  const handleAprovar = () => {
    if (itensAprovados.length === 0) {
      toast.error('Selecione pelo menos um item para aprovar');
      return;
    }
    aprovarMutation.mutate();
  };

  // Dados da OS para o resumo
  const veiculoInfo = ordemServico.veiculo 
    ? `${ordemServico.veiculo.placa || ''} - ${ordemServico.veiculo.marca || ''} ${ordemServico.veiculo.modelo || ''}`
    : 'Veículo não informado';
  
  const oficinaInfo = ordemServico.oficina?.nome_fantasia || ordemServico.oficina?.razao_social || 'Oficina não informada';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Aprovar Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo da OS */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Número:</span>
              <span>{ordemServico.numero}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Oficina:</span>
              <span>{oficinaInfo}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Veículo:</span>
              <span>{veiculoInfo}</span>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Itens do Orçamento</Label>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={itensAprovados.length === itens.length && itens.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-16">Qtd</TableHead>
                    <TableHead className="text-right w-28">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum item no orçamento
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map(item => (
                      <TableRow 
                        key={item.id}
                        className={itensAprovados.includes(item.id) ? '' : 'opacity-50'}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={itensAprovados.includes(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={TIPO_ITEM_COLORS[item.tipo]}
                          >
                            {TIPO_ITEM_OS_LABELS[item.tipo]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.descricao}>
                          {item.descricao}
                        </TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.valor_total))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totais */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Total do Orçamento</span>
              <span className="font-medium">{formatCurrency(valorTotal)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-medium">Valor dos Itens Aprovados</span>
              <span className="font-bold text-green-600">
                {formatCurrency(valorAprovado)}
              </span>
            </div>
            {itensAprovados.length < itens.length && itens.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {itensAprovados.length} de {itens.length} itens selecionados
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações sobre a aprovação (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAprovar}
            disabled={aprovarMutation.isPending || itensAprovados.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar Orçamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
