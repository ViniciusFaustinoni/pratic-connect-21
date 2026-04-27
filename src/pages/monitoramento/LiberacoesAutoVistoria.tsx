import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldAlert, CheckCircle2, Phone, Car, Calendar } from 'lucide-react';
import { useLiberacoesAutoVistoria, useLiberarAutoVistoria } from '@/hooks/useLiberacoesAutoVistoria';
import { format } from 'date-fns';

export default function LiberacoesAutoVistoria() {
  const { data, isLoading } = useLiberacoesAutoVistoria();
  const liberar = useLiberarAutoVistoria();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [alvos, setAlvos] = useState<string[]>([]);

  const todos = useMemo(() => (data ?? []).map(d => d.contrato_id), [data]);
  const todosSelecionados = todos.length > 0 && todos.every(id => selecionados.has(id));

  const toggle = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    setSelecionados(todosSelecionados ? new Set() : new Set(todos));
  };

  const abrirDialog = (ids: string[]) => {
    setAlvos(ids);
    setMotivo('');
    setDialogOpen(true);
  };

  const confirmar = async () => {
    await liberar.mutateAsync({ contrato_ids: alvos, motivo: motivo || undefined });
    setSelecionados(new Set());
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Liberações — Auto-Vistoria
        </h1>
        <p className="text-muted-foreground">
          Associados com cobertura suspensa por não terem feito a instalação do rastreador no prazo após a auto-vistoria.
          Libere para que possam reagendar a vistoria/instalação pelo link público.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {data?.length ?? 0} associado(s) aguardando liberação
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleTodos} disabled={!data?.length}>
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
            <Button
              size="sm"
              disabled={selecionados.size === 0 || liberar.isPending}
              onClick={() => abrirDialog([...selecionados])}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Liberar selecionados ({selecionados.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : !data?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum associado nessa condição. 🎉
            </div>
          ) : (
            data.map(item => (
              <Card key={item.contrato_id} className="border-border/60">
                <CardContent className="p-4 flex items-start gap-3">
                  <Checkbox
                    checked={selecionados.has(item.contrato_id)}
                    onCheckedChange={() => toggle(item.contrato_id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{item.associado_nome ?? '—'}</span>
                      <Badge variant="destructive">Suspenso há {item.dias_suspenso} dia(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Car className="h-3 w-3" />{item.placa ?? '—'} · {item.marca ?? ''} {item.modelo ?? ''}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.associado_telefone ?? '—'}</span>
                      {item.data_assinatura && (
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Assinou em {format(new Date(item.data_assinatura), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirDialog([item.contrato_id])} disabled={liberar.isPending}>
                    Liberar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar {alvos.length} associado(s)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O associado receberá WhatsApp com o link para reagendar a vistoria/instalação.
            A cobertura de roubo/furto volta imediatamente; a Proteção 360 será ativada após a instalação concluída.
          </p>
          <Textarea placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={liberar.isPending}>
              {liberar.isPending ? 'Liberando…' : 'Confirmar liberação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
