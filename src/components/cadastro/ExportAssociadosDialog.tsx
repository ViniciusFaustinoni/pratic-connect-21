import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';

interface ScreenFilters {
  status?: StatusAssociado[];
  plano_id?: string | string[];
  cidade?: string | string[];
  data_adesao_inicio?: string;
  data_adesao_fim?: string;
}

interface ExportAssociadosDialogProps {
  open: boolean;
  onClose: () => void;
  screenFilters: ScreenFilters;
  planos?: { id: string; nome: string }[];
}

const COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'cpf', label: 'CPF' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'veiculo', label: 'Veículo (placa + modelo)' },
  { key: 'plano', label: 'Plano' },
  { key: 'status', label: 'Status' },
  { key: 'data_adesao', label: 'Data de Adesão' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'UF' },
  { key: 'data_nascimento', label: 'Data de Nascimento' },
  { key: 'endereco', label: 'Endereço (logradouro + número)' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cep', label: 'CEP' },
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatTelefone(tel: string | null): string {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return tel;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function ExportAssociadosDialog({
  open,
  onClose,
  screenFilters,
  planos,
}: ExportAssociadosDialogProps) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [usarFiltrosTela, setUsarFiltrosTela] = useState(true);
  const [colunasSelecionadas, setColunasSelecionadas] = useState<string[]>(
    COLUMN_OPTIONS.map(c => c.key)
  );
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);

  // Pré-popula com filtros da tela ao abrir
  useEffect(() => {
    if (open) {
      setDataInicio(screenFilters.data_adesao_inicio || '');
      setDataFim(screenFilters.data_adesao_fim || '');
      setUsarFiltrosTela(true);
      setColunasSelecionadas(COLUMN_OPTIONS.map(c => c.key));
      setFormato('xlsx');
      setProgresso(null);
    }
  }, [open, screenFilters.data_adesao_inicio, screenFilters.data_adesao_fim]);

  const planoNome = useMemo(() => {
    const pid = screenFilters.plano_id;
    if (!pid) return null;
    if (Array.isArray(pid)) {
      if (pid.length === 0) return null;
      return pid.map(id => planos?.find(p => p.id === id)?.nome ?? id).join(', ');
    }
    return planos?.find(p => p.id === pid)?.nome ?? pid;
  }, [screenFilters.plano_id, planos]);

  const aplicarAtalho = (tipo: 'hoje' | '7dias' | 'mes_atual' | 'mes_passado' | '3meses' | 'ano' | 'tudo') => {
    const hoje = new Date();
    if (tipo === 'tudo') { setDataInicio(''); setDataFim(''); return; }
    if (tipo === 'hoje') { setDataInicio(toIso(hoje)); setDataFim(toIso(hoje)); return; }
    if (tipo === '7dias') {
      const ini = new Date(hoje); ini.setDate(ini.getDate() - 7);
      setDataInicio(toIso(ini)); setDataFim(toIso(hoje)); return;
    }
    if (tipo === 'mes_atual') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(toIso(ini)); setDataFim(toIso(hoje)); return;
    }
    if (tipo === 'mes_passado') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      setDataInicio(toIso(ini)); setDataFim(toIso(fim)); return;
    }
    if (tipo === '3meses') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate());
      setDataInicio(toIso(ini)); setDataFim(toIso(hoje)); return;
    }
    if (tipo === 'ano') {
      const ini = new Date(hoje.getFullYear(), 0, 1);
      setDataInicio(toIso(ini)); setDataFim(toIso(hoje));
    }
  };

  const toggleColuna = (key: string, checked: boolean) => {
    setColunasSelecionadas(prev =>
      checked ? [...prev, key] : prev.filter(k => k !== key)
    );
  };

  const marcarTodas = () => setColunasSelecionadas(COLUMN_OPTIONS.map(c => c.key));
  const desmarcarTodas = () => setColunasSelecionadas([]);

  const handleExport = async () => {
    if (colunasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma coluna para exportar.');
      return;
    }
    setExporting(true);
    setProgresso({ atual: 0, total: 0 });

    try {
      const buildBaseQuery = () => {
        let q = supabase
          .from('associados')
          .select(
            `id, nome, cpf, telefone, email, data_adesao, data_nascimento,
             logradouro, numero, bairro, cidade, uf, cep, status,
             planos ( nome ),
             veiculos ( placa, modelo )`,
            { count: 'exact' }
          );

        if (dataInicio) q = q.gte('data_adesao', dataInicio);
        if (dataFim) q = q.lte('data_adesao', dataFim);

        if (usarFiltrosTela) {
          if (screenFilters.status?.length) q = q.in('status', screenFilters.status);
          if (screenFilters.plano_id) {
            if (Array.isArray(screenFilters.plano_id)) {
              if (screenFilters.plano_id.length) q = q.in('plano_id', screenFilters.plano_id);
            } else {
              q = q.eq('plano_id', screenFilters.plano_id);
            }
          }
          if (screenFilters.cidade) {
            if (Array.isArray(screenFilters.cidade)) {
              if (screenFilters.cidade.length) q = q.in('cidade', screenFilters.cidade);
            } else {
              q = q.eq('cidade', screenFilters.cidade);
            }
          }
        }
        return q.order('created_at', { ascending: false });
      };

      // Loop em batches de 1000 até buscar tudo
      const PAGE = 1000;
      let from = 0;
      let total = 0;
      const all: any[] = [];

      // Primeira página para obter count
      const first = await buildBaseQuery().range(0, PAGE - 1);
      if (first.error) throw first.error;
      total = first.count ?? (first.data?.length ?? 0);
      all.push(...(first.data || []));
      setProgresso({ atual: all.length, total });

      from = PAGE;
      while (from < total) {
        const next = await buildBaseQuery().range(from, from + PAGE - 1);
        if (next.error) throw next.error;
        all.push(...(next.data || []));
        from += PAGE;
        setProgresso({ atual: all.length, total });
      }

      if (all.length === 0) {
        toast.warning('Nenhum associado encontrado para os filtros selecionados.');
        setExporting(false);
        return;
      }

      // Monta linhas
      const labelsByKey: Record<string, string> = Object.fromEntries(
        COLUMN_OPTIONS.map(c => [c.key, c.label])
      );

      const rows = all.map((a: any) => {
        const row: Record<string, any> = {};
        for (const key of colunasSelecionadas) {
          const label = labelsByKey[key];
          switch (key) {
            case 'nome': row[label] = a.nome ?? ''; break;
            case 'cpf': row[label] = formatCpf(a.cpf); break;
            case 'telefone': row[label] = formatTelefone(a.telefone); break;
            case 'email': row[label] = a.email ?? ''; break;
            case 'veiculo':
              row[label] = a.veiculos?.[0]
                ? `${a.veiculos[0].placa ?? ''} - ${a.veiculos[0].modelo ?? ''}`.trim().replace(/^- /, '')
                : '';
              break;
            case 'plano': row[label] = a.planos?.nome ?? ''; break;
            case 'status': row[label] = STATUS_ASSOCIADO_LABELS[a.status as StatusAssociado] ?? a.status ?? ''; break;
            case 'data_adesao': row[label] = formatDate(a.data_adesao); break;
            case 'cidade': row[label] = a.cidade ?? ''; break;
            case 'uf': row[label] = a.uf ?? ''; break;
            case 'data_nascimento': row[label] = formatDate(a.data_nascimento); break;
            case 'endereco':
              row[label] = [a.logradouro, a.numero].filter(Boolean).join(', ');
              break;
            case 'bairro': row[label] = a.bairro ?? ''; break;
            case 'cep': row[label] = a.cep ?? ''; break;
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Associados');

      const ini = dataInicio ? dataInicio.replace(/-/g, '') : 'tudo';
      const fim = dataFim ? dataFim.replace(/-/g, '') : toIso(new Date()).replace(/-/g, '');
      const fileName = `associados_${ini}_a_${fim}.${formato}`;

      if (formato === 'csv') {
        XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, fileName);
      }

      toast.success('Exportação concluída', {
        description: `${rows.length.toLocaleString()} associados exportados (${formato.toUpperCase()}).`,
      });
      onClose();
    } catch (err: any) {
      console.error('[ExportAssociados] erro:', err);
      toast.error('Falha na exportação', {
        description: err?.message || 'Não foi possível exportar os associados.',
      });
    } finally {
      setExporting(false);
      setProgresso(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !exporting && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportação Inteligente
          </DialogTitle>
          <DialogDescription>
            Configure o intervalo, filtros, colunas e formato do arquivo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Intervalo de datas */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Intervalo de Datas (Data de Adesão)</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('hoje')}>Hoje</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('7dias')}>Últimos 7 dias</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('mes_atual')}>Mês atual</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('mes_passado')}>Mês passado</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('3meses')}>3 meses</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('ano')}>Ano atual</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('tudo')}>Tudo</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="exp-ini" className="text-xs text-muted-foreground">De</Label>
                  <Input id="exp-ini" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="exp-fim" className="text-xs text-muted-foreground">Até</Label>
                  <Input id="exp-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Filtros aplicados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Filtros da Tela</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="usar-filtros"
                    checked={usarFiltrosTela}
                    onCheckedChange={setUsarFiltrosTela}
                  />
                  <Label htmlFor="usar-filtros" className="text-sm font-normal cursor-pointer">
                    Usar filtros ativos
                  </Label>
                </div>
              </div>
              {usarFiltrosTela ? (
                <div className="flex flex-wrap gap-2">
                  {screenFilters.status?.length ? (
                    screenFilters.status.map(s => (
                      <Badge key={s} variant="secondary">
                        Status: {STATUS_ASSOCIADO_LABELS[s]}
                      </Badge>
                    ))
                  ) : null}
                  {planoNome && <Badge variant="secondary">Plano: {planoNome}</Badge>}
                  {screenFilters.cidade && (Array.isArray(screenFilters.cidade) ? screenFilters.cidade.length > 0 : true) && (
                    <Badge variant="secondary">Cidade: {Array.isArray(screenFilters.cidade) ? screenFilters.cidade.join(', ') : screenFilters.cidade}</Badge>
                  )}
                  {!screenFilters.status?.length && !planoNome && !(screenFilters.cidade && (Array.isArray(screenFilters.cidade) ? screenFilters.cidade.length > 0 : true)) && (
                    <p className="text-xs text-muted-foreground">Nenhum filtro ativo na tela.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Exportando todos os associados dentro do intervalo de datas.
                </p>
              )}
            </div>

            <Separator />

            {/* Colunas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Colunas ({colunasSelecionadas.length}/{COLUMN_OPTIONS.length})
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={marcarTodas}>Marcar todas</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={desmarcarTodas}>Desmarcar</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COLUMN_OPTIONS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={colunasSelecionadas.includes(col.key)}
                      onCheckedChange={(c) => toggleColuna(col.key, c as boolean)}
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Formato */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Formato</Label>
              <RadioGroup value={formato} onValueChange={(v) => setFormato(v as 'xlsx' | 'csv')}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                  <Label htmlFor="fmt-xlsx" className="text-sm font-normal cursor-pointer">Excel (.xlsx)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <Label htmlFor="fmt-csv" className="text-sm font-normal cursor-pointer">CSV (.csv)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {progresso && progresso.total > 0 && (
            <span className="text-xs text-muted-foreground self-center mr-auto">
              Buscando {progresso.atual.toLocaleString()} / {progresso.total.toLocaleString()}…
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
