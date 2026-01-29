import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Calendar, Car, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegistrarRecuperacao } from '@/hooks/useRegistrarRecuperacao';

interface RegistrarRecuperacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acionamentoId: string;
  sinistroId: string;
  veiculoId: string;
  veiculoPlaca?: string;
}

interface FormData {
  localRecuperacao: string;
  dataRecuperacao: string;
  horaRecuperacao: string;
  condicaoVeiculo: 'integro' | 'avariado' | 'destruido';
  observacoes: string;
  reativarVeiculo: boolean;
}

export function RegistrarRecuperacaoModal({
  open,
  onOpenChange,
  acionamentoId,
  sinistroId,
  veiculoId,
  veiculoPlaca,
}: RegistrarRecuperacaoModalProps) {
  const registrarRecuperacao = useRegistrarRecuperacao();
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      dataRecuperacao: format(new Date(), 'yyyy-MM-dd'),
      horaRecuperacao: format(new Date(), 'HH:mm'),
      condicaoVeiculo: 'avariado',
      reativarVeiculo: false,
      observacoes: '',
    },
  });

  const condicaoVeiculo = watch('condicaoVeiculo');
  const reativarVeiculo = watch('reativarVeiculo');

  const onSubmit = async (data: FormData) => {
    const dataHora = `${data.dataRecuperacao}T${data.horaRecuperacao}:00`;
    
    await registrarRecuperacao.mutateAsync({
      acionamentoId,
      sinistroId,
      veiculoId,
      localRecuperacao: data.localRecuperacao,
      dataRecuperacao: dataHora,
      condicaoVeiculo: data.condicaoVeiculo,
      observacoes: data.observacoes,
      reativarVeiculo: data.reativarVeiculo,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Registrar Recuperação do Veículo
          </DialogTitle>
          <DialogDescription>
            {veiculoPlaca && (
              <span className="font-medium">Veículo: {veiculoPlaca}</span>
            )}
            <br />
            Registre os dados da recuperação para encerrar o acionamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Local de Recuperação */}
          <div className="space-y-2">
            <Label htmlFor="localRecuperacao" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Local de Recuperação *
            </Label>
            <Input
              id="localRecuperacao"
              placeholder="Ex: Av. Brasil, 1000 - Centro, São Paulo/SP"
              {...register('localRecuperacao', { required: 'Informe o local de recuperação' })}
            />
            {errors.localRecuperacao && (
              <p className="text-sm text-destructive">{errors.localRecuperacao.message}</p>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataRecuperacao" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data *
              </Label>
              <Input
                id="dataRecuperacao"
                type="date"
                {...register('dataRecuperacao', { required: 'Informe a data' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horaRecuperacao">Hora *</Label>
              <Input
                id="horaRecuperacao"
                type="time"
                {...register('horaRecuperacao', { required: 'Informe a hora' })}
              />
            </div>
          </div>

          {/* Condição do Veículo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Condição do Veículo *
            </Label>
            <Select
              value={condicaoVeiculo}
              onValueChange={(value) => setValue('condicaoVeiculo', value as FormData['condicaoVeiculo'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a condição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="integro">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Íntegro - Sem danos significativos
                  </span>
                </SelectItem>
                <SelectItem value="avariado">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Avariado - Com danos reparáveis
                  </span>
                </SelectItem>
                <SelectItem value="destruido">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Destruído - Perda total
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Detalhes adicionais sobre a recuperação..."
              rows={3}
              {...register('observacoes')}
            />
          </div>

          {/* Reativar Veículo */}
          {condicaoVeiculo !== 'destruido' && (
            <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted">
              <Checkbox
                id="reativarVeiculo"
                checked={reativarVeiculo}
                onCheckedChange={(checked) => setValue('reativarVeiculo', !!checked)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="reativarVeiculo" className="cursor-pointer">
                  Reativar veículo na plataforma de rastreamento
                </Label>
                <p className="text-sm text-muted-foreground">
                  Marca o veículo como ativo novamente no sistema e na Rede Veículos
                </p>
              </div>
            </div>
          )}

          {condicaoVeiculo === 'destruido' && (
            <div className="rounded-lg border border-destructive/50 p-4 bg-destructive/10">
              <p className="text-sm text-destructive">
                <strong>Atenção:</strong> Veículo marcado como destruído permanecerá inativo.
                O sinistro deve ser processado como perda total.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={registrarRecuperacao.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={registrarRecuperacao.isPending}>
              {registrarRecuperacao.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Registrar Recuperação
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
