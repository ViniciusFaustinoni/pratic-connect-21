import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Negativacao {
  id: string;
  valor: number;
  orgao: string;
  data_negativacao: string | null;
  associado: {
    nome: string;
    cpf: string;
  };
}

interface BaixarNegativacaoModalProps {
  open: boolean;
  onClose: () => void;
  negativacao: Negativacao | null;
}

const motivosBaixa = [
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'acordo', label: 'Acordo' },
  { value: 'erro', label: 'Erro de cadastro' },
  { value: 'outro', label: 'Outro' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatCPF = (cpf: string) => {
  return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '';
};

export function BaixarNegativacaoModal({ open, onClose, negativacao }: BaixarNegativacaoModalProps) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [observacao, setObservacao] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setMotivo('');
      setProtocolo('');
      setObservacao('');
    }
  }, [open]);

  const baixarMutation = useMutation({
    mutationFn: async () => {
      if (!negativacao) return;

      const user = await supabase.auth.getUser();
      const motivoCompleto = observacao ? `${motivo} - ${observacao}` : motivo;

      const { error } = await supabase
        .from('negativacoes')
        .update({
          status: 'baixado',
          data_baixa: new Date().toISOString(),
          protocolo_baixa: protocolo || null,
          motivo_baixa: motivoCompleto,
          baixado_por: user.data.user?.id
        })
        .eq('id', negativacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Negativação baixada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['negativacoes'] });
      onClose();
    },
    onError: () => {
      toast.error('Erro ao baixar negativação');
    }
  });

  if (!negativacao) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar Negativação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Card */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Associado</span>
                <span className="font-medium">{negativacao.associado?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CPF</span>
                <span>{formatCPF(negativacao.associado?.cpf)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-medium">{formatCurrency(negativacao.valor)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Órgão</span>
                <Badge variant="outline">{negativacao.orgao}</Badge>
              </div>
              {negativacao.data_negativacao && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data Negativação</span>
                  <span>{format(new Date(negativacao.data_negativacao), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Baixa *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosBaixa.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="protocolo">Protocolo de Baixa</Label>
              <Input
                id="protocolo"
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
                placeholder="Número do protocolo..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => baixarMutation.mutate()} 
            disabled={!motivo || baixarMutation.isPending}
          >
            {baixarMutation.isPending ? 'Processando...' : 'Confirmar Baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
