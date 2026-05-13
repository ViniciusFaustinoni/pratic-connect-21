import { useEffect, useMemo, useState } from 'react';
import { format, addDays, isSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Wrench, Loader2, MapPin } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { buscarCep } from '@/lib/cep';
import { useAprovarTrocaMonitoramento } from '@/hooks/useSolicitacoesTroca';
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
}

export function AgendarManutencaoTrocaDialog({ open, onOpenChange, solicitacaoId, veiculoId, onAgendado }: Props) {
  const [rastreador, setRastreador] = useState<RastreadorVinc | null>(null);
  const [carregandoRast, setCarregandoRast] = useState(false);
  const [data, setData] = useState<Date | undefined>();
  const [periodo, setPeriodo] = useState<'manha' | 'tarde' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const aprovar = useAprovarTrocaMonitoramento();

  // Carrega rastreador vinculado ao veículo
  useEffect(() => {
    if (!open || !veiculoId) return;
    setCarregandoRast(true);
    (async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, imei')
        .eq('veiculo_id', veiculoId)
        .neq('status', 'baixado')
        .limit(1)
        .maybeSingle();
      if (error) console.warn('[AgendarManutencaoTrocaDialog] erro rastreador:', error);
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
    return !!rastreador && !!data && !!periodo && !!cep && !!logradouro && !!bairro && !!cidade && !!uf;
  }, [rastreador, data, periodo, cep, logradouro, bairro, cidade, uf]);

  const reset = () => {
    setData(undefined); setPeriodo(null); setMotivo('');
    setCep(''); setLogradouro(''); setNumero(''); setBairro(''); setCidade(''); setUf('');
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleConfirmar = () => {
    if (!podeConfirmar || !rastreador || !data || !periodo) return;
    aprovar.mutate({
      solicitacao_id: solicitacaoId,
      acao: 'agendar_manutencao',
      manutencao: {
        rastreador_id: rastreador.id,
        data_agendada: format(data, 'yyyy-MM-dd'),
        periodo,
        motivo: motivo.trim() || undefined,
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
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            Agendar manutenção de rastreador
          </DialogTitle>
          <DialogDescription>
            Cria um serviço de campo (manutenção) para o veículo da troca. Após a conclusão, a solicitação volta ao Monitoramento para aprovação final.
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
                <p><strong>Rastreador:</strong> {rastreador.codigo}</p>
                {rastreador.imei && <p className="text-xs text-muted-foreground font-mono">IMEI: {rastreador.imei}</p>}
              </div>
            ) : (
              <p className="text-sm text-destructive">Nenhum rastreador ativo vinculado ao veículo.</p>
            )}
          </Card>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !data && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "EEEE, dd 'de' MMMM", { locale: ptBR }) : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data} onSelect={setData} disabled={diasDesabilitados} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Período *</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['manha', 'tarde'] as const).map((p) => (
                <Card
                  key={p}
                  className={cn('p-3 cursor-pointer text-center transition-all hover:border-primary/50',
                    periodo === p && 'ring-2 ring-primary border-primary')}
                  onClick={() => setPeriodo(p)}
                >
                  <p className="font-semibold capitalize">{p === 'manha' ? 'Manhã' : 'Tarde'}</p>
                  <p className="text-xs text-muted-foreground">{p === 'manha' ? '08h às 12h' : '13h às 18h'}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço da manutenção *</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input
                  placeholder="CEP"
                  value={cep}
                  onChange={(e) => handleCep(e.target.value)}
                  maxLength={9}
                />
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
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: revisão pré-troca, antena solta..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={aprovar.isPending}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={!podeConfirmar || aprovar.isPending}>
            {aprovar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Agendando...</> : 'Confirmar agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
