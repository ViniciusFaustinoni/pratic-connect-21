import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { MarcaModeloRuleSelector, type MarcaSelection } from './MarcaModeloRuleSelector';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useRulesForEntity,
  useSaveRule,
  useDeleteRule,
  type EntityType,
  type RuleType,
  type RuleMode,
  type EligibilityRule,
} from '@/hooks/useEntityEligibilityRules';
import { useCategoriasVeiculoPlano, useCategoriasVeiculo, useConfiguracaoJson, useCombustiveis } from '@/hooks/useConteudosSistema';
import { useRegioes } from '@/hooks/useRegioes';

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  fipe_range: 'Faixa FIPE',
  fipe_eligibility: 'Elegibilidade FIPE',
  ano_range: 'Faixa de Ano',
  categoria_veiculo: 'Categoria de Veículo',
  categoria_especial: 'Categoria Especial',
  regiao: 'Região',
  marca_modelo: 'Marca / Modelo / Versão',
  tipo_uso: 'Tipo de Uso',
  combustivel: 'Combustível',
  tipo_placa: 'Tipo de Placa',
};

const RULE_TYPE_ICONS: Record<RuleType, string> = {
  fipe_range: '💰',
  fipe_eligibility: '🎯',
  ano_range: '📅',
  categoria_veiculo: '🚗',
  categoria_especial: '⚠️',
  regiao: '📍',
  marca_modelo: '🏭',
  tipo_uso: '🔑',
  combustivel: '⛽',
  tipo_placa: '🪪',
};

interface EligibilityRulesEditorProps {
  entityType: EntityType;
  entityId: string | undefined;
  compact?: boolean;
}

export function EligibilityRulesEditor({ entityType, entityId, compact }: EligibilityRulesEditorProps) {
  const { data: rules = [], isLoading } = useRulesForEntity(entityType, entityId);
  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EligibilityRule | null>(null);

  if (!entityId) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        Salve primeiro para configurar regras de elegibilidade.
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (confirm('Remover esta regra?')) {
      deleteRule.mutate(id);
    }
  };

  const handleEdit = (rule: EligibilityRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingRule(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">Regras de Elegibilidade</Label>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhuma regra configurada — aceita todos os veículos.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <AddRuleDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        entityType={entityType}
        entityId={entityId}
        onSave={saveRule}
        editingRule={editingRule}
      />
    </div>
  );
}

// ============================================
// Rule Card
// ============================================

function RuleCard({ rule, onDelete, onEdit }: { rule: EligibilityRule; onDelete: (id: string) => void; onEdit: (rule: EligibilityRule) => void }) {
  const cfg = rule.rule_config;
  const icon = RULE_TYPE_ICONS[rule.rule_type] || '📋';
  const label = RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type;

  const descParts: string[] = [];
  switch (rule.rule_type) {
    case 'fipe_range':
      descParts.push(`R$ ${(cfg.min || 0).toLocaleString('pt-BR')} — R$ ${(cfg.max || 0).toLocaleString('pt-BR')}`);
      break;
    case 'ano_range':
      descParts.push(`${cfg.min || '?'} — ${cfg.max || '?'}`);
      break;
    case 'categoria_veiculo':
    case 'categoria_especial':
      descParts.push((cfg.categorias || []).join(', '));
      break;
    case 'regiao':
      descParts.push((cfg.regioes || []).join(', '));
      break;
    case 'marca_modelo':
      if (cfg.marcas && Array.isArray(cfg.marcas)) {
        descParts.push(
          (cfg.marcas as MarcaSelection[]).map((m) => {
            let s = m.marca;
            if (m.modelos?.length) s += ` (${m.modelos.join(', ')})`;
            if (m.anos?.length) s += ` · ${m.anos.join(', ')}`;
            return s;
          }).join(' | ')
        );
      } else {
        if (cfg.marca) descParts.push(cfg.marca);
        if (cfg.modelo) descParts.push(cfg.modelo);
        if (cfg.versao) descParts.push(cfg.versao);
      }
      break;
    case 'tipo_uso':
      descParts.push((cfg.tipos || []).join(', '));
      break;
    case 'combustivel':
      descParts.push((cfg.combustiveis || []).join(', '));
      break;
  }

  return (
    <div
      className="flex items-center justify-between rounded-lg border p-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onEdit(rule)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span>{icon}</span>
        <div className="min-w-0">
          <span className="font-medium">{label}</span>
          <Badge variant={rule.rule_mode === 'include' ? 'default' : 'destructive'} className="ml-2 text-[10px]">
            {rule.rule_mode === 'include' ? 'Inclusiva' : 'Exclusiva'}
          </Badge>
          {descParts.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{descParts.join(' · ')}</p>
          )}
        </div>
      </div>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

// ============================================
// Add Rule Dialog
// ============================================

function AddRuleDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  onSave,
  editingRule,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: EntityType;
  entityId: string;
  onSave: ReturnType<typeof useSaveRule>;
  editingRule?: EligibilityRule | null;
}) {
  const [ruleType, setRuleType] = useState<RuleType>('fipe_range');
  const [ruleMode, setRuleMode] = useState<RuleMode>('include');
  const [config, setConfig] = useState<Record<string, any>>({});

  const isEditing = !!editingRule;

  useEffect(() => {
    if (editingRule) {
      setRuleType(editingRule.rule_type);
      setRuleMode(editingRule.rule_mode);
      setConfig({ ...editingRule.rule_config });
    } else {
      setRuleType('fipe_range');
      setRuleMode('include');
      setConfig({});
    }
  }, [editingRule]);

  // Data from CRUD
  const { data: categoriasVeiculo = [] } = useCategoriasVeiculoPlano();
  const { data: categoriasEspeciais = [] } = useCategoriasVeiculo();
  const { data: tiposUso = [] } = useConfiguracaoJson<{ value: string; label: string }[]>('tipos_uso', []);
  const { data: combustiveis = [] } = useCombustiveis();
  const { data: tiposPlaca = [] } = useConfiguracaoJson<{ value: string; label: string; ativo?: boolean }[]>('tipos_placa', []);
  const { data: regioes = [] } = useRegioes();

  const handleSave = async () => {
    await onSave.mutateAsync({
      entity_type: entityType,
      entity_id: entityId,
      rule_type: ruleType,
      rule_mode: ruleMode,
      rule_config: config,
    });
    setConfig({});
    onOpenChange(false);
  };

  const toggleArrayItem = (key: string, value: string) => {
    setConfig((prev) => {
      const arr: string[] = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Regra de Elegibilidade' : 'Adicionar Regra de Elegibilidade'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de regra */}
          <div className="space-y-2">
            <Label>Tipo de Regra</Label>
            <Select value={ruleType} onValueChange={(v) => { setRuleType(v as RuleType); setConfig({}); }} disabled={isEditing}>
              <SelectTrigger className={isEditing ? 'opacity-60' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {RULE_TYPE_ICONS[rt]} {RULE_TYPE_LABELS[rt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modo */}
          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={ruleMode === 'include'} onChange={() => setRuleMode('include')} />
                Inclusiva (aceitar)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={ruleMode === 'exclude'} onChange={() => setRuleMode('exclude')} />
                Exclusiva (bloquear)
              </label>
            </div>
          </div>

          {/* Dynamic config form */}
          {ruleType === 'fipe_range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">FIPE Mínimo</Label>
                <Input type="number" value={config.min || ''} onChange={(e) => setConfig((p) => ({ ...p, min: Number(e.target.value) }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">FIPE Máximo</Label>
                <Input type="number" value={config.max || ''} onChange={(e) => setConfig((p) => ({ ...p, max: Number(e.target.value) }))} placeholder="999999" />
              </div>
            </div>
          )}

          {ruleType === 'ano_range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Ano Mínimo</Label>
                <Input type="number" value={config.min || ''} onChange={(e) => setConfig((p) => ({ ...p, min: Number(e.target.value) }))} placeholder="2000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano Máximo</Label>
                <Input type="number" value={config.max || ''} onChange={(e) => setConfig((p) => ({ ...p, max: Number(e.target.value) }))} placeholder="2030" />
              </div>
            </div>
          )}

          {ruleType === 'categoria_veiculo' && (
            <div className="space-y-2">
              <Label className="text-xs">Categorias de Veículo</Label>
              <div className="grid grid-cols-2 gap-2">
                {categoriasVeiculo.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.categorias || []).includes(cat.value)}
                      onCheckedChange={() => toggleArrayItem('categorias', cat.value)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'categoria_especial' && (
            <div className="space-y-2">
              <Label className="text-xs">Categorias Especiais</Label>
              <div className="grid grid-cols-2 gap-2">
                {categoriasEspeciais.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.categorias || []).includes(cat.value)}
                      onCheckedChange={() => toggleArrayItem('categorias', cat.value)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'regiao' && (
            <div className="space-y-2">
              <Label className="text-xs">Regiões</Label>
              <div className="grid grid-cols-2 gap-2">
                {regioes?.filter((r) => r.ativa).map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.regioes || []).includes(r.codigo)}
                      onCheckedChange={() => toggleArrayItem('regioes', r.codigo)}
                    />
                    {r.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'marca_modelo' && (
            <div className="space-y-2">
              <Label className="text-xs">Marcas e Modelos</Label>
              <MarcaModeloRuleSelector
                value={(config.marcas as MarcaSelection[]) || []}
                onChange={(marcas) => setConfig((p) => ({ ...p, marcas }))}
              />
            </div>
          )}

          {ruleType === 'tipo_uso' && (
            <div className="space-y-2">
              <Label className="text-xs">Tipos de Uso</Label>
              <div className="grid grid-cols-2 gap-2">
                {tiposUso.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.tipos || []).includes(t.value)}
                      onCheckedChange={() => toggleArrayItem('tipos', t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'combustivel' && (
            <div className="space-y-2">
              <Label className="text-xs">Combustíveis</Label>
              <div className="grid grid-cols-2 gap-2">
                {combustiveis.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.combustiveis || []).includes(c.value)}
                      onCheckedChange={() => toggleArrayItem('combustiveis', c.value)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'tipo_placa' && (
            <div className="space-y-2">
              <Label className="text-xs">Tipos de Placa</Label>
              <div className="grid grid-cols-2 gap-2">
                {tiposPlaca.filter(t => t.ativo !== false).map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.values || []).includes(t.value)}
                      onCheckedChange={() => toggleArrayItem('values', t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={onSave.isPending}>
              Salvar Regra
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
