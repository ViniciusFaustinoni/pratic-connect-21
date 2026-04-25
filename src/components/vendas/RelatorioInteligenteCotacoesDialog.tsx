import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useRelatorioCotacoes, type RelatorioFilters } from '@/hooks/useRelatorioCotacoes';
import { supabase } from '@/integrations/supabase/client';

type Situacao = 'todas' | 'em_andamento' | 'finalizadas';

const ETAPAS: Array<{ key: string; label: string }> = [
  { key: 'rascunho', label: 'Rascunho' },
  { key: 'enviada', label: 'Link Enviado' },
  { key: 'escolhendo_plano', label: 'Escolhendo Plano' },
  { key: 'enviando_documentos', label: 'Enviando Docs' },
  { key: 'em_analise', label: 'Em Análise' },
  { key: 'assinando_contrato', label: 'Assinando Contrato' },
  { key: 'pagando_taxa', label: 'Pagando Taxa' },
  { key: 'agendando_vistoria', label: 'Agendando Vistoria' },
  { key: 'concluido', label: 'Fechado' },
  { key: 'perdida', label: 'Recusada/Expirada' },
];

const STATUS_SGA: Array<{ key: RelatorioFilters['statusSga'] extends Array<infer K> | undefined ? K : never; label: string }> = [
  { key: 'nao_enviado', label: 'Não enviado' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'sincronizando', label: 'Sincronizando' },
  { key: 'ativado', label: 'Ativado no SGA' },
  { key: 'erro', label: 'Erro' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface VendedorOpt { id: string; nome: string; }
interface PlanoOpt { id: string; nome: string; }
interface RegiaoOpts { ufs: string[]; cidades: string[]; }

export function RelatorioInteligenteCotacoesDialog({ open, onOpenChange }: Props) {
  const { preview, gerar, loading, previewing } = useRelatorioCotacoes();

  const [dataInicio, setDataInicio] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
  const [situacao, setSituacao] = useState<Situacao>('todas');
  const [etapas, setEtapas] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [vendedorIds, setVendedorIds] = useState<string[]>([]);
  const [planoIds, setPlanoIds] = useState<string[]>([]);
  const [statusSga, setStatusSga] = useState<NonNullable<RelatorioFilters['statusSga']>>([]);

  const [vendedores, setVendedores] = useState<VendedorOpt[]>([]);
  const [planos, setPlanos] = useState<PlanoOpt[]>([]);
  const [regioes, setRegioes] = useState<RegiaoOpts>({ ufs: [], cidades: [] });
  const [previewData, setPreviewData] = useState<{ total: number; fechadas: number } | null>(null);

  // Carrega opções uma vez ao abrir
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: vs }, { data: ps }, { data: cs }] = await Promise.all([
        supabase.from('profiles').select('user_id, nome, full_name').limit(500),
        supabase.from('planos').select('id, nome').eq('ativo', true).order('nome').limit(500),
        supabase.from('cotacoes').select('cliente_uf, cliente_cidade').limit(2000),
      ]);
      setVendedores(
        (vs || [])
          .map((v: any) => ({ id: v.user_id, nome: v.full_name || v.nome || '—' }))
          .filter((v) => v.nome && v.nome !== '—')
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setPlanos((ps || []).map((p: any) => ({ id: p.id, nome: p.nome })));
      const ufSet = new Set<string>();
      const cidSet = new Set<string>();
      (cs || []).forEach((c: any) => {
        if (c.cliente_uf) ufSet.add(String(c.cliente_uf).toUpperCase());
        if (c.cliente_cidade) cidSet.add(String(c.cliente_cidade).toUpperCase().trim());
      });
      setRegioes({
        ufs: Array.from(ufSet).sort(),
        cidades: Array.from(cidSet).sort(),
      });
    })();
  }, [open]);

  const filters: RelatorioFilters = useMemo(
    () => ({
      dataInicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null,
      dataFim: dataFim ? format(dataFim, 'yyyy-MM-dd') : null,
      ufs,
      cidades,
      situacao,
      etapas,
      vendedorIds,
      planoIds,
      statusSga,
    }),
    [dataInicio, dataFim, ufs, cidades, situacao, etapas, vendedorIds, planoIds, statusSga]
  );

  function aplicarPreset(preset: 'hoje' | '7d' | '30d' | '90d' | 'mes_atual' | 'mes_anterior' | 'ano') {
    const now = new Date();
    switch (preset) {
      case 'hoje':
        setDataInicio(now); setDataFim(now); break;
      case '7d':
        setDataInicio(subDays(now, 7)); setDataFim(now); break;
      case '30d':
        setDataInicio(subDays(now, 30)); setDataFim(now); break;
      case '90d':
        setDataInicio(subDays(now, 90)); setDataFim(now); break;
      case 'mes_atual':
        setDataInicio(startOfMonth(now)); setDataFim(endOfMonth(now)); break;
      case 'mes_anterior': {
        const m = subMonths(now, 1);
        setDataInicio(startOfMonth(m)); setDataFim(endOfMonth(m)); break;
      }
      case 'ano':
        setDataInicio(startOfYear(now)); setDataFim(now); break;
    }
  }

  function toggleArr(setter: (fn: (prev: string[]) => string[]) => void, value: string) {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handlePreview() {
    const r = await preview(filters);
    if (r) setPreviewData(r);
  }

  async function handleGerar() {
    await gerar(filters);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Relatório Inteligente de Cotações
          </DialogTitle>
          <DialogDescription>
            Filtre por período, região, situação e status para gerar um Excel multi-aba.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Período */}
            <section className="space-y-3">
              <Label className="text-sm font-semibold">Período</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  ['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'],
                  ['mes_atual', 'Mês atual'], ['mes_anterior', 'Mês anterior'], ['ano', 'Ano'],
                ].map(([k, lbl]) => (
                  <Button key={k} type="button" variant="outline" size="sm" onClick={() => aplicarPreset(k as any)}>
                    {lbl}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField label="De" value={dataInicio} onChange={setDataInicio} />
                <DateField label="Até" value={dataFim} onChange={setDataFim} />
              </div>
            </section>

            <Separator />

            {/* Situação */}
            <section className="space-y-3">
              <Label className="text-sm font-semibold">Situação</Label>
              <RadioGroup value={situacao} onValueChange={(v) => setSituacao(v as Situacao)} className="flex gap-4">
                {[
                  ['todas', 'Todas'],
                  ['em_andamento', 'Em andamento'],
                  ['finalizadas', 'Finalizadas'],
                ].map(([k, lbl]) => (
                  <div key={k} className="flex items-center gap-2">
                    <RadioGroupItem value={k} id={`sit-${k}`} />
                    <Label htmlFor={`sit-${k}`} className="font-normal cursor-pointer">{lbl}</Label>
                  </div>
                ))}
              </RadioGroup>
            </section>

            <Separator />

            {/* Etapa do funil */}
            <MultiCheck
              label="Etapas do funil"
              hint="Vazio = todas"
              options={ETAPAS.map((e) => ({ value: e.key, label: e.label }))}
              selected={etapas}
              onToggle={(v) => toggleArr(setEtapas, v)}
            />

            <Separator />

            {/* Região */}
            <section className="space-y-3">
              <Label className="text-sm font-semibold">Região</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MultiCheck
                  label="UF"
                  hint="Vazio = todas"
                  compact
                  options={regioes.ufs.map((u) => ({ value: u, label: u }))}
                  selected={ufs}
                  onToggle={(v) => toggleArr(setUfs, v)}
                />
                <MultiCheck
                  label="Cidade"
                  hint="Vazio = todas"
                  compact
                  options={regioes.cidades.map((c) => ({ value: c, label: c }))}
                  selected={cidades}
                  onToggle={(v) => toggleArr(setCidades, v)}
                  searchable
                />
              </div>
            </section>

            <Separator />

            {/* Consultor / Plano */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiCheck
                label="Consultor"
                hint="Vazio = todos"
                compact
                options={vendedores.map((v) => ({ value: v.id, label: v.nome }))}
                selected={vendedorIds}
                onToggle={(v) => toggleArr(setVendedorIds, v)}
                searchable
              />
              <MultiCheck
                label="Plano escolhido"
                hint="Vazio = todos"
                compact
                options={planos.map((p) => ({ value: p.id, label: p.nome }))}
                selected={planoIds}
                onToggle={(v) => toggleArr(setPlanoIds, v)}
                searchable
              />
            </div>

            <Separator />

            {/* Status SGA */}
            <MultiCheck
              label="Status SGA"
              hint="Aplica-se às cotações fechadas"
              options={STATUS_SGA.map((s) => ({ value: s.key as string, label: s.label }))}
              selected={statusSga as string[]}
              onToggle={(v) => {
                setStatusSga((prev) =>
                  prev.includes(v as any)
                    ? prev.filter((x) => x !== (v as any))
                    : ([...prev, v] as any)
                );
              }}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm text-muted-foreground">
            {previewData ? (
              <>
                Prévia: <Badge variant="secondary">{previewData.total} cotações</Badge>{' '}
                <Badge variant="outline">{previewData.fechadas} fechadas</Badge>
              </>
            ) : (
              <span>Use "Calcular prévia" para ver o total antes de exportar.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewing}>
              {previewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calcular prévia
            </Button>
            <Button onClick={handleGerar} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Gerar Excel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface MultiCheckProps {
  label: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
  searchable?: boolean;
}
function MultiCheck({ label, hint, options, selected, onToggle, compact, searchable }: MultiCheckProps) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q) return options;
    const ql = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(ql));
  }, [q, options]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {searchable && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm"
        />
      )}
      <ScrollArea className={cn('rounded-md border', compact ? 'h-40' : 'h-32')}>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground p-2">Nenhuma opção</div>
          )}
          {filtered.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox checked={checked} onCheckedChange={() => onToggle(opt.value)} />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
