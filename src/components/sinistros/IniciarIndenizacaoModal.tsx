import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useConfiguracaoNumero, useConfiguracaoJson } from '@/hooks/useConteudosSistema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, DollarSign, AlertTriangle, Info } from 'lucide-react';

interface IniciarIndenizacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  veiculoId: string;
  protocolo: string;
  valorFipe?: number | null;
}

interface RegraDepreciacao {
  flag: string;
  label: string;
  percentual: number;
  adicional?: boolean;
}

const DEPRECIACOES_FALLBACK: RegraDepreciacao[] = [
  { flag: 'flag_placa_vermelha', label: 'Placa vermelha', percentual: 25 },
  { flag: 'flag_ex_taxi', label: 'Ex-táxi', percentual: 25 },
  { flag: 'flag_taxi_ativo', label: 'Táxi ativo', percentual: 25 },
  { flag: 'flag_chassi_remarcado', label: 'Chassi remarcado', percentual: 30 },
  { flag: 'flag_leilao', label: 'Veículo de leilão', percentual: 30 },
  { flag: 'flag_ex_ressarcido', label: 'Já indenizado anteriormente', percentual: 30 },
  { flag: 'flag_avarias_vistoria', label: 'Avarias pré-existentes (vistoria)', percentual: 20, adicional: true },
];

const DOCUMENTOS_INDENIZACAO = [
  { tipo: 'bo_original', nome: 'B.O. original', obrigatorio: true },
  { tipo: 'crv_transferencia', nome: 'CRV preenchido a favor da Pratic Car', obrigatorio: true },
  { tipo: 'crlv_original', nome: 'CRLV original', obrigatorio: true },
  { tipo: 'quitacao_ipva', nome: 'Quitação de IPVA e seguro obrigatório (2 últimos anos)', obrigatorio: true },
  { tipo: 'chaves_veiculo', nome: 'Chaves do veículo', obrigatorio: true },
  { tipo: 'certidao_negativa_furto', nome: 'Certidão negativa de furto e multa', obrigatorio: true },
  { tipo: 'procuracao_publica', nome: 'Procuração pública para a associação', obrigatorio: true },
  { tipo: 'quitacao_financiamento', nome: 'Quitação de financiamento (se financiado)', obrigatorio: false },
  { tipo: 'contrato_social', nome: 'Contrato social ou estatuto (se PJ)', obrigatorio: false },
  { tipo: 'nota_fiscal_venda', nome: 'Nota fiscal de venda (se leilão)', obrigatorio: false },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function IniciarIndenizacaoModal({
  open, onOpenChange, sinistroId, veiculoId, protocolo, valorFipe,
}: IniciarIndenizacaoModalProps) {
  const queryClient = useQueryClient();
  const { data: prazoSinistro } = useConfiguracaoNumero('operacional_prazo_sinistro', 60);
  const { data: regrasDepreciacao } = useConfiguracaoJson<RegraDepreciacao[]>('regras_depreciacao', DEPRECIACOES_FALLBACK);
  const DEPRECIACOES = regrasDepreciacao ?? DEPRECIACOES_FALLBACK;
  const [depreciacoesState, setDepreciacoesState] = useState<Record<string, boolean>>({});
  const [observacoes, setObservacoes] = useState('');

  // Fetch vehicle flags to pre-check depreciation switches
  const { data: veiculoFlags } = useQuery({
    queryKey: ['veiculo-flags', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('flag_placa_vermelha, flag_ex_taxi, flag_taxi_ativo, flag_chassi_remarcado, flag_leilao, flag_ex_ressarcido, flag_avarias_vistoria')
        .eq('id', veiculoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!veiculoId && open,
  });

  // Pre-check switches based on vehicle flags when modal opens
  useEffect(() => {
    if (veiculoFlags) {
      const preChecked: Record<string, boolean> = {};
      for (const dep of DEPRECIACOES) {
        const flagValue = (veiculoFlags as any)?.[dep.flag];
        if (flagValue === true) {
          preChecked[dep.flag] = true;
        }
      }
      setDepreciacoesState(preChecked);
    }
  }, [veiculoFlags, DEPRECIACOES]);

  // Calculation: highest non-avarias depreciation, then additional (compound)
  const depreciacoesSelecionadas = DEPRECIACOES.filter(d => depreciacoesState[d.flag]);
  const nonAdicionais = depreciacoesSelecionadas.filter(d => !d.adicional);
  const adicionais = depreciacoesSelecionadas.filter(d => !!d.adicional);
  const maiorDepreciacao = nonAdicionais.length > 0
    ? Math.max(...nonAdicionais.map(d => d.percentual))
    : 0;

  const valorBase = valorFipe || 0;
  let valorFinal = valorBase * (1 - maiorDepreciacao / 100);
  // Apply each additional (compound) depreciation
  for (const ad of adicionais) {
    valorFinal = valorFinal * (1 - ad.percentual / 100);
  }

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
      const depInfo = maiorDepreciacao > 0 ? `Maior depreciação: ${maiorDepreciacao}%` : 'Sem depreciação';
      const adicionaisInfo = adicionais.length > 0 ? `, Adicionais: ${adicionais.map(a => `-${a.percentual}%`).join(', ')}` : '';
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: 'em_recuperacao',
        status_novo: 'aguardando_pagamento',
        usuario_id: user.id,
        observacao: `Indenização integral iniciada. Valor FIPE: ${formatCurrency(valorBase)}, ${depInfo}${adicionaisInfo}, Valor final: ${formatCurrency(valorFinal)}. ${observacoes}`,
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
            maior_depreciacao: maiorDepreciacao,
            avarias_adicional: hasAvarias,
            valor_final: valorFinal,
            sinistroId,
          },
        });

        // 5. Criar conta a pagar para o associado (indenização)
        try {
          const { data: assocData } = await supabase
            .from('associados')
            .select('nome, cpf')
            .eq('id', veiculo.associado_id)
            .single();

          if (assocData && valorFinal > 0) {
            const prazo = prazoSinistro ?? 60;
            const diasCorridos = Math.round(prazo * 1.4);
            const vencimento = new Date();
            vencimento.setDate(vencimento.getDate() + diasCorridos);

            await supabase.from('contas_pagar').insert({
              fornecedor_nome: assocData.nome,
              fornecedor_documento: assocData.cpf,
              categoria: 'indenizacao',
              valor: valorFinal,
              data_vencimento: vencimento.toISOString().split('T')[0],
              referencia_tipo: 'sinistro',
              referencia_id: sinistroId,
              observacao: `Indenização integral - ${protocolo} - Perda total ou roubo não recuperado`,
              status: 'pendente',
            });

            queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
            queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis'] });
          }
        } catch (cpErr) {
          console.error('Erro ao criar conta a pagar (indenização):', cpErr);
        }
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              Ao iniciar a indenização, o sinistro {protocolo} será movido para "Aguardando Pagamento" e documentos de indenização serão solicitados ao associado.
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
            <div>
              <Label className="text-sm font-medium">Depreciações aplicáveis</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aplica-se a <strong>maior</strong> depreciação + avarias adicionais sobre o valor já depreciado
              </p>
            </div>
            {DEPRECIACOES.map(dep => {
              const isAdditional = !!dep.adicional;
              const isHighest = !isAdditional && depreciacoesState[dep.flag] && dep.percentual === maiorDepreciacao;
              return (
                <div key={dep.flag} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!depreciacoesState[dep.flag]}
                      onCheckedChange={(checked) => setDepreciacoesState(prev => ({ ...prev, [dep.flag]: checked }))}
                    />
                    <span className="text-sm">{dep.label}</span>
                  </div>
                  <span className={`text-sm ${isHighest ? 'font-bold text-red-600' : isAdditional && depreciacoesState[dep.flag] ? 'font-bold text-orange-600' : 'text-muted-foreground'}`}>
                    -{dep.percentual}%{isAdditional ? ' (adicional)' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {(maiorDepreciacao > 0 || hasAvarias) && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              {maiorDepreciacao > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Maior depreciação aplicada:</span>
                  <span className="font-medium text-red-600">-{maiorDepreciacao}%</span>
                </div>
              )}
              {hasAvarias && (
                <div className="flex justify-between text-sm">
                  <span>Avarias (sobre valor já depreciado):</span>
                  <span className="font-medium text-orange-600">-20%</span>
                </div>
              )}
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

          {/* Informações do fluxo */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• <strong>Prazo:</strong> {prazoSinistro ?? 60} dias úteis a partir da documentação completa</p>
                <p>• <strong>Kit GNV:</strong> Se o veículo tem kit gás, o associado pode retirar antes da entrega</p>
                <p>• <strong>Financiamento:</strong> Se financiado, o credor é pago primeiro, saldo restante ao associado</p>
              </div>
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
