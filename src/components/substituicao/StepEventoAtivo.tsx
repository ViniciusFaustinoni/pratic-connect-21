import { useState } from 'react';
import { Clock, FileX, PlusCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useAtualizarSubstituicao } from '@/hooks/useSubstituicaoVeiculo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ResolucaoEvento } from '@/types/substituicao';

interface StepEventoAtivoProps {
  evento: { id: string; tipo: string };
  substituicaoId: string | null;
  associadoId: string;
  veiculoAntigoId: string;
  onNext: () => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

export function StepEventoAtivo({
  evento,
  substituicaoId,
  onNext,
  onBack,
  onIniciarSubstituicao,
}: StepEventoAtivoProps) {
  const [opcao, setOpcao] = useState<ResolucaoEvento | ''>('');
  const [processando, setProcessando] = useState(false);
  const atualizarSubstituicao = useAtualizarSubstituicao();

  const handleConfirmar = async () => {
    if (!opcao) return;
    setProcessando(true);

    try {
      let substId = substituicaoId;
      if (!substId) {
        substId = await onIniciarSubstituicao();
      }

      await atualizarSubstituicao.mutateAsync({
        id: substId,
        evento_bloqueante_id: evento.id,
        tipo_evento_bloqueante: 'proprio_aguardando',
        resolucao_evento: opcao,
      });

      if (opcao === 'aguardar_finalizacao') {
        toast.info('Substituição registrada. Você será notificado quando o evento for finalizado.');
        // não avança
      } else if (opcao === 'cancelar_com_termo') {
        toast.success('Registro salvo. O termo de desistência será gerado.');
        onNext();
      } else if (opcao === 'inclusao_temporaria') {
        toast.success('Registro salvo. Prosseguindo como inclusão temporária.');
        onNext();
      }
    } catch (err) {
      toast.error('Erro ao processar: ' + (err as Error).message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card do evento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Evento Ativo Detectado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium capitalize">{evento.tipo}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Número</p>
              <p className="font-medium">#{evento.id.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant="secondary">Em andamento</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como deseja prosseguir?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={opcao} onValueChange={(v) => setOpcao(v as ResolucaoEvento)} className="space-y-4">
            {/* Opção A */}
            <label
              htmlFor="aguardar"
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                opcao === 'aguardar_finalizacao' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              )}
            >
              <RadioGroupItem value="aguardar_finalizacao" id="aguardar" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Aguardar finalização do evento</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A substituição ficará em espera até que o evento #{evento.id.slice(0, 8)} seja concluído. Você será notificado quando puder prosseguir.
                </p>
              </div>
            </label>

            {/* Opção B */}
            <label
              htmlFor="cancelar_termo"
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                opcao === 'cancelar_com_termo' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              )}
            >
              <RadioGroupItem value="cancelar_com_termo" id="cancelar_termo" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileX className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-sm">Cancelar o evento e prosseguir</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  O associado DESISTE do evento em andamento, assinando termo de responsabilidade. Após assinatura, a substituição prossegue.
                </p>
                {opcao === 'cancelar_com_termo' && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      O associado perderá o direito ao reparo/indenização do evento #{evento.id.slice(0, 8)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </label>

            {/* Opção C */}
            <label
              htmlFor="inclusao_temp"
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                opcao === 'inclusao_temporaria' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              )}
            >
              <RadioGroupItem value="inclusao_temporaria" id="inclusao_temp" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Fazer inclusão agora, substituir depois</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  O associado adiciona o novo veículo como inclusão. Quando o evento for finalizado, o sistema converte para substituição.
                </p>
                {opcao === 'inclusao_temporaria' && (
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      O associado pagará mensalidade de DOIS veículos temporariamente.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleConfirmar} disabled={!opcao || processando}>
          {processando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {opcao === 'aguardar_finalizacao' ? 'Salvar e aguardar' : opcao === 'cancelar_com_termo' ? 'Gerar termo de desistência' : opcao === 'inclusao_temporaria' ? 'Iniciar inclusão' : 'Confirmar'}
        </Button>
      </div>
    </div>
  );
}
