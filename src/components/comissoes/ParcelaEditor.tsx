import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUp, ArrowDown, Building2, Infinity as InfinityIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export interface NivelForm {
  id?: string;
  nome: string;
  percentual: number;
  role: string;
}

export interface ParcelaForm {
  id?: string;
  numero_parcela: number | null;
  vitalicia: boolean;
  vitalicia_inicio_parcela: number | null;
  label: string;
  ordem: number;
  niveis: NivelForm[];
}

interface ParcelaEditorProps {
  parcela: ParcelaForm;
  index: number;
  onChange: (next: ParcelaForm) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  commercialRoles: { role: string; label: string }[];
}

export function ParcelaEditor({
  parcela, index, onChange, onRemove, onMove, canMoveUp, canMoveDown, commercialRoles,
}: ParcelaEditorProps) {
  const [open, setOpen] = useState(true);
  const total = parcela.niveis.reduce((s, n) => s + (Number(n.percentual) || 0), 0);
  const exceeds = total > 100;

  const updateNivel = (idx: number, field: keyof NivelForm, value: string | number) => {
    onChange({
      ...parcela,
      niveis: parcela.niveis.map((n, i) => i === idx ? { ...n, [field]: value } : n),
    });
  };
  const addNivel = () => onChange({ ...parcela, niveis: [...parcela.niveis, { nome: '', percentual: 0, role: '' }] });
  const removeNivel = (idx: number) => onChange({ ...parcela, niveis: parcela.niveis.filter((_, i) => i !== idx) });
  const moveNivel = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= parcela.niveis.length) return;
    const copy = [...parcela.niveis];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange({ ...parcela, niveis: copy });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {parcela.vitalicia ? (
            <Badge variant="default" className="gap-1">
              <InfinityIcon className="h-3 w-3" /> Vitalícia
            </Badge>
          ) : (
            <Badge variant="secondary">Parcela {parcela.numero_parcela}</Badge>
          )}
          <Input
            className="h-8 max-w-xs"
            value={parcela.label}
            onChange={e => onChange({ ...parcela, label: e.target.value })}
            placeholder="Rótulo (ex: Taxa de Adesão)"
          />
          {!parcela.vitalicia && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Nº</span>
              <Input
                type="number"
                min={1}
                className="h-8 w-16"
                value={parcela.numero_parcela ?? ''}
                onChange={e => onChange({ ...parcela, numero_parcela: parseInt(e.target.value) || null })}
              />
            </div>
          )}
          {parcela.vitalicia && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">A partir da parcela</span>
              <Input
                type="number"
                min={1}
                className="h-8 w-16"
                value={parcela.vitalicia_inicio_parcela ?? ''}
                onChange={e => onChange({ ...parcela, vitalicia_inicio_parcela: parseInt(e.target.value) || null })}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(-1)} disabled={!canMoveUp}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(1)} disabled={!canMoveDown}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Níveis comissionados</CardTitle>
            <Button variant="outline" size="sm" onClick={addNivel}>
              <Plus className="h-4 w-4 mr-1" /> Nível
            </Button>
          </div>

          {parcela.niveis.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhum nível nesta parcela. O valor inteiro vai para a empresa.
            </p>
          ) : (
            parcela.niveis.map((nivel, idx) => (
              <TooltipProvider key={idx} delayDuration={200}>
                <div className="flex items-center gap-2 bg-muted/40 rounded-md p-2">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveNivel(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveNivel(idx, 1)} disabled={idx === parcela.niveis.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-44">
                    <Select
                      value={nivel.role}
                      onValueChange={(val) => {
                        const cfg = commercialRoles.find(r => r.role === val);
                        onChange({
                          ...parcela,
                          niveis: parcela.niveis.map((n, i) => i === idx ? { ...n, role: val, nome: n.nome || (cfg?.label || '') } : n),
                        });
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Perfil *" />
                      </SelectTrigger>
                      <SelectContent>
                        {commercialRoles.map(r => (
                          <SelectItem key={r.role} value={r.role}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="flex-1 h-9"
                    placeholder="Nome do nível"
                    value={nivel.nome}
                    onChange={e => updateNivel(idx, 'nome', e.target.value)}
                  />
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number" min={0} max={100} step={0.5}
                      className="h-9 w-20"
                      value={nivel.percentual}
                      onChange={e => updateNivel(idx, 'percentual', parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeNivel(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TooltipProvider>
            ))
          )}

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total alocado:</span>
              <span className={exceeds ? 'text-destructive font-semibold' : 'font-medium text-foreground'}>
                {total}% de 100%
              </span>
            </div>
            <Progress value={Math.min(total, 100)} className="h-1.5" indicatorClassName={exceeds ? 'bg-destructive' : undefined} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Empresa:
              </span>
              <span className="font-medium text-primary">
                {total >= 100 ? '0%' : `${100 - total}%`}
              </span>
            </div>
            {exceeds && (
              <p className="text-xs text-destructive">A soma não pode ultrapassar 100%.</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
