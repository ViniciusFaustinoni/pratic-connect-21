import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCriarAcaoManual, type NovaAcaoManual } from '@/hooks/useFocoAds';

type Tipo = NovaAcaoManual['tipo'];

// Acoes validas por nivel de entidade (verba so faz sentido em campanha/conjunto).
const ACOES_POR_NIVEL: Record<NovaAcaoManual['entidade_tipo'], Tipo[]> = {
  anuncio: ['pausar', 'reativar', 'duplicar'],
  conjunto: ['pausar', 'reativar', 'ajustar_verba', 'duplicar'],
  campanha: ['pausar', 'reativar', 'ajustar_verba', 'duplicar'],
};

const ROTULO: Record<Tipo, string> = {
  pausar: 'Pausar', reativar: 'Reativar', ajustar_verba: 'Ajustar verba', duplicar: 'Duplicar',
};

export function ProporAcaoDialog({
  plataforma, entidadeTipo, entidadeId, entidadeExternaId, nome, trigger,
}: {
  plataforma: string;
  entidadeTipo: NovaAcaoManual['entidade_tipo'];
  entidadeId: string | null;
  entidadeExternaId: string | null;
  nome?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // No Google, a execucao suporta apenas pausar/reativar em campanha/conjunto.
  const googleSemSuporte = plataforma === 'google' && entidadeTipo === 'anuncio';
  const opcoes = googleSemSuporte
    ? []
    : ACOES_POR_NIVEL[entidadeTipo].filter(
        (t) => !(plataforma === 'google' && (t === 'ajustar_verba' || t === 'duplicar')),
      );
  const [tipo, setTipo] = useState<Tipo>(opcoes[0] ?? 'pausar');
  const [verba, setVerba] = useState('');
  const criar = useCriarAcaoManual();

  const submeter = () => {
    if (!entidadeExternaId) {
      toast.error('Sem ID externo — rode a sincronização antes de propor ações.');
      return;
    }
    toast.promise(
      criar.mutateAsync({
        plataforma,
        tipo,
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
        entidade_externa_id: entidadeExternaId,
        nome,
        daily_budget: tipo === 'ajustar_verba' ? Number(verba.replace(',', '.')) : undefined,
      }),
      {
        loading: 'Criando ação proposta…',
        success: () => {
          setOpen(false);
          setVerba('');
          return 'Ação proposta criada. Aprove em Foco Ads > Ações para executar.';
        },
        error: (e) => `Falha: ${e?.message ?? e}`,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propor ação{nome ? ` — ${nome}` : ''}</DialogTitle>
          <DialogDescription>
            Cria uma proposta de edição. <strong>Não executa agora</strong> — vai para a fila de aprovação,
            é auditada e (quando possível) reversível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {googleSemSuporte ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              No Google Ads, ações são suportadas em <strong>campanha</strong> ou <strong>conjunto</strong> —
              ainda não em anúncio individual.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Ação</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((t) => (
                    <SelectItem key={t} value={t}>{ROTULO[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'ajustar_verba' && (
            <div className="space-y-1.5">
              <Label htmlFor="verba">Nova verba diária (R$)</Label>
              <Input
                id="verba"
                inputMode="decimal"
                placeholder="ex.: 50,00"
                value={verba}
                onChange={(e) => setVerba(e.target.value)}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Entidade: {entidadeTipo} · plataforma: {plataforma} · alvo: <code>{entidadeExternaId ?? '—'}</code>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submeter} disabled={criar.isPending || googleSemSuporte}>
            {criar.isPending ? 'Criando…' : 'Criar proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
