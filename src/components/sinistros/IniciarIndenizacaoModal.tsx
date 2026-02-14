import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, DollarSign, AlertTriangle } from 'lucide-react';

interface IniciarIndenizacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  veiculoId: string;
  protocolo: string;
  valorFipe?: number | null;
}

const DEPRECIACOES = [
  { key: 'chassi_remarcado', label: 'Chassi remarcado', percentual: 30 },
  { key: 'aplicativo', label: 'Uso em aplicativo (Uber, 99, etc)', percentual: 25 },
  { key: 'leilao', label: 'Veículo de leilão', percentual: 30 },
  { key: 'avarias', label: 'Avarias pré-existentes', percentual: 20 },
];

const DOCUMENTOS_INDENIZACAO = [
  { tipo: 'crv_transferencia', nome: 'CRV preenchido a favor da Pratic', obrigatorio: true },
  { tipo: 'procuracao_publica', nome: 'Procuração Pública', obrigatorio: true },
  { tipo: 'quitacao_financiamento', nome: 'Comprovante Quitação Financiamento', obrigatorio: false },
  { tipo: 'certidao_negativa_furto', nome: 'Certidão Negativa de Furto', obrigatorio: true },
  { tipo: 'extrato_detran', nome: 'Extrato DETRAN com queixa', obrigatorio: true },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function IniciarIndenizacaoModal({
  open, onOpenChange, sinistroId, veiculoId, protocolo, valorFipe,
}: IniciarIndenizacaoModalProps) {
  const queryClient = useQueryClient();
  const [depreciacoes, setDepreciacoes] = useState<Record<string, boolean>>({});
  const [observacoes, setObservacoes] = useState('');

  const totalDepreciacao = DEPRECIACOES.reduce((acc, dep) => {
    return acc + (depreciacoes[dep.key] ? dep.percentual : 0);
  }, 0);

  const valorBase = valorFipe || 0;
  const valorFinal = valorBase * (1 - totalDepreciacao / 100);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // 1. Atualizar sinistro para aguardando_pagamento
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: 'aguardando_pagamento' as any,
          tipo_dano: 'perda_total',
          valor_indenizacao: valorFinal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw new Error('Erro ao atualizar sinistro: ' + updateError.message);

      // 2. Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: 'em_recuperacao',
        status_novo: 'aguardando_pagamento',
        usuario_id: user.id,
        observacao: `Indenização integral iniciada. Valor FIPE: ${formatCurrency(valorBase)}, Depreciações: ${totalDepreciacao}%, Valor final: ${formatCurrency(valorFinal)}. ${observacoes}`,
      });

      // 3. Criar documentos pendentes de indenização
      const docsToInsert = DOCUMENTOS_INDENIZACAO.map(doc => ({
        sinistro_id: sinistroId,
        tipo: doc.tipo,
        arquivo_url: '',
        nome_arquivo: doc.nome,
        status: 'pendente',
      }));
      await supabase.from('sinistro_documentos').insert(docsToInsert);

      // 4. Registrar no histórico do associado
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('placa, associado_id')
        .eq('id', veiculoId)
        .single();

      if (veiculo?.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: veiculo.associado_id,
          tipo: 'indenizacao_iniciada',
          descricao: `Indenização integral iniciada para veículo ${veiculo.placa}. Valor: ${formatCurrency(valorFinal)}`,
          veiculo_id: veiculoId,
          dados_novos: {
            valor_fipe: valorBase,
            depreciacoes,
            total_depreciacao: totalDepreciacao,
            valor_final: valorFinal,
            sinistroId,
          },
        });
      }

      return { valorFinal };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      toast.success('Processo de indenização integral iniciado!');
      onOpenChange(false);
      setDepreciacoes({});
      setObservacoes('');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Iniciar Indenização Integral
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Ao iniciar a indenização, o sinistro {protocolo} será movido para "Aguardando Pagamento" e documentos de indenização serão solicitados ao associado. Prazo de 60 dias úteis.
            </p>
          </div>

          {/* Valor FIPE */}
          <div>
            <Label className="text-sm text-muted-foreground">Valor FIPE base</Label>
            <p className="text-xl font-bold">{formatCurrency(valorBase)}</p>
          </div>

          <Separator />

          {/* Depreciações */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Depreciações aplicáveis</Label>
            {DEPRECIACOES.map(dep => (
              <div key={dep.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!depreciacoes[dep.key]}
                    onCheckedChange={(checked) => setDepreciacoes(prev => ({ ...prev, [dep.key]: checked }))}
                  />
                  <span className="text-sm">{dep.label}</span>
                </div>
                <span className="text-sm text-muted-foreground">-{dep.percentual}%</span>
              </div>
            ))}
          </div>

          {totalDepreciacao > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Total depreciação:</span>
                <span className="font-medium text-red-600">-{totalDepreciacao}%</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Valor final */}
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Valor da indenização:</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(valorFinal)}</span>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações sobre a indenização..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Indenização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
