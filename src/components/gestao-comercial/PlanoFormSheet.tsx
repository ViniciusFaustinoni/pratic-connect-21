import { useState, useEffect, useMemo } from 'react';
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
import { Loader2 } from 'lucide-react';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { useRegioes } from '@/hooks/useRegioes';
import { useCategoriasVeiculoPlano, useConfiguracaoJson, useCombustiveis } from '@/hooks/useConteudosSistema';
import { useMarcasModelos } from '@/hooks/useMarcasModelos';
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
  const { data: coberturas = [] } = useCoberturas(true);
  const { data: benefits = [] } = useBenefits();
  const { data: regioes = [] } = useRegioes();
  const { data: categoriasVeiculo = [] } = useCategoriasVeiculoPlano();
  const { data: tiposUso = [] } = useConfiguracaoJson<any[]>('tipos_uso', []);
  const { data: tiposPlaca = [] } = useConfiguracaoJson<any[]>('tipos_placa', []);
  const { data: combustiveis = [] } = useCombustiveis();
  const { data: marcasModelos = [] } = useMarcasModelos();

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [selectedCoberturas, setSelectedCoberturas] = useState<Set<string>>(new Set());
  const [selectedBeneficios, setSelectedBeneficios] = useState<Set<string>>(new Set());
  
  // Eligibility
  const [selRegioes, setSelRegioes] = useState<Set<string>>(new Set());
  const [selTipoVeiculo, setSelTipoVeiculo] = useState<Set<string>>(new Set());
  const [selUso, setSelUso] = useState<Set<string>>(new Set());
  const [selMarcas, setSelMarcas] = useState<Set<string>>(new Set());
  const [selPlaca, setSelPlaca] = useState<Set<string>>(new Set());
  const [selCombustivel, setSelCombustivel] = useState<Set<string>>(new Set());

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

      // Load linked coberturas
      const { data: cobs } = await supabase.from('planos_coberturas').select('cobertura_id').eq('plano_id', planoId);
      // Load linked beneficios
      const { data: bens } = await supabase.from('planos_beneficios').select('benefit_id').eq('plano_id', planoId);
      // Load linked regioes
      const { data: regs } = await supabase.from('planos_regioes').select('regiao_id').eq('plano_id', planoId);
      // Load eligibility rules
      const { data: rules } = await supabase.from('entity_eligibility_rules').select('*').eq('entity_type', 'plano').eq('entity_id', planoId);

      return {
        ...data,
        coberturaIds: (cobs || []).map((c: any) => c.cobertura_id),
        beneficioIds: (bens || []).map((b: any) => b.benefit_id),
        regiaoIds: (regs || []).map((r: any) => r.regiao_id),
        rules: rules || [],
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
      setSelRegioes(new Set(existingPlan.regiaoIds));
      
      // Parse rules
      for (const rule of existingPlan.rules) {
        const config = (typeof rule.rule_config === 'object' && rule.rule_config) ? rule.rule_config as any : {};
        const vals = new Set((config.values || []) as string[]);
        switch (rule.rule_type) {
          case 'categoria_veiculo': setSelTipoVeiculo(vals); break;
          case 'tipo_uso': setSelUso(vals); break;
          case 'marca_modelo': setSelMarcas(vals); break;
          case 'combustivel': setSelCombustivel(vals); break;
        }
      }
    }
  }, [existingPlan]);

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
        // Update
        const { error } = await supabase.from('planos').update({
          nome, descricao, ativo,
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

        // Rebuild regioes
        await supabase.from('planos_regioes').delete().eq('plano_id', planoId);
        if (selRegioes.size > 0) {
          await supabase.from('planos_regioes').insert(
            Array.from(selRegioes).map(rid => ({ plano_id: planoId, regiao_id: rid }))
          );
        }

        // Rebuild eligibility rules
        await supabase.from('entity_eligibility_rules').delete().eq('entity_type', 'plano').eq('entity_id', planoId);
        await insertRules(planoId);

      } else {
        // Create
        const codigo = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
        const { data: plan, error } = await supabase.from('planos').insert({
          nome, descricao, ativo, codigo, slug: codigo,
          product_line_id: targetLineId,
          tipo_uso: 'passeio',
          valor_adesao: 0,
        }).select().single();
        if (error) throw error;

        // Insert coberturas
        if (selectedCoberturas.size > 0) {
          await supabase.from('planos_coberturas').insert(
            Array.from(selectedCoberturas).map(cid => ({ plano_id: plan.id, cobertura_id: cid }))
          );
        }
        // Insert beneficios
        if (selectedBeneficios.size > 0) {
          const bens = benefits.filter(b => selectedBeneficios.has(b.id));
          await supabase.from('planos_beneficios').insert(
            bens.map((b, i) => ({ plano_id: plan.id, benefit_id: b.id, beneficio: b.name, display_order: i }))
          );
        }
        // Insert regioes
        if (selRegioes.size > 0) {
          await supabase.from('planos_regioes').insert(
            Array.from(selRegioes).map(rid => ({ plano_id: plan.id, regiao_id: rid }))
          );
        }
        // Insert rules
        await insertRules(plan.id);
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

  async function insertRules(entityId: string) {
    const rules: any[] = [];
    const addRule = (type: string, values: string[], mode = 'include') => {
      if (values.length > 0) rules.push({ entity_type: 'plano', entity_id: entityId, rule_type: type, rule_mode: mode, rule_config: { values } });
    };
    addRule('categoria_veiculo', Array.from(selTipoVeiculo));
    addRule('tipo_uso', Array.from(selUso));
    addRule('marca_modelo', Array.from(selMarcas));
    addRule('combustivel', Array.from(selCombustivel));
    if (rules.length > 0) {
      await supabase.from('entity_eligibility_rules').insert(rules);
    }
  }

  // Unique brands from marcasModelos
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    for (const mm of marcasModelos) if (mm.ativo) brands.add(mm.marca);
    return Array.from(brands).sort();
  }, [marcasModelos]);

  // Eligibility summary
  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    if (selRegioes.size > 0) {
      const names = regioes.filter(r => selRegioes.has(r.id)).map(r => r.nome);
      parts.push(`Região: ${names.join(', ')}`);
    }
    if (selTipoVeiculo.size > 0) {
      const names = categoriasVeiculo.filter(c => selTipoVeiculo.has(c.value)).map(c => c.label);
      parts.push(`Veículo: ${names.join(', ')}`);
    }
    if (selUso.size > 0) {
      const names = tiposUso.filter((t: any) => selUso.has(t.value)).map((t: any) => t.label);
      parts.push(`Uso: ${names.join(', ')}`);
    }
    if (selMarcas.size > 0) parts.push(`Marcas: ${Array.from(selMarcas).join(', ')}`);
    if (selPlaca.size > 0) {
      const names = tiposPlaca.filter((t: any) => selPlaca.has(t.value)).map((t: any) => t.label);
      parts.push(`Placa: ${names.join(', ')}`);
    }
    if (selCombustivel.size > 0) {
      const names = combustiveis.filter(c => selCombustivel.has(c.value)).map(c => c.label);
      parts.push(`Combustível: ${names.join(', ')}`);
    }
    return parts;
  }, [selRegioes, selTipoVeiculo, selUso, selMarcas, selPlaca, selCombustivel, regioes, categoriasVeiculo, tiposUso, tiposPlaca, combustiveis]);

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

          <div className="border-t" />

          {/* ── BLOCO 3: Elegibilidade ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Regras de Elegibilidade</h3>
            <p className="text-xs text-muted-foreground">Campos opcionais — se não preenchido, o plano aparece para todos.</p>

            {/* Regiões */}
            {regioes.length > 0 && (
              <div>
                <Label className="text-xs">Regiões</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {regioes.filter(r => r.ativa).map(r => (
                    <Badge
                      key={r.id}
                      variant={selRegioes.has(r.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selRegioes, setSelRegioes, r.id)}
                    >{r.nome}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tipo Veículo */}
            {categoriasVeiculo.length > 0 && (
              <div>
                <Label className="text-xs">Tipo de Veículo</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {categoriasVeiculo.map(c => (
                    <Badge
                      key={c.value}
                      variant={selTipoVeiculo.has(c.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selTipoVeiculo, setSelTipoVeiculo, c.value)}
                    >{c.label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Modalidade de Uso */}
            {tiposUso.length > 0 && (
              <div>
                <Label className="text-xs">Modalidade de Uso</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tiposUso.map((t: any) => (
                    <Badge
                      key={t.value}
                      variant={selUso.has(t.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selUso, setSelUso, t.value)}
                    >{t.label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Marcas */}
            {uniqueBrands.length > 0 && (
              <div>
                <Label className="text-xs">Marcas</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-32 overflow-y-auto">
                  {uniqueBrands.map(brand => (
                    <Badge
                      key={brand}
                      variant={selMarcas.has(brand) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selMarcas, setSelMarcas, brand)}
                    >{brand}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tipo Placa */}
            {tiposPlaca.length > 0 && (
              <div>
                <Label className="text-xs">Tipo de Placa</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tiposPlaca.map((t: any) => (
                    <Badge
                      key={t.value}
                      variant={selPlaca.has(t.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selPlaca, setSelPlaca, t.value)}
                    >{t.label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Combustível */}
            {combustiveis.length > 0 && (
              <div>
                <Label className="text-xs">Combustível</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {combustiveis.map(c => (
                    <Badge
                      key={c.value}
                      variant={selCombustivel.has(c.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSet(selCombustivel, setSelCombustivel, c.value)}
                    >{c.label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {summaryParts.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 mt-3">
                <p className="text-xs text-muted-foreground mb-1">Este plano será exibido para:</p>
                <p className="text-xs font-medium">{summaryParts.join(' · ')}</p>
              </div>
            )}
          </section>

          <div className="border-t" />

          {/* ── Template de Contrato (placeholder) ── */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Template de Contrato</h3>
            <p className="text-xs text-muted-foreground">Integração com Autentique — em breve</p>
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
