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
import { Loader2, FileText } from 'lucide-react';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { useAllEligibilityRules } from '@/hooks/useEntityEligibilityRules';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  planoId?: string;
  linhaId?: string;
}

export function PlanoFormSheet({ open, onClose, planoId, linhaId }: Props) {
  const qc = useQueryClient();
  
  // Data sources
  const { data: allCoberturas = [] } = useCoberturas(true);
  const { data: allBenefits = [] } = useBenefits();
  const { data: allRules = [] } = useAllEligibilityRules();

  // IDs already assigned to OTHER plans (exclude current plan being edited)
  const { data: assignedCoberturaIds = new Set<string>() } = useQuery({
    queryKey: ['assigned-cobertura-ids', planoId],
    queryFn: async () => {
      let query = supabase.from('planos_coberturas').select('cobertura_id');
      if (planoId) query = query.neq('plano_id', planoId);
      const { data } = await query;
      return new Set((data || []).map((r: any) => r.cobertura_id));
    },
  });
  const { data: assignedBenefitIds = new Set<string>() } = useQuery({
    queryKey: ['assigned-benefit-ids', planoId],
    queryFn: async () => {
      let query = supabase.from('planos_beneficios').select('benefit_id');
      if (planoId) query = query.neq('plano_id', planoId);
      const { data } = await query;
      return new Set((data || []).map((r: any) => r.benefit_id));
    },
  });

  // Set of entity_ids that have fipe_range rules (variable pricing)
  const fipeRangeEntityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rule of allRules) {
      if (rule.rule_type === 'fipe_range') {
        ids.add(rule.entity_id);
      }
    }
    return ids;
  }, [allRules]);

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [selectedCoberturas, setSelectedCoberturas] = useState<Set<string>>(new Set());
  const [selectedBeneficios, setSelectedBeneficios] = useState<Set<string>>(new Set());
  const [templateContratoId, setTemplateContratoId] = useState<string>('');

  // Filter to only show unassigned items (+ those already selected by this plan)
  const coberturas = useMemo(() => allCoberturas.filter(c => !assignedCoberturaIds.has(c.id) || selectedCoberturas.has(c.id)), [allCoberturas, assignedCoberturaIds, selectedCoberturas]);
  const benefits = useMemo(() => allBenefits.filter(b => !assignedBenefitIds.has(b.id) || selectedBeneficios.has(b.id)), [allBenefits, assignedBenefitIds, selectedBeneficios]);


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

      return {
        ...data,
        coberturaIds: (cobs || []).map((c: any) => c.cobertura_id),
        beneficioIds: (bens || []).map((b: any) => b.benefit_id),
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
    }
  }, [existingPlan]);



  // Calculate total
  const { valorTotal, temVariaveis } = useMemo(() => {
    let total = 0;
    let hasVar = false;
    for (const c of coberturas) {
      if (selectedCoberturas.has(c.id)) {
        if (fipeRangeEntityIds.has(c.id)) { hasVar = true; } 
        else { total += (c as any).valor || 0; }
      }
    }
    for (const b of benefits) {
      if (selectedBeneficios.has(b.id)) {
        if (fipeRangeEntityIds.has(b.id)) { hasVar = true; }
        else { total += b.preco_sugerido || 0; }
      }
    }
    return { valorTotal: total, temVariaveis: hasVar };
  }, [selectedCoberturas, selectedBeneficios, coberturas, benefits, fipeRangeEntityIds]);

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
      } else {
        if (!nome.trim()) throw new Error('Nome do plano é obrigatório');
        
        // Generate unique codigo/slug
        let baseCodigo = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 30);
        let codigo = baseCodigo;
        let suffix = 2;
        
        // Check for existing codigo and increment suffix until unique
        while (true) {
          const { data: existing } = await supabase
            .from('planos')
            .select('id')
            .eq('codigo', codigo)
            .maybeSingle();
          if (!existing) break;
          codigo = `${baseCodigo.slice(0, 27)}-${suffix}`;
          suffix++;
          if (suffix > 100) throw new Error('Não foi possível gerar um código único para o plano');
        }
        
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
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['plano_edit'] });
      toast.success('Plano salvo');
      onClose();
    },
    onError: (e: any) => { console.error(e); toast.error(e?.message || 'Erro ao salvar plano'); },
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
                {temVariaveis && <p className="text-[10px] text-muted-foreground">(+ itens variáveis por FIPE)</p>}
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
                      {fipeRangeEntityIds.has(c.id) 
                        ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Variável por FIPE</Badge>
                        : <span className="text-xs font-medium text-muted-foreground">R$ {((c as any).valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      }
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
                      {fipeRangeEntityIds.has(b.id)
                        ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Variável por FIPE</Badge>
                        : <span className="text-xs font-medium text-muted-foreground">R$ {(b.preco_sugerido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      }
                    </label>
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
