import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import type { VeiculoNegado } from '@/hooks/useVeiculosNegados';

interface Props {
  veiculo: VeiculoNegado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUS_COLOR: Record<string, string> = {
  reprovada: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground',
  concluida: 'bg-emerald-100 text-emerald-800',
  aprovada: 'bg-emerald-100 text-emerald-800',
  agendada: 'bg-blue-100 text-blue-800',
  pendente: 'bg-amber-100 text-amber-800',
};

const fmt = (d?: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—';

export function HistoricoNegadoDrawer({ veiculo, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico — {veiculo?.placa}</SheetTitle>
          <SheetDescription>
            {veiculo?.marca} {veiculo?.modelo} — {veiculo?.associado_nome}
          </SheetDescription>
        </SheetHeader>

        {veiculo && (
          <div className="mt-4 space-y-5">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Negação canônica</p>
              <p className="mt-1"><strong>Motivo:</strong> {veiculo.motivo_recusa_veiculo || '—'}</p>
              <p><strong>Negado em:</strong> {fmt(veiculo.recusado_em)}</p>
              <p><strong>Negado por:</strong> {veiculo.recusado_por_nome || '—'}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">
                Serviços ({veiculo.total_servicos})
              </h3>
              {veiculo.servicos_anteriores.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum serviço registrado.</p>
              )}
              <ul className="space-y-2">
                {veiculo.servicos_anteriores.map((s) => (
                  <li key={s.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.tipo}</span>
                      <Badge className={STATUS_COLOR[s.status] ?? ''} variant="outline">
                        {s.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <p>Data: {s.data_agendada ? format(new Date(s.data_agendada), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</p>
                      <p>Profissional: {s.profissional_nome || '—'}</p>
                      <p>Atualizado: {fmt(s.updated_at)}</p>
                    </div>
                    {s.motivo_reprovacao && (
                      <p className="mt-1 text-xs"><strong>Motivo:</strong> {s.motivo_reprovacao}</p>
                    )}
                    {s.observacoes && (
                      <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                        {s.observacoes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
