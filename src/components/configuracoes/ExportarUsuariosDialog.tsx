import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import { useAppRoles } from '@/hooks/useAppRoles';
import {
  countUsuariosForExport,
  fetchUsuariosForExport,
  type ExportFilters,
  type UsuarioExportRow,
} from '@/hooks/useUsuariosExport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Formato = 'xlsx' | 'csv';
type Status = 'ativo' | 'inativo' | 'todos';
type Tipo = 'todos' | 'funcionario' | 'prestador' | 'agencia';

interface CampoDef {
  key: keyof UsuarioExportRow | 'status_label' | 'roles_label';
  label: string;
  default: boolean;
  format?: (row: UsuarioExportRow, getRoleLabel: (r: string) => string) => string | number;
}

const TIPO_LABEL: Record<string, string> = {
  funcionario: 'Funcionário',
  prestador: 'Prestador',
  agencia: 'Agência',
};

const CAMPOS: CampoDef[] = [
  { key: 'nome', label: 'Nome', default: true, format: r => r.nome ?? '' },
  { key: 'email', label: 'Email', default: true, format: r => r.email ?? '' },
  { key: 'telefone', label: 'Telefone', default: true, format: r => r.telefone ?? '' },
  { key: 'cpf', label: 'CPF', default: false, format: r => r.cpf ?? '' },
  { key: 'tipo', label: 'Tipo', default: true, format: r => TIPO_LABEL[r.tipo ?? ''] || (r.tipo ?? '') },
  {
    key: 'roles_label',
    label: 'Perfis',
    default: true,
    format: (r, getRoleLabel) => r.roles.map(getRoleLabel).join('; '),
  },
  { key: 'codigo_sga_voluntario', label: 'Código SGA', default: false, format: r => r.codigo_sga_voluntario ?? '' },
  {
    key: 'status_label',
    label: 'Status',
    default: true,
    format: r => (r.bloqueado ? 'Bloqueado' : r.ativo ? 'Ativo' : 'Inativo'),
  },
  {
    key: 'created_at',
    label: 'Cadastro',
    default: true,
    format: r => (r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy') : ''),
  },
  {
    key: 'ultimo_acesso',
    label: 'Último acesso',
    default: false,
    format: r => (r.ultimo_acesso ? format(new Date(r.ultimo_acesso), 'dd/MM/yyyy HH:mm') : ''),
  },
];

/** Sanitiza valor para CSV (CSV injection prevention). */
function sanitize(value: string | number): string {
  const s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = sanitize(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers, ...rows].map(r => r.map(escape).join(';')).join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportarUsuariosDialog({ open, onOpenChange }: Props) {
  const { roles, getRoleLabel, getRolesByArea, isLoading: loadingRoles } = useAppRoles();

  const rolesByArea = useMemo(() => {
    const grouped = getRolesByArea();
    // Remove associado e áreas vazias
    const out: Record<string, typeof roles> = {};
    Object.entries(grouped).forEach(([area, list]) => {
      const filtered = list.filter(r => r.role !== 'associado');
      if (filtered.length) out[area] = filtered;
    });
    return out;
  }, [roles]);

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [status, setStatus] = useState<Status>('ativo');
  const [campos, setCampos] = useState<Set<string>>(
    new Set(CAMPOS.filter(c => c.default).map(c => String(c.key)))
  );
  const [formato, setFormato] = useState<Formato>('xlsx');
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reset ao reabrir
  useEffect(() => {
    if (open) {
      setSelectedRoles(new Set());
      setTipo('todos');
      setStatus('ativo');
      setCampos(new Set(CAMPOS.filter(c => c.default).map(c => String(c.key))));
      setFormato('xlsx');
      setCount(null);
    }
  }, [open]);

  // Preview de contagem (debounce simples)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const n = await countUsuariosForExport({
          roles: selectedRoles.size ? Array.from(selectedRoles) : undefined,
          tipo,
          status,
        });
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, selectedRoles, tipo, status]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const toggleArea = (areaRoles: string[]) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      const allSelected = areaRoles.every(r => next.has(r));
      if (allSelected) areaRoles.forEach(r => next.delete(r));
      else areaRoles.forEach(r => next.add(r));
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    Object.values(rolesByArea).forEach(list => list.forEach(r => all.add(r.role)));
    setSelectedRoles(all);
  };

  const clearAll = () => setSelectedRoles(new Set());

  const toggleCampo = (key: string) => {
    setCampos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    const camposSelecionados = CAMPOS.filter(c => campos.has(String(c.key)));
    if (camposSelecionados.length === 0) {
      toast.error('Selecione ao menos um campo para exportar');
      return;
    }
    setExporting(true);
    try {
      const data = await fetchUsuariosForExport({
        roles: selectedRoles.size ? Array.from(selectedRoles) : undefined,
        tipo,
        status,
      });

      if (data.length === 0) {
        toast.warning('Nenhum usuário encontrado com os filtros selecionados');
        return;
      }

      const headers = camposSelecionados.map(c => c.label);
      const rows = data.map(row =>
        camposSelecionados.map(c => (c.format ? c.format(row, getRoleLabel) : ''))
      );

      const stamp = format(new Date(), 'yyyy-MM-dd_HHmm');
      const filename = `usuarios_${stamp}.${formato}`;

      if (formato === 'csv') {
        const csv = toCSV(headers, rows);
        // BOM para Excel BR abrir UTF-8 corretamente
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, filename);
      } else {
        const sheetData = [headers, ...rows.map(r => r.map(v => sanitize(v)))];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        // Largura básica das colunas
        ws['!cols'] = headers.map(h => ({ wch: Math.max(12, Math.min(40, h.length + 6)) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
        XLSX.writeFile(wb, filename);
      }

      toast.success(`${data.length} usuário(s) exportado(s)`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao exportar', { description: err?.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !exporting && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar usuários
          </DialogTitle>
          <DialogDescription>
            Selecione perfis, filtros e campos. Sem perfis selecionados, exporta todos (exceto associados).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-2">
            {/* Perfis */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Perfis</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                    Selecionar todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                    Limpar
                  </Button>
                </div>
              </div>

              {loadingRoles ? (
                <p className="text-sm text-muted-foreground">Carregando perfis…</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(rolesByArea).map(([area, list]) => {
                    const areaRoleKeys = list.map(r => r.role);
                    const allSelected = areaRoleKeys.every(r => selectedRoles.has(r));
                    const someSelected = areaRoleKeys.some(r => selectedRoles.has(r));
                    return (
                      <div key={area} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                              onCheckedChange={() => toggleArea(areaRoleKeys)}
                            />
                            <span className="font-medium text-sm">{area}</span>
                            <Badge variant="outline" className="text-xs">
                              {list.length}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                          {list.map(r => (
                            <label
                              key={r.role}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedRoles.has(r.role)}
                                onCheckedChange={() => toggleRole(r.role)}
                              />
                              <span>{r.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Separator />

            {/* Filtros adicionais */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Apenas ativos</SelectItem>
                    <SelectItem value="inativo">Apenas inativos</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipo</Label>
                <Select value={tipo} onValueChange={v => setTipo(v as Tipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="prestador">Prestador</SelectItem>
                    <SelectItem value="agencia">Agência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {/* Campos */}
            <section className="space-y-3">
              <Label className="text-sm font-semibold">Campos a exportar</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPOS.map(c => (
                  <label
                    key={String(c.key)}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={campos.has(String(c.key))}
                      onCheckedChange={() => toggleCampo(String(c.key))}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* Formato */}
            <section className="space-y-2">
              <Label className="text-sm font-semibold">Formato</Label>
              <Select value={formato} onValueChange={v => setFormato(v as Formato)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-3 border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {counting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
              </span>
            ) : count !== null ? (
              <span>
                <strong className="text-foreground">{count}</strong> usuário(s) serão exportado(s)
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting || count === 0}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
