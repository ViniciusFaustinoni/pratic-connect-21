import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldAlert, CheckCircle2, Phone, Car, Calendar, XCircle, AlertTriangle } from 'lucide-react';
import {
  useLiberacoesAutoVistoria,
  useLiberarAutoVistoria,
  useCancelarAdesaoNaoInstalada,
} from '@/hooks/useLiberacoesAutoVistoria';
import { format } from 'date-fns';

export default function LiberacoesAutoVistoria() {
  const { data, isLoading } = useLiberacoesAutoVistoria();
  const liberar = useLiberarAutoVistoria();
  const cancelar = useCancelarAdesaoNaoInstalada();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [dialogLiberarOpen, setDialogLiberarOpen] = useState(false);
  const [motivoLiberar, setMotivoLiberar] = useState('');
  const [alvosLiberar, setAlvosLiberar] = useState<string[]>([]);

  const [dialogCancelarOpen, setDialogCancelarOpen] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [alvosCancelar, setAlvosCancelar] = useState<string[]>([]);

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

  const abrirLiberar = (ids: string[]) => {
    setAlvosLiberar(ids);
    setMotivoLiberar('');
    setDialogLiberarOpen(true);
  };

  const abrirCancelar = (ids: string[]) => {
    setAlvosCancelar(ids);
    setMotivoCancelar('');
    setDialogCancelarOpen(true);
  };

  const confirmarLiberar = async () => {
    await liberar.mutateAsync({ contrato_ids: alvosLiberar, motivo: motivoLiberar || undefined });
    setSelecionados(new Set());
    setDialogLiberarOpen(false);
  };

  const confirmarCancelar = async () => {
    await cancelar.mutateAsync({ contrato_ids: alvosCancelar, motivo: motivoCancelar });
    setSelecionados(new Set());
    setDialogCancelarOpen(false);
  };

  const motivoCancelarValido = motivoCancelar.trim().length >= 10;
  const busy = liberar.isPending || cancelar.isPending;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Liberações — Auto-Vistoria
        </h1>
        <p className="text-muted-foreground">
          Associados com cobertura suspensa por não terem feito a instalação do rastreador no prazo após a auto-vistoria.
          Libere para que possam reagendar, ou cancele a adesão de quem não vai mais instalar.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {data?.length ?? 0} associado(s) aguardando decisão
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleTodos} disabled={!data?.length}>
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={selecionados.size === 0 || busy}
              onClick={() => abrirCancelar([...selecionados])}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar selecionados ({selecionados.size})
            </Button>
            <Button
              size="sm"
              disabled={selecionados.size === 0 || busy}
              onClick={() => abrirLiberar([...selecionados])}
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
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => abrirCancelar([item.contrato_id])} disabled={busy}>
                      Cancelar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrirLiberar([item.contrato_id])} disabled={busy}>
                      Liberar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Liberar */}
      <Dialog open={dialogLiberarOpen} onOpenChange={setDialogLiberarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar {alvosLiberar.length} associado(s)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O associado receberá WhatsApp com o link para reagendar a vistoria/instalação.
            A cobertura de roubo/furto volta imediatamente; a Proteção 360 será ativada após a instalação concluída.
          </p>
          <Textarea placeholder="Motivo (opcional)" value={motivoLiberar} onChange={(e) => setMotivoLiberar(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogLiberarOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarLiberar} disabled={liberar.isPending}>
              {liberar.isPending ? 'Liberando…' : 'Confirmar liberação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar adesão */}
      <Dialog open={dialogCancelarOpen} onOpenChange={setDialogCancelarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar {alvosCancelar.length} adesão(ões)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Esta ação <strong>encerra a adesão</strong> do(s) associado(s) que não instalou(aram) o rastreador no prazo.
              O contrato será cancelado, a cotação encerrada e os serviços/agendamentos em aberto serão fechados.
              O associado receberá um WhatsApp informando o cancelamento e o motivo.
            </p>
            <p className="text-destructive font-medium">Ação irreversível.</p>
          </div>
          <Textarea
            placeholder="Motivo do cancelamento (obrigatório, mín. 10 caracteres)"
            value={motivoCancelar}
            onChange={(e) => setMotivoCancelar(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCancelarOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={confirmarCancelar} disabled={cancelar.isPending || !motivoCancelarValido}>
              {cancelar.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
