import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateIndicacao, useProgramaIndicacao } from '@/hooks/useMarketing';

interface IndicacaoFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function IndicacaoFormDialog({ open, onClose }: IndicacaoFormDialogProps) {
  const [indicadorNome, setIndicadorNome] = useState('');
  const [indicadorTelefone, setIndicadorTelefone] = useState('');
  const [indicadoNome, setIndicadoNome] = useState('');
  const [indicadoTelefone, setIndicadoTelefone] = useState('');
  const [indicadoEmail, setIndicadoEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: programa } = useProgramaIndicacao();
  const createMutation = useCreateIndicacao();

  const resetForm = () => {
    setIndicadorNome('');
    setIndicadorTelefone('');
    setIndicadoNome('');
    setIndicadoTelefone('');
    setIndicadoEmail('');
    setObservacoes('');
  };

  const handleSubmit = () => {
    createMutation.mutate({
      indicador_nome: indicadorNome,
      indicador_telefone: indicadorTelefone || null,
      indicado_nome: indicadoNome,
      indicado_telefone: indicadoTelefone,
      indicado_email: indicadoEmail || null,
      observacoes: observacoes || null,
      programa_id: programa?.id,
      valor_recompensa: programa?.valor_indicador,
    }, {
      onSuccess: () => {
        resetForm();
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Indicação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border-b pb-4">
            <p className="text-sm font-medium mb-3">Quem está indicando</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="indicadorNome">Nome do Indicador *</Label>
                <Input
                  id="indicadorNome"
                  value={indicadorNome}
                  onChange={(e) => setIndicadorNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indicadorTelefone">Telefone do Indicador</Label>
                <Input
                  id="indicadorTelefone"
                  value={indicadorTelefone}
                  onChange={(e) => setIndicadorTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">Quem foi indicado</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="indicadoNome">Nome do Indicado *</Label>
                <Input
                  id="indicadoNome"
                  value={indicadoNome}
                  onChange={(e) => setIndicadoNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indicadoTelefone">Telefone do Indicado *</Label>
                <Input
                  id="indicadoTelefone"
                  value={indicadoTelefone}
                  onChange={(e) => setIndicadoTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indicadoEmail">E-mail do Indicado</Label>
                <Input
                  id="indicadoEmail"
                  type="email"
                  value={indicadoEmail}
                  onChange={(e) => setIndicadoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          {programa && (
            <div className="rounded-lg bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">
                Recompensa: R$ {programa.valor_indicador.toFixed(2)}
              </p>
              <p className="text-green-600 text-xs mt-1">
                Pago após: {programa.condicao_pagamento?.replace('_', ' ') || 'conversão'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending || !indicadorNome || !indicadoNome || !indicadoTelefone}
          >
            Registrar Indicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
