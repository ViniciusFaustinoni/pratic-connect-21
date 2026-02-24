import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, XCircle, CheckCircle } from 'lucide-react';
import type { OrcamentoHistorico } from '@/hooks/useOrcamentoReparo';

const ACAO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  item_adicionado: Plus,
  item_editado: Pencil,
  item_cancelado: XCircle,
  consolidado: CheckCircle,
};

const ACAO_COLOR: Record<string, string> = {
  item_adicionado: 'text-green-600',
  item_editado: 'text-blue-600',
  item_cancelado: 'text-red-600',
  consolidado: 'text-emerald-600',
};

interface Props {
  historico: OrcamentoHistorico[];
}

export function HistoricoAlteracoes({ historico }: Props) {
  if (!historico.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada.</p>;
  }

  return (
    <div className="space-y-3">
      {historico.map((h) => {
        const Icon = ACAO_ICON[h.acao] || Pencil;
        const color = ACAO_COLOR[h.acao] || 'text-muted-foreground';
        return (
          <div key={h.id} className="flex gap-3 text-sm">
            <div className={`mt-0.5 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{h.descricao}</p>
              {h.motivo && <p className="text-xs text-muted-foreground">Motivo: {h.motivo}</p>}
              <p className="text-xs text-muted-foreground">
                {h.usuario_nome} • {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
