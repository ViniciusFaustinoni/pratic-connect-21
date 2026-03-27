import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, DollarSign } from 'lucide-react';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { cn } from '@/lib/utils';

interface TaxaFaixa {
  fipe_de: number;
  fipe_ate: number;
  valor_taxa: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  planoId?: string;
  linhaId?: string;
}

export function PlanoFormSheet({ open, onClose, planoId, linhaId }: Props) {
  const qc = useQueryClient();
  
  // Data sources
  const { data: coberturas = [] } = useCoberturas(true);
  const { data: benefits = [] } = useBenefits();

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [selectedCoberturas, setSelectedCoberturas] = useState<Set<string>>(new Set());
  const [selectedBeneficios, setSelectedBeneficios] = useState<Set<string>>(new Set());
  const [templateContratoId, setTemplateContratoId] = useState<string>('');

  // Taxa administrativa state
  const [taxaFipeMin, setTaxaFipeMin] = useState('');
  const [taxaFipeMax, setTaxaFipeMax] = useState('');
  const [taxaIntervalo, setTaxaIntervalo] = useState('');
  const [taxaFaixas, setTaxaFaixas] = useState<TaxaFaixa[]>([]);

  // Load templates
  const { data: templates = [] } = useQuery({
    queryKey: ['documento_templates_ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_templates')
        .select('id, nome, codigo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });
  

  // Load existing plan
  const { data: existingPlan, isLoading: loadingPlan } = useQuery({
    queryKey: ['plano_edit', planoId],
    queryFn: async () => {
      if (!planoId) return null;
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('id', planoId)
        .single();
      if (error) throw error;

      const { data: cobs } = await supabase.from('planos_coberturas').select('cobertura_id').eq('plano_id', planoId);
      const { data: bens } = await supabase.from('planos_beneficios').select('benefit_id').eq('plano_id', planoId);
      const { data: taxas } = await supabase
        .from('planos_taxa_administrativa')
        .select('fipe_de, fipe_ate, valor_taxa')
        .eq('plano_id', planoId)
        .order('fipe_de', { ascending: true });

      return {
        ...data,
        coberturaIds: (cobs || []).map((c: any) => c.cobertura_id),
        beneficioIds: (bens || []).map((b: any) => b.benefit_id),
        taxasFipe: (taxas || []).map((t: any) => ({
          fipe_de: Number(t.fipe_de),
          fipe_ate: Number(t.fipe_ate),
          valor_taxa: Number(t.valor_taxa),
        })) as TaxaFaixa[],
      };
    },
    enabled: !!planoId,
  });

  useEffect(() => {
    if (existingPlan) {
      setNome(existingPlan.nome || '');
      setDescricao(existingPlan.descricao || '');
      setAtivo(existingPlan.ativo);
      setSelectedCoberturas(new Set(existingPlan.coberturaIds));
      setSelectedBeneficios(new Set(existingPlan.beneficioIds));
      setTemplateContratoId(existingPlan.template_contrato_id || '');
      
      // Load taxa administrativa faixas
      if (existingPlan.taxasFipe && existingPlan.taxasFipe.length > 0) {
        setTaxaFaixas(existingPlan.taxasFipe);
        const first = existingPlan.taxasFipe[0];
        const last = existingPlan.taxasFipe[existingPlan.taxasFipe.length - 1];
        const intervalo = existingPlan.taxasFipe.length > 1
          ? existingPlan.taxasFipe[1].fipe_de - first.fipe_de
          : first.fipe_ate - first.fipe_de;
        setTaxaFipeMin(String(first.fipe_de));
        setTaxaFipeMax(String(last.fipe_ate));
        setTaxaIntervalo(String(intervalo));
      }
    }
  }, [existingPlan]);

  // Generate taxa faixas from min/max/interval
  const generateTaxaFaixas = useCallback(() => {
    const min = parseFloat(taxaFipeMin);
    const max = parseFloat(taxaFipeMax);
    const intervalo = parseFloat(taxaIntervalo);
    if (isNaN(min) || isNaN(max) || isNaN(intervalo) || intervalo <= 0 || max <= min) return;

    const newFaixas: TaxaFaixa[] = [];
    let current = min;
    while (current < max) {
      const fimFaixa = Math.min(current + intervalo, max);
      // Try to keep existing values
      const existing = taxaFaixas.find(f => f.fipe_de === current && f.fipe_ate === fimFaixa);
      newFaixas.push({
        fipe_de: current,
        fipe_ate: fimFaixa,
        valor_taxa: existing?.valor_taxa ?? 0,
      });
      current = fimFaixa;
    }
    setTaxaFaixas(newFaixas);
  }, [taxaFipeMin, taxaFipeMax, taxaIntervalo, taxaFaixas]);

  const canGenerateFaixas = useMemo(() => {
    const min = parseFloat(taxaFipeMin);
    const max = parseFloat(taxaFipeMax);
    const intervalo = parseFloat(taxaIntervalo);
    return !isNaN(min) && !isNaN(max) && !isNaN(intervalo) && intervalo > 0 && max > min;
  }, [taxaFipeMin, taxaFipeMax, taxaIntervalo]);

  // Calculate total
  const valorTotal = useMemo(() => {
    let total = 0;
    for (const c of coberturas) {
      if (selectedCoberturas.has(c.id)) total += (c as any).valor || 0;
    }
    for (const b of benefits) {
      if (selectedBeneficios.has(b.id)) total += b.preco_sugerido || 0;
    }
    return total;
  }, [selectedCoberturas, selectedBeneficios, coberturas, benefits]);

  // Toggle helpers
  const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const targetLineId = linhaId || existingPlan?.product_line_id;
      
      if (planoId) {
        const { error } = await supabase.from('planos').update({
          nome, descricao, ativo,
          template_contrato_id: (templateContratoId && templateContratoId !== 'default') ? templateContratoId : null,
        }).eq('id', planoId);
        if (error) throw error;

        // Rebuild coberturas links
        await supabase.from('planos_coberturas').delete().eq('plano_id', planoId);
        if (selectedCoberturas.size > 0) {
          await supabase.from('planos_coberturas').insert(
            Array.from(selectedCoberturas).map(cid => ({ plano_id: planoId, cobertura_id: cid }))
          );
        }

        // Rebuild beneficios links
        await supabase.from('planos_beneficios').delete().eq('plano_id', planoId);
        if (selectedBeneficios.size > 0) {
          const bens = benefits.filter(b => selectedBeneficios.has(b.id));
          await supabase.from('planos_beneficios').insert(
            bens.map((b, i) => ({ plano_id: planoId, benefit_id: b.id, beneficio: b.name, display_order: i }))
          );
        }
        // Save taxa administrativa
        await supabase.from('planos_taxa_administrativa').delete().eq('plano_id', planoId);
        if (taxaFaixas.length > 0) {
          await supabase.from('planos_taxa_administrativa').insert(
            taxaFaixas.map(f => ({ plano_id: planoId, fipe_de: f.fipe_de, fipe_ate: f.fipe_ate, valor_taxa: f.valor_taxa }))
          );
        }

      } else {
        const codigo = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
        const { data: plan, error } = await supabase.from('planos').insert({
          nome, descricao, ativo, codigo, slug: codigo,
          product_line_id: targetLineId,
          tipo_uso: 'passeio',
          valor_adesao: 0,
          template_contrato_id: (templateContratoId && templateContratoId !== 'default') ? templateContratoId : null,
        }).select().single();
        if (error) throw error;

        if (selectedCoberturas.size > 0) {
          await supabase.from('planos_coberturas').insert(
            Array.from(selectedCoberturas).map(cid => ({ plano_id: plan.id, cobertura_id: cid }))
          );
        }
        if (selectedBeneficios.size > 0) {
          const bens = benefits.filter(b => selectedBeneficios.has(b.id));
          await supabase.from('planos_beneficios').insert(
            bens.map((b, i) => ({ plano_id: plan.id, benefit_id: b.id, beneficio: b.name, display_order: i }))
          );
        }
        // Save taxa administrativa for new plan
        if (taxaFaixas.length > 0) {
          await supabase.from('planos_taxa_administrativa').insert(
            taxaFaixas.map(f => ({ plano_id: plan.id, fipe_de: f.fipe_de, fipe_ate: f.fipe_ate, valor_taxa: f.valor_taxa }))
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plano salvo');
      onClose();
    },
    onError: (e) => { console.error(e); toast.error('Erro ao salvar plano'); },
  });

  if (planoId && loadingPlan) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{planoId ? 'Editar' : 'Novo'} Plano</SheetTitle></SheetHeader>

        <div className="space-y-8 mt-6 pb-8">
          {/* ── BLOCO 1: Identificação ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificação</h3>
              <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-center">
                <p className="text-[10px] uppercase tracking-wider font-medium">Valor Mensal</p>
                <p className="text-xl font-bold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div><Label>Nome do Plano</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Select Plus" autoFocus /></div>
            <div><Label>Descrição curta (opcional)</Label><Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label className="text-sm">Ativo</Label>
            </div>
          </section>

          <div className="border-t" />

          {/* ── BLOCO 2: Coberturas e Benefícios ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coberturas e Benefícios Incluídos</h3>
            
            {coberturas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Coberturas</p>
                <div className="space-y-1">
                  {coberturas.map(c => (
                    <label key={c.id} className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                      selectedCoberturas.has(c.id) ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                    )}>
                      <Checkbox checked={selectedCoberturas.has(c.id)} onCheckedChange={() => toggleSet(selectedCoberturas, setSelectedCoberturas, c.id)} />
                      <span className="text-sm flex-1">{c.nome}</span>
                      <span className="text-xs font-medium text-muted-foreground">R$ {((c as any).valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {benefits.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Benefícios</p>
                <div className="space-y-1">
                  {benefits.map(b => (
                    <label key={b.id} className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                      selectedBeneficios.has(b.id) ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                    )}>
                      <Checkbox checked={selectedBeneficios.has(b.id)} onCheckedChange={() => toggleSet(selectedBeneficios, setSelectedBeneficios, b.id)} />
                      <span className="text-sm flex-1">{b.name}</span>
                      <span className="text-xs font-medium text-muted-foreground">R$ {(b.preco_sugerido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── BLOCO 3: Taxa Administrativa ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />Taxa Administrativa
            </h3>
            <p className="text-xs text-muted-foreground">Configure o valor da taxa administrativa por faixa de valor FIPE do veículo.</p>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">FIPE Mínimo (R$)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={taxaFipeMin}
                  onChange={e => setTaxaFipeMin(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">FIPE Máximo (R$)</Label>
                <Input
                  type="number"
                  placeholder="200000"
                  value={taxaFipeMax}
                  onChange={e => setTaxaFipeMax(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Intervalo (R$)</Label>
                <Input
                  type="number"
                  placeholder="20000"
                  value={taxaIntervalo}
                  onChange={e => setTaxaIntervalo(e.target.value)}
                />
              </div>
            </div>

            {taxaFaixas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{taxaFaixas.length} faixa(s) gerada(s)</p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {taxaFaixas.map((faixa, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 ring-1 ring-border/50">
                      <span className="text-xs text-muted-foreground flex-1 min-w-0">
                        R$ {faixa.fipe_de.toLocaleString('pt-BR')} – R$ {faixa.fipe_ate.toLocaleString('pt-BR')}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={faixa.valor_taxa || ''}
                          onChange={e => {
                            const updated = [...taxaFaixas];
                            updated[idx] = { ...faixa, valor_taxa: parseFloat(e.target.value) || 0 };
                            setTaxaFaixas(updated);
                          }}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="border-t" />

          {/* ── Template de Contrato ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />Template de Contrato
            </h3>
            <p className="text-xs text-muted-foreground">Selecione o template do Autentique que será usado ao gerar contratos deste plano.</p>
            <Select value={templateContratoId} onValueChange={setTemplateContratoId}>
              <SelectTrigger>
                <SelectValue placeholder="Usar template padrão do sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar template padrão do sistema</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} {t.codigo ? `(${t.codigo})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templateContratoId && templateContratoId !== 'default' && (
              <p className="text-xs text-primary">✓ Template específico vinculado</p>
            )}
          </section>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar Plano
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
