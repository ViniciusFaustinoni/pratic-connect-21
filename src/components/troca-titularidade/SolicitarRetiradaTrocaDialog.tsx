import { useEffect, useMemo, useState } from 'react';
import { format, addDays, isSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, PackageMinus, Loader2, MapPin } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { buscarCep } from '@/lib/cep';
import { useAprovarTrocaMonitoramento, type TipoVistoriaRetirada } from '@/hooks/useSolicitacoesTroca';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  solicitacaoId: string;
  veiculoId: string;
  onAgendado?: () => void;
}

interface RastreadorVinc {
  id: string;
  codigo: string;
  imei?: string | null;
  plataforma?: string | null;
}

const TIPOS_VISTORIA: { value: TipoVistoriaRetirada; titulo: string; descricao: string }[] = [
  {
    value: 'retirada',
    titulo: 'Vistoria de Retirada',
    descricao: 'Veículo SAI da base. Cobertura encerra após a execução.',
  },
  {
    value: 'enxuta',
    titulo: 'Vistoria Enxuta',
    descricao: 'Veículo PERMANECE sem rastreador (chassi + motor + vídeo 360°).',
  },
  {
    value: 'completa',
    titulo: 'Vistoria Completa',
    descricao: 'Veículo PERMANECE sem rastreador (31 fotos carro / 15 moto + vídeo 360°).',
  },
];

/**
 * Solicita Retirada do rastreador + Vistoria acompanhante (Monitoramento da Troca).
 * Tipo da vistoria sinaliza intenção: Retirada = veículo sai; Enxuta/Completa = veículo
 * permanece na base sem rastreador. Materializa 2 serviços paralelos no mesmo
 * agendamento via edge `aprovar-troca-monitoramento` (acao=solicitar_retirada).
 */
export function SolicitarRetiradaTrocaDialog({ open, onOpenChange, solicitacaoId, veiculoId, onAgendado }: Props) {
  const [rastreador, setRastreador] = useState<RastreadorVinc | null>(null);
  const [carregandoRast, setCarregandoRast] = useState(false);
  const [tipoVistoria, setTipoVistoria] = useState<TipoVistoriaRetirada | null>(null);
  const [data, setData] = useState<Date | undefined>();
  const [periodo, setPeriodo] = useState<'manha' | 'tarde' | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const aprovar = useAprovarTrocaMonitoramento();

  useEffect(() => {
    if (!open || !veiculoId) return;
    setCarregandoRast(true);
    (async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, imei, plataforma')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .limit(1)
        .maybeSingle();
      if (error) console.warn('[SolicitarRetiradaTrocaDialog] erro rastreador:', error);
      setRastreador((data as RastreadorVinc | null) || null);
      setCarregandoRast(false);
    })();
  }, [open, veiculoId]);

  const dataMin = new Date();
  const dataMax = addDays(new Date(), 14);
  const diasDesabilitados = (d: Date) => isSunday(d) || d < new Date(dataMin.toDateString()) || d > dataMax;

  const handleCep = async (valor: string) => {
    setCep(valor);
    if (valor.replace(/\D/g, '').length === 8) {
      setBuscandoCep(true);
      const r = await buscarCep(valor);
      setBuscandoCep(false);
      if (r) {
        setLogradouro(r.logradouro || '');
        setBairro(r.bairro || '');
        setCidade(r.cidade || '');
        setUf(r.uf || '');
      } else {
        toast.error('CEP não encontrado');
      }
    }
  };

  const podeConfirmar = useMemo(() => {
    return !!rastreador
      && !!tipoVistoria
      && !!data
      && !!periodo
      && justificativa.trim().length >= 10
      && !!cep && !!logradouro && !!bairro && !!cidade && !!uf;
  }, [rastreador, tipoVistoria, data, periodo, justificativa, cep, logradouro, bairro, cidade, uf]);

  const reset = () => {
    setTipoVistoria(null); setData(undefined); setPeriodo(null); setJustificativa('');
    setCep(''); setLogradouro(''); setNumero(''); setBairro(''); setCidade(''); setUf('');
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleConfirmar = () => {
    if (!podeConfirmar || !rastreador || !tipoVistoria || !data || !periodo) return;
    aprovar.mutate({
      solicitacao_id: solicitacaoId,
      acao: 'solicitar_retirada',
      retirada: {
        rastreador_id: rastreador.id,
        tipo_vistoria: tipoVistoria,
        data_agendada: format(data, 'yyyy-MM-dd'),
        periodo,
        justificativa: justificativa.trim(),
        endereco: {
          logradouro, numero: numero || null, bairro, cidade, uf,
          cep: cep.replace(/\D/g, ''),
        },
      },
    }, {
      onSuccess: () => {
        onAgendado?.();
        handleClose(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-amber-600" />
            Solicitar Retirada + Vistoria
          </DialogTitle>
          <DialogDescription>
            Cria dois serviços paralelos: <strong>retirada do rastreador</strong> e a <strong>vistoria
            acompanhante</strong> escolhida. O tipo de vistoria sinaliza a intenção (veículo sai da base
            ou permanece sem rastreador).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Card className="p-3 bg-muted/40">
            {carregandoRast ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando rastreador...
              </div>
            ) : rastreador ? (
              <div className="text-sm">
                <p><strong>Rastreador:</strong> {rastreador.codigo}{rastreador.plataforma ? ` · ${rastreador.plataforma}` : ''}</p>
                {rastreador.imei && <p className="text-xs text-muted-foreground font-mono">IMEI: {rastreador.imei}</p>}
              </div>
            ) : (
              <p className="text-sm text-destructive">Nenhum rastreador instalado neste veículo.</p>
            )}
          </Card>

          <div className="space-y-2">
            <Label>Tipo de vistoria acompanhante *</Label>
            <RadioGroup
              value={tipoVistoria ?? ''}
              onValueChange={(v) => setTipoVistoria(v as TipoVistoriaRetirada)}
              className="grid gap-2"
            >
              {TIPOS_VISTORIA.map((t) => (
                <label
                  key={t.value}
                  htmlFor={`tipo-${t.value}`}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                    tipoVistoria === t.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  <RadioGroupItem value={t.value} id={`tipo-${t.value}`} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !data && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, "dd 'de' MMM", { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={data} onSelect={setData} disabled={diasDesabilitados} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Período *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['manha', 'tarde'] as const).map((p) => (
                  <Card
                    key={p}
                    className={cn('p-2 cursor-pointer text-center transition-all hover:border-primary/50 text-sm',
                      periodo === p && 'ring-2 ring-primary border-primary')}
                    onClick={() => setPeriodo(p)}
                  >
                    <p className="font-medium capitalize">{p === 'manha' ? 'Manhã' : 'Tarde'}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço *</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input placeholder="CEP" value={cep} onChange={(e) => handleCep(e.target.value)} maxLength={9} />
                {buscandoCep && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 inline animate-spin" /> buscando...</p>}
              </div>
              <Input className="col-span-2" placeholder="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
              <Input placeholder="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
              <Input className="col-span-2" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
              <Input className="col-span-2" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              <Input placeholder="UF" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="just">Justificativa * <span className="text-xs text-muted-foreground">(mín. 10 caracteres)</span></Label>
            <Textarea
              id="just"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: associado solicitou saída da base; ou rastreador será removido mas veículo permanece..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={aprovar.isPending}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={!podeConfirmar || aprovar.isPending} className="bg-amber-600 hover:bg-amber-600/90 text-white">
            {aprovar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Solicitando...</> : <><PackageMinus className="h-4 w-4 mr-2" /> Confirmar Retirada + Vistoria</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
