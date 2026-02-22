import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  CONCLUSAO_LAUDO_LABELS,
  RECOMENDACAO_LABELS,
  type ConclusaoLaudo,
  type RecomendacaoLaudo,
} from '@/types/sindicancia';
import { notificarAguardandoDiretoria } from './NotificacaoHelper';

type Decisao = 'regular_retomar' | 'irregular_negar' | 'carta_cancelamento' | 'encaminhar_juridico' | 'inconclusivo_diretoria';

const DECISOES: { value: Decisao; label: string; desc: string; danger?: boolean }[] = [
  {
    value: 'regular_retomar',
    label: 'Regular — Retomar Fluxo Normal',
    desc: 'A sindicância confirmou que o evento é legítimo. O evento será aprovado e seguirá o fluxo normal de reparo ou indenização.',
  },
  {
    value: 'irregular_negar',
    label: 'Irregular — Negar Evento',
    desc: 'A sindicância identificou fraude ou irregularidade. O evento será negado e o associado será notificado com o motivo.',
  },
  {
    value: 'carta_cancelamento',
    label: 'Carta de Cancelamento',
    desc: 'Fraude grave comprovada. Além de negar o evento, o associado será cancelado do quadro da associação e um caso jurídico será criado.',
    danger: true,
  },
  {
    value: 'encaminhar_juridico',
    label: 'Encaminhar para o Jurídico',
    desc: 'O caso será enviado ao departamento jurídico para análise e decisão legal.',
  },
  {
    value: 'inconclusivo_diretoria',
    label: 'Inconclusivo — Escalar para Diretoria',
    desc: 'Não há conclusão clara. O caso será escalado para o diretor decidir.',
  },
];

const CONCLUSAO_STYLES: Record<string, string> = {
  regular: 'bg-green-100 text-green-800',
  irregular_comprovada: 'bg-red-100 text-red-800',
  irregular_suspeita: 'bg-orange-100 text-orange-800',
  inconclusivo: 'bg-yellow-100 text-yellow-800',
};

interface DecisaoPosSindicanciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  protocolo: string;
  sindicancia: {
    id: string;
    numero: string;
    sinistro_id: string;
    laudo_conclusao: string | null;
    laudo_recomendacao: string | null;
  };
  onSuccess: () => void;
}

export function DecisaoPosSindicanciaModal({
  open, onOpenChange, sinistroId, protocolo, sindicancia, onSuccess,
}: DecisaoPosSindicanciaModalProps) {
  const queryClient = useQueryClient();
  const [decisao, setDecisao] = useState<Decisao | ''>('');
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirmar = async () => {
    if (!decisao || justificativa.length < 30) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // 1. Encerrar sindicância com decisão
      const { error: errSind } = await supabase
        .from('sindicancias')
        .update({
          decisao_analista: decisao,
          decisao_observacao: justificativa,
          decisao_por: user.id,
          decisao_em: new Date().toISOString(),
          status: 'encerrado' as any,
        })
        .eq('id', sindicancia.id);
      if (errSind) throw errSind;

      // 2. Executar ação conforme decisão
      let statusNovo = '';
      let mensagemSucesso = '';

      if (decisao === 'regular_retomar') {
        const { error } = await supabase.functions.invoke('aprovar-sinistro', {
          body: { sinistroId, observacao: `Decisão pós-sindicância: Regular — ${justificativa}` },
        });
        if (error) throw error;
        statusNovo = 'aprovado';
        mensagemSucesso = 'Evento aprovado. O link de pagamento da cota será enviado ao associado.';
      } else if (decisao === 'irregular_negar') {
        const { error } = await supabase.functions.invoke('reprovar-sinistro', {
          body: { sinistroId, motivo: 'fraude_sindicancia', observacao: `Decisão pós-sindicância: Negar — ${justificativa}` },
        });
        if (error) throw error;
        statusNovo = 'negado';
        mensagemSucesso = 'Evento negado. O associado será notificado.';
      } else if (decisao === 'carta_cancelamento') {
        // Negar evento
        const { error } = await supabase.functions.invoke('reprovar-sinistro', {
          body: { sinistroId, motivo: 'fraude_sindicancia_cancelamento', observacao: `Carta de cancelamento — ${justificativa}` },
        });
        if (error) throw error;

        // Marcar associado para exclusão — buscar associado_id do sinistro
        const { data: sinistroData } = await supabase
          .from('sinistros')
          .select('associado_id')
          .eq('id', sinistroId)
          .single();

        if (sinistroData?.associado_id) {
          await supabase
            .from('associados')
            .update({
              motivo_cancelamento: `Fraude comprovada em sindicância ${sindicancia.numero}`,
              tipo_saida: 'exclusao_fraude',
            })
            .eq('id', sinistroData.associado_id);
        }

        statusNovo = 'negado';
        mensagemSucesso = 'Evento negado e associado marcado para exclusão. Caso jurídico pendente.';
      } else if (decisao === 'encaminhar_juridico') {
        await supabase
          .from('sinistros')
          .update({ status: 'aguardando_juridico' as any })
          .eq('id', sinistroId);

        await supabase.from('sinistro_historico').insert({
          sinistro_id: sinistroId,
          status_anterior: 'aguardando_analise',
          status_novo: 'aguardando_juridico',
          observacao: `Decisão pós-sindicância: Encaminhar para o Jurídico — ${justificativa}`,
          usuario_id: user.id,
        });

        statusNovo = 'aguardando_juridico';
        mensagemSucesso = 'Evento encaminhado para o departamento jurídico.';
      } else if (decisao === 'inconclusivo_diretoria') {
        await supabase
          .from('sinistros')
          .update({ status: 'aguardando_diretoria' as any })
          .eq('id', sinistroId);

        await supabase.from('sinistro_historico').insert({
          sinistro_id: sinistroId,
          status_anterior: 'aguardando_analise',
          status_novo: 'aguardando_diretoria',
          observacao: `Decisão pós-sindicância: Inconclusivo — Escalar para Diretoria — ${justificativa}`,
          usuario_id: user.id,
        });

        notificarAguardandoDiretoria(sinistroId, protocolo);
        statusNovo = 'aguardando_diretoria';
        mensagemSucesso = 'Evento escalado para a Diretoria.';
      }

      // 3. Histórico adicional para decisões que usam edge functions (regular/negar/carta)
      if (['regular_retomar', 'irregular_negar', 'carta_cancelamento'].includes(decisao)) {
        await supabase.from('sinistro_historico').insert({
          sinistro_id: sinistroId,
          status_anterior: 'aguardando_analise',
          status_novo: statusNovo,
          observacao: `Decisão pós-sindicância: ${DECISOES.find(d => d.value === decisao)?.label} — ${justificativa}`,
          usuario_id: user.id,
        });
      }

      toast.success(`Decisão registrada. ${mensagemSucesso}`);
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise'] });
      queryClient.invalidateQueries({ queryKey: ['sindicancia-evento'] });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao registrar decisão:', err);
      toast.error('Erro ao registrar decisão: ' + (err.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Decisão Pós-Sindicância</DialogTitle>
          <DialogDescription>
            Evento #{protocolo} • Sindicância {sindicancia.numero}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do laudo */}
        <Card className="bg-muted/50">
          <CardContent className="py-3 flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Conclusão:</span>
            <Badge className={CONCLUSAO_STYLES[sindicancia.laudo_conclusao || ''] || 'bg-muted'}>
              {CONCLUSAO_LAUDO_LABELS[sindicancia.laudo_conclusao!] || '---'}
            </Badge>
            <span className="text-sm text-muted-foreground ml-2">Recomendação:</span>
            <Badge variant="secondary">
              {RECOMENDACAO_LABELS[sindicancia.laudo_recomendacao!] || '---'}
            </Badge>
          </CardContent>
        </Card>

        {/* Opções */}
        <RadioGroup value={decisao} onValueChange={(v) => setDecisao(v as Decisao)} className="space-y-3">
          {DECISOES.map((d) => (
            <div key={d.value}>
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  decisao === d.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <RadioGroupItem value={d.value} className="mt-1" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{d.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                </div>
              </label>
              {d.danger && decisao === d.value && (
                <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-red-50 border border-red-300 text-red-800 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span><strong>ATENÇÃO:</strong> Isso irá CANCELAR o associado do quadro da associação. Esta ação é irreversível.</span>
                </div>
              )}
            </div>
          ))}
        </RadioGroup>

        {/* Justificativa */}
        <div>
          <Label htmlFor="justificativa">Justificativa da decisão *</Label>
          <Textarea
            id="justificativa"
            placeholder="Explique o motivo desta decisão. Se está seguindo a recomendação do sindicante, confirme. Se está discordando, justifique..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={4}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {justificativa.length}/30 caracteres mínimos
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!decisao || justificativa.length < 30 || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Decisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
