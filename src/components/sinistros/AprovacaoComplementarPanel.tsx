import { useState } from 'react';
import { useItensComplementaresPendentes, useDecidirItemComplementar } from '@/hooks/useItensComplementares';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  sinistroId?: string;
  canDecide?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

export function AprovacaoComplementarPanel({ sinistroId, canDecide = true }: Props) {
  const { data, isLoading } = useItensComplementaresPendentes(sinistroId);
  const decidir = useDecidirItemComplementar();
  const [rejId, setRejId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const items = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Itens complementares aguardando aprovação
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item complementar pendente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {canDecide && <TableHead className="w-44 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-xs">{it.ordem_servico?.numero ?? '—'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{it.descricao}</div>
                    {it.observacao && <div className="text-xs text-muted-foreground">{it.observacao}</div>}
                  </TableCell>
                  <TableCell className="text-right">{it.quantidade}</TableCell>
                  <TableCell className="text-right">{fmt(it.valor_total)}</TableCell>
                  {canDecide && (
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decidir.mutate({ id: it.id, decisao: 'aprovado' })}
                        disabled={decidir.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRejId(it.id); setMotivo(''); }}
                        disabled={decidir.isPending}
                      >
                        <X className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!rejId} onOpenChange={(o) => !o && setRejId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rejeitar item complementar</DialogTitle></DialogHeader>
            <Textarea
              placeholder="Motivo da rejeição (visível ao reparador)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejId(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!rejId) return;
                  await decidir.mutateAsync({ id: rejId, decisao: 'rejeitado', motivo });
                  setRejId(null);
                }}
                disabled={decidir.isPending || motivo.trim().length < 3}
              >
                Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
