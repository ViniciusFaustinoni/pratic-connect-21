import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, FileText, Plus, Edit, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlanoContas } from '@/hooks/useContabilidade';

interface PlanoContasTreeProps {
  contas: PlanoContas[];
  onEdit?: (conta: PlanoContas) => void;
  onAddChild?: (contaPai: PlanoContas) => void;
  onDeactivate?: (conta: PlanoContas) => void;
}

const tipoColors: Record<string, string> = {
  ativo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  passivo: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  patrimonio_liquido: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  receita: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  despesa: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const tipoLabels: Record<string, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'PL',
  receita: 'Receita',
  despesa: 'Despesa',
};

interface TreeNodeProps {
  conta: PlanoContas;
  level: number;
  onEdit?: (conta: PlanoContas) => void;
  onAddChild?: (contaPai: PlanoContas) => void;
  onDeactivate?: (conta: PlanoContas) => void;
}

function TreeNode({ conta, level, onEdit, onAddChild, onDeactivate }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = conta.children && conta.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group',
          !conta.ativa && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'h-5 w-5 flex items-center justify-center rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Icon */}
        {conta.sintetica ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Code */}
        <span className="font-mono text-sm text-muted-foreground w-24 shrink-0">
          {conta.codigo}
        </span>

        {/* Description */}
        <span className={cn(
          'flex-1 truncate',
          conta.sintetica && 'font-medium'
        )}>
          {conta.descricao}
        </span>

        {/* Type Badge - Only show on first level */}
        {level === 0 && (
          <Badge variant="secondary" className={cn('text-xs', tipoColors[conta.tipo])}>
            {tipoLabels[conta.tipo]}
          </Badge>
        )}

        {/* Nature Badge */}
        {!conta.sintetica && (
          <Badge variant="outline" className="text-xs">
            {conta.natureza === 'devedora' ? 'D' : 'C'}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {conta.sintetica && onAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(conta);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(conta);
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDeactivate && conta.ativa && !conta.sintetica && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeactivate(conta);
              }}
              title="Desativar conta"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {conta.children!.map((child) => (
            <TreeNode
              key={child.id}
              conta={child}
              level={level + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDeactivate={onDeactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanoContasTree({ contas, onEdit, onAddChild, onDeactivate }: PlanoContasTreeProps) {
  if (contas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma conta cadastrada
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {contas.map((conta) => (
        <TreeNode
          key={conta.id}
          conta={conta}
          level={0}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDeactivate={onDeactivate}
        />
      ))}
    </div>
  );
}
