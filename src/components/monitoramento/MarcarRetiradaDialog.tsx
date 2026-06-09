import { useEffect, useState } from 'react';
import { Loader2, PackageMinus, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  useConverterParaRetirada,
  type TipoVistoriaRetirada,
} from '@/hooks/useConverterParaRetirada';

interface MarcarRetiradaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  veiculoId: string;
  veiculoPlaca?: string;
  onSuccess?: () => void;
}

interface RastreadorVinc {
  id: string;
  codigo: string;
  imei: string | null;
  plataforma: string | null;
}

const TIPOS: { value: TipoVistoriaRetirada; titulo: string; descricao: string }[] = [
  {
    value: 'retirada',
    titulo: 'Vistoria de Retirada',
    descricao: 'Veículo SAI da base. Cobertura encerra após execução.',
  },
  {
    value: 'enxuta',
    titulo: 'Vistoria Enxuta',
    descricao: 'Veículo PERMANECE sem rastreador (chassi + motor + vídeo 360°).',
  },
  {
    value: 'completa',
    titulo: 'Vistoria Completa',
    descricao: 'Veículo PERMANECE sem rastreador (31 fotos carro / 15 moto + 360°).',
  },
];

/**
 * Diálogo "Tratar como Retirada" — fallback do Monitoramento quando o serviço
 * atribuído deveria ter sido retirada do rastreador (com a vistoria escolhida).
 * Espelho do `MarcarManutencaoDialog`.
 */
export function MarcarRetiradaDialog({
  open, onOpenChange, servicoId, veiculoId, veiculoPlaca, onSuccess,
}: MarcarRetiradaDialogProps) {
  const [rastreador, setRastreador] = useState<RastreadorVinc | null>(null);
  const [carregandoRast, setCarregandoRast] = useState(false);
  const [tipoVistoria, setTipoVistoria] = useState<TipoVistoriaRetirada | null>(null);
  const [justificativa, setJustificativa] = useState('');

  const converter = useConverterParaRetirada();

  useEffect(() => {
    if (!open) {
      setRastreador(null);
      setTipoVistoria(null);
      setJustificativa('');
      return;
    }
    setCarregandoRast(true);
    (async () => {
      const { data } = await supabase
        .from('rastreadores')
        .select('id, codigo, imei, plataforma')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .limit(1)
        .maybeSingle();
      setRastreador((data as RastreadorVinc | null) || null);
      setCarregandoRast(false);
    })();
  }, [open, veiculoId]);

  const podeConfirmar = !!rastreador && !!tipoVistoria && justificativa.trim().length >= 10;

  const handleConfirmar = () => {
    if (!podeConfirmar || !rastreador || !tipoVistoria) return;
    converter.mutate(
      {
        servicoId,
        tipoVistoria,
        justificativa: justificativa.trim(),
        rastreadorId: rastreador.id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-amber-600" />
            Tratar como Retirada
          </DialogTitle>
          <DialogDescription>
            Converte este atendimento em <strong>Retirada do Rastreador</strong> + uma
            <strong> vistoria acompanhante</strong>. O tipo de vistoria sinaliza a intenção:
            o veículo sai da base ou permanece sem rastreador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-3 bg-muted/40">
            {carregandoRast ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando rastreador...
              </div>
            ) : rastreador ? (
              <div className="text-sm">
                <p>
                  <strong>Rastreador:</strong> {rastreador.codigo}
                  {rastreador.plataforma ? ` · ${rastreador.plataforma}` : ''}
                </p>
                {rastreador.imei && (
                  <p className="text-xs text-muted-foreground font-mono">IMEI: {rastreador.imei}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Veículo {veiculoPlaca || veiculoId.slice(0, 8)}
                </p>
              </div>
            ) : (
              <Alert className="border-destructive/40 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription>
                  Nenhum rastreador instalado neste veículo. Para tratar como retirada é
                  necessário haver um rastreador vinculado.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de vistoria acompanhante *</label>
            <RadioGroup
              value={tipoVistoria ?? ''}
              onValueChange={(v) => setTipoVistoria(v as TipoVistoriaRetirada)}
              className="grid gap-2"
            >
              {TIPOS.map((t) => (
                <label
                  key={t.value}
                  htmlFor={`mret-${t.value}`}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                    tipoVistoria === t.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  <RadioGroupItem value={t.value} id={`mret-${t.value}`} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Justificativa * <span className="text-xs text-muted-foreground">(mín. 10 caracteres)</span>
            </label>
            <Textarea
              placeholder="Ex.: serviço foi atribuído como instalação por engano; veículo já tem rastreador e o operador pediu retirada com vistoria completa."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converter.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar || converter.isPending}
            className="bg-amber-600 hover:bg-amber-600/90 text-white"
          >
            {converter.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PackageMinus className="h-4 w-4 mr-2" />
            )}
            Confirmar Retirada + Vistoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
