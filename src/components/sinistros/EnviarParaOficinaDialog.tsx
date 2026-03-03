import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOficinas } from '@/hooks/useOficinas';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wrench, Loader2, Package, ClipboardList, AlertTriangle } from 'lucide-react';

interface EnviarParaOficinaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistro: any;
  marca?: string;
  onSuccess?: () => void;
}

export function EnviarParaOficinaDialog({
  open,
  onOpenChange,
  sinistro,
  marca,
  onSuccess,
}: EnviarParaOficinaDialogProps) {
  const [oficinaId, setOficinaId] = useState('');
  const [tipoServico, setTipoServico] = useState<'pacote_fechado' | 'servico_comum' | ''>('');
  const [valorPacote, setValorPacote] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: oficinas, isLoading: loadingOficinas } = useOficinas({ status: 'ativo', marca: marca || undefined });

  const handleSubmit = async () => {
    if (!oficinaId) {
      toast.error('Selecione uma oficina');
      return;
    }
    if (!tipoServico) {
      toast.error('Selecione o tipo de serviço');
      return;
    }
    if (tipoServico === 'pacote_fechado' && (!valorPacote || parseFloat(valorPacote) <= 0)) {
      toast.error('Informe o valor do pacote fechado');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      // 1. Criar OS
      const { data: os, error: osError } = await supabase
        .from('ordens_servico')
        .insert({
          numero: '',
          sinistro_id: sinistro.id,
          oficina_id: oficinaId,
          veiculo_id: sinistro.veiculo_id,
          associado_id: sinistro.associado_id,
          data_entrada: format(new Date(), 'yyyy-MM-dd'),
          observacoes: observacoes || null,
          status: 'aguardando_orcamento' as any,
          criado_por: profile?.id,
        })
        .select()
        .single();

      if (osError) throw osError;

      // 2. Atualizar sinistro
      await supabase
        .from('sinistros')
        .update({
          status: 'em_reparo' as any,
          oficina_id: oficinaId,
          tipo_servico_oficina: tipoServico,
        } as any)
        .eq('id', sinistro.id);

      // 3. Se pacote fechado, criar orçamento automaticamente com valor
      if (tipoServico === 'pacote_fechado') {
        const valor = parseFloat(valorPacote);
        await supabase
          .from('orcamento_reparo')
          .insert({
            sinistro_id: sinistro.id,
            oficina_id: oficinaId,
            tipo_orcamento: 'pacote_fechado',
            valor_pacote: valor,
            valor_total: valor,
            status: 'elaboracao',
          });
      } else {
        // Serviço comum: criar orçamento vazio para o regulador preencher
        await supabase
          .from('orcamento_reparo')
          .insert({
            sinistro_id: sinistro.id,
            oficina_id: oficinaId,
            tipo_orcamento: 'cotacao_separada',
            status: 'elaboracao',
          });
      }

      // 4. Registrar histórico do sinistro
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: 'em_reparo',
        observacao: `Encaminhado para oficina. OS: ${os.numero || os.id}. Tipo: ${tipoServico === 'pacote_fechado' ? 'Pacote Fechado (R$ ' + parseFloat(valorPacote).toFixed(2) + ')' : 'Serviço Comum'}`,
        usuario_id: profile?.id,
      });

      // 5. Registrar histórico da OS
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_novo: 'aguardando_orcamento',
        observacao: `OS criada a partir do sinistro ${sinistro.protocolo}`,
        usuario_id: profile?.id,
      });

      // 6. WhatsApp ao associado
      try {
        const { data: assocData } = await supabase
          .from('associados')
          .select('nome, whatsapp, telefone')
          .eq('id', sinistro.associado_id)
          .single();
        
        const { data: oficinaData } = await supabase
          .from('oficinas')
          .select('nome_fantasia, razao_social')
          .eq('id', oficinaId)
          .single();

        const tel = assocData?.whatsapp || assocData?.telefone;
        const nomeOficina = oficinaData?.nome_fantasia || oficinaData?.razao_social || 'oficina parceira';
        if (tel) {
          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              phone: tel,
              message: `🔧 *PRATIC - Veículo Encaminhado*\n\nOlá ${assocData?.nome},\n\nSeu veículo foi encaminhado para a oficina *${nomeOficina}*.\n\nAcompanhe o progresso do reparo pelo nosso canal. Qualquer dúvida, estamos à disposição! 🚗`,
            },
          });
        }
      } catch (e) {
        console.error('Erro WhatsApp envio oficina:', e);
      }

      toast.success('Ordem de serviço criada com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao enviar para oficina:', error);
      toast.error('Erro ao criar OS: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Atribuir Oficina ao Evento
          </DialogTitle>
          <DialogDescription>
            Selecione a oficina e o tipo de serviço para o sinistro {sinistro?.protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Oficina */}
          <div className="space-y-2">
            <Label>Oficina *</Label>
            <Select value={oficinaId} onValueChange={setOficinaId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingOficinas ? 'Carregando...' : 'Selecione a oficina'} />
              </SelectTrigger>
              <SelectContent>
                {oficinas?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome_fantasia || o.razao_social} {o.cidade ? `- ${o.cidade}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Serviço */}
          <div className="space-y-3">
            <Label>Tipo de Serviço *</Label>
            <RadioGroup
              value={tipoServico}
              onValueChange={(v) => setTipoServico(v as 'pacote_fechado' | 'servico_comum')}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  tipoServico === 'pacote_fechado' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40'
                }`}
              >
                <RadioGroupItem value="pacote_fechado" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <Package className="h-4 w-4" />
                    Pacote Fechado
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor total único, sem detalhamento de peças/serviços
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  tipoServico === 'servico_comum' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40'
                }`}
              >
                <RadioGroupItem value="servico_comum" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <ClipboardList className="h-4 w-4" />
                    Serviço Comum
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Orçamento detalhado com peças e mão de obra
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Valor do Pacote Fechado */}
          {tipoServico === 'pacote_fechado' && (
            <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <Label className="text-amber-800 dark:text-amber-200 font-medium">Valor Total do Pacote *</Label>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Este será o custo total do evento. Cotações de peças, serviços e mão de obra serão desconsideradas.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorPacote}
                  onChange={(e) => setValorPacote(e.target.value)}
                  className="pl-10 text-lg font-semibold"
                />
              </div>
            </div>
          )}

          {/* Serviço Comum info */}
          {tipoServico === 'servico_comum' && (
            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">📋 Fluxo do Serviço Comum:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>O regulador da oficina envia o orçamento detalhado</li>
                <li>O analista de eventos confirma/corrige os valores</li>
                <li>O analista atribui o auto center para cada peça</li>
                <li>O custo real é calculado somente na conclusão do reparo</li>
              </ol>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !tipoServico}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
            Criar OS e Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
