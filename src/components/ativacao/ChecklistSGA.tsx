import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import type { ChecklistSGAItem, ChecklistSGAResult } from '@/hooks/useChecklistSGA';
import { cn } from '@/lib/utils';

interface ChecklistSGAProps {
  checklist: ChecklistSGAResult;
}

const secoes = [
  { key: 'associado' as const, label: 'Associado' },
  { key: 'veiculo' as const, label: 'Veículo' },
  { key: 'sistema' as const, label: 'Sistema / Dependências' },
];

function StatusIcon({ status }: { status: ChecklistSGAItem['status'] }) {
  switch (status) {
    case 'ok':
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case 'faltando':
      return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    case 'risco':
      return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  }
}

function SecaoChecklist({ label, itens }: { label: string; itens: ChecklistSGAItem[] }) {
  const [open, setOpen] = useState(true);
  const temProblema = itens.some(i => i.status !== 'ok');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-medium py-1 hover:opacity-80">
        <span className={cn(
          'w-2 h-2 rounded-full shrink-0',
          temProblema ? 'bg-destructive' : 'bg-green-500'
        )} />
        {label}
        <span className="text-xs text-muted-foreground ml-auto">
          {itens.filter(i => i.status === 'ok').length}/{itens.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-1 pb-2">
        {itens.map((item) => (
          <div key={item.campo} className="flex items-start gap-2 text-sm">
            <StatusIcon status={item.status} />
            <div className="min-w-0">
              <span className="font-medium">{item.label}</span>
              {item.valor && item.status === 'ok' && (
                <span className="text-muted-foreground ml-1 text-xs">({item.valor})</span>
              )}
              {item.detalhe && (
                <p className="text-xs text-muted-foreground">{item.detalhe}</p>
              )}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChecklistSGA({ checklist }: ChecklistSGAProps) {
  const { itens, contadores, pronto, isLoading } = checklist;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando dados para o SGA...
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-1 text-sm">
      {/* Resumo */}
      <div className="flex items-center gap-3 pb-2 border-b mb-2">
        <span className="font-medium">Diagnóstico pré-envio</span>
        <div className="flex items-center gap-2 ml-auto text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" /> {contadores.ok}
          </span>
          {contadores.risco > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="w-3 h-3" /> {contadores.risco}
            </span>
          )}
          {contadores.faltando > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="w-3 h-3" /> {contadores.faltando}
            </span>
          )}
        </div>
      </div>

      {/* Seções */}
      {secoes.map(({ key, label }) => {
        const secaoItens = itens.filter(i => i.secao === key);
        if (secaoItens.length === 0) return null;
        return <SecaoChecklist key={key} label={label} itens={secaoItens} />;
      })}

      {/* Mensagem de bloqueio */}
      {!pronto && (
        <div className="pt-2 border-t mt-2">
          <p className="text-xs text-destructive font-medium">
            ⚠ Existem campos obrigatórios faltando. O envio ao SGA será bloqueado até que sejam preenchidos.
          </p>
        </div>
      )}
    </div>
  );
}
