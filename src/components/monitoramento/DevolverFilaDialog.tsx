import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  useDevolverServicoParaFila,
  useReatribuirServico,
  useVistoriadoresAtivos,
} from '@/hooks/useAtribuicaoManual';

type Categoria = 'nao_compareceu' | 'tecnico_indisponivel' | 'reagendamento_operacional' | 'outro';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico: {
    id: string;
    tipo?: string;
    associadoNome?: string;
    veiculoPlaca?: string;
    profissionalNome?: string;
    profissionalIdAtual?: string | null;
  } | null;
  /** Se true, abre já no modo "reatribuir a outro técnico" */
  modoReatribuir?: boolean;
  onSuccess?: () => void;
}

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'nao_compareceu', label: 'Cliente não compareceu' },
  { value: 'tecnico_indisponivel', label: 'Técnico indisponível' },
  { value: 'reagendamento_operacional', label: 'Reagendamento operacional' },
  { value: 'outro', label: 'Outro motivo' },
];

export function DevolverFilaDialog({ open, onOpenChange, servico, modoReatribuir = false, onSuccess }: Props) {
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const [categoria, setCategoria] = useState<Categoria>('nao_compareceu');
  const [motivo, setMotivo] = useState('');
  const [novaData, setNovaData] = useState(hojeStr);
  const [novoPeriodo, setNovoPeriodo] = useState<'manha' | 'tarde'>('tarde');
  const [reatribuir, setReatribuir] = useState(modoReatribuir);
  const [novoProfId, setNovoProfId] = useState<string>('');

  const devolver = useDevolverServicoParaFila();
  const reatribuirMut = useReatribuirServico();
  const { data: vistoriadores } = useVistoriadoresAtivos();

  const vistoriadoresElegiveis = (vistoriadores || []).filter(
    (v: any) => v.id !== servico?.profissionalIdAtual
  );

  useEffect(() => {
    if (open) {
      setCategoria('nao_compareceu');
      setMotivo('');
      setNovaData(hojeStr);
      setNovoPeriodo('tarde');
      setReatribuir(modoReatribuir);
      setNovoProfId('');
    }
  }, [open, modoReatribuir, hojeStr]);

  const podeConfirmar =
    motivo.trim().length >= 5 && !!novaData && (!reatribuir || !!novoProfId);
  const loading = devolver.isPending || reatribuirMut.isPending;

  const handleConfirm = async () => {
    if (!servico) return;
    try {
      if (reatribuir && novoProfId) {
        await reatribuirMut.mutateAsync({
          servicoId: servico.id,
          motivo: motivo.trim(),
          categoria,
          novaData,
          novoPeriodo,
          novoProfissionalId: novoProfId,
        });
      } else {
        await devolver.mutateAsync({
          servicoId: servico.id,
          motivo: motivo.trim(),
          categoria,
          novaData,
          novoPeriodo,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // toast já exibido pelo hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {reatribuir ? 'Reatribuir serviço' : 'Devolver serviço à fila'}
          </DialogTitle>
          <DialogDescription>
            Esta ação <strong>preserva</strong> a instalação/vistoria — apenas libera o
            técnico atual e reagenda. Não cancela o serviço.
          </DialogDescription>
        </DialogHeader>

        {servico && (
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-0.5">
            {servico.associadoNome && <div><span className="text-muted-foreground">Associado:</span> {servico.associadoNome}</div>}
            {servico.veiculoPlaca && <div><span className="text-muted-foreground">Veículo:</span> {servico.veiculoPlaca}</div>}
            {servico.profissionalNome && <div><span className="text-muted-foreground">Técnico atual:</span> {servico.profissionalNome}</div>}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo (mín. 5 caracteres)</Label>
            <Textarea
              id="motivo"
              rows={3}
              placeholder="Ex.: cliente não atendeu telefone, passou do horário"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Nova data</Label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} min={hojeStr} />
            </div>
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Select value={novoPeriodo} onValueChange={(v) => setNovoPeriodo(v as 'manha' | 'tarde')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="chk-reatribuir"
              type="checkbox"
              className="h-4 w-4"
              checked={reatribuir}
              onChange={(e) => setReatribuir(e.target.checked)}
            />
            <Label htmlFor="chk-reatribuir" className="cursor-pointer text-sm font-normal">
              Já atribuir a outro técnico agora
            </Label>
          </div>

          {reatribuir && (
            <div className="space-y-1.5">
              <Label>Novo técnico</Label>
              <Select value={novoProfId} onValueChange={setNovoProfId}>
                <SelectTrigger><SelectValue placeholder="Selecione um técnico disponível" /></SelectTrigger>
                <SelectContent>
                  {vistoriadoresElegiveis.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum técnico disponível</div>
                  )}
                  {vistoriadoresElegiveis.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} · {v.perfilAtualLabel} · {v.tarefas?.length || 0} tarefa(s)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {reatribuir ? 'Reatribuir' : 'Devolver à fila'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
