import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Inbox } from 'lucide-react';
import {
  EmailEnvioStatus,
  EmailSuspensaoEnvio,
  useEmailSuspensaoEnvios,
  useEmailSuspensaoFluxos,
} from '@/hooks/emails-suspensao/useEmailSuspensao';
import { EnvioDetalheDialog } from './EnvioDetalheDialog';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<EmailEnvioStatus, { label: string; className: string }> = {
  entregue: { label: 'Entregue', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  falhou: { label: 'Falhou', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
};

export function HistoricoEnvios() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmailEnvioStatus | 'all'>('all');
  const [fluxo, setFluxo] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EmailSuspensaoEnvio | null>(null);

  const { data, isLoading } = useEmailSuspensaoEnvios({
    search,
    status,
    fluxo,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: fluxos = [] } = useEmailSuspensaoFluxos();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9"
            />
          </div>

          <Select
            value={status}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v as EmailEnvioStatus | 'all');
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="falhou">Falhou</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={fluxo}
            onValueChange={(v) => {
              setPage(1);
              setFluxo(v);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Fluxo de suspensão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fluxos</SelectItem>
              {fluxos.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Data/hora</TableHead>
                <TableHead>Fluxo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (data?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-3 h-10 w-10 opacity-50" />
                    <p className="font-medium">Nenhum envio registrado ainda.</p>
                    <p className="text-sm mt-1">
                      O histórico será populado quando o envio de e-mails for ligado em fase posterior.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data!.rows.map((envio) => {
                  const st = STATUS_LABEL[envio.status];
                  return (
                    <TableRow
                      key={envio.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(envio)}
                    >
                      <TableCell className="font-medium">
                        {envio.cliente_nome || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{envio.destinatario}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(envio.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {envio.fluxo_origem || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={st.className} variant="secondary">
                          {st.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} envio{total === 1 ? '' : 's'} · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        <EnvioDetalheDialog envio={selected} onOpenChange={(open) => !open && setSelected(null)} />
      </CardContent>
    </Card>
  );
}
