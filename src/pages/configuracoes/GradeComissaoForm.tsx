import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Infinity as InfinityIcon, AlertCircle, Package, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { FieldHint } from '@/components/admin/planos/FieldHint';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppRoles } from '@/hooks/useAppRoles';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ParcelaEditor, ParcelaForm } from '@/components/comissoes/ParcelaEditor';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { registrarLog } from '@/hooks/useAuditLog';

const COMMERCIAL_ROLE_KEYS = ['vendedor_clt', 'vendedor_externo', 'agencia', 'supervisor_vendas', 'gerente_comercial'];

type RegrasPorPlano = Record<string, ParcelaForm[]>;

interface PlanoComissaoOption {
  id: string;
  nome: string;
  linha: string | null;
}

interface GradeComissaoFormProps {
  basePath?: string;
}

const cloneParcelas = (parcelas: ParcelaForm[]): ParcelaForm[] =>
  parcelas.map((p, idx) => ({
    ...p,
    id: undefined,
    ordem: idx,
    niveis: p.niveis.map((n) => ({ ...n, id: undefined })),
  }));

const defaultParcela = (ordem: number, numero: number): ParcelaForm => ({
  numero_parcela: numero,
  vitalicia: false,
  vitalicia_inicio_parcela: null,
  label: numero === 1 ? 'Taxa de Adesão' : `${numero}ª Parcela`,
  ordem,
  niveis: [],
  supervisor_split_mode: 'igual',
});

const buildGradeSnapshot = (
  grade: { id?: string; nome: string; descricao: string | null; versao: number },
  planos: PlanoComissaoOption[],
  selectedPlanIds: string[],
  regrasPorPlano: RegrasPorPlano,
) => ({
  grade,
  planos: selectedPlanIds.map((planoId) => {
    const plano = planos.find((p) => p.id === planoId);
    return { id: planoId, nome: plano?.nome || planoId, linha: plano?.linha || null };
  }),
  regras_por_plano: Object.fromEntries(
    selectedPlanIds.map((planoId) => {
      const plano = planos.find((p) => p.id === planoId);
      return [planoId, {
        plano: { id: planoId, nome: plano?.nome || planoId, linha: plano?.linha || null },
        parcelas: (regrasPorPlano[planoId] || []).map((parcela, parcelaIndex) => ({
          ordem: parcelaIndex,
          numero_parcela: parcela.numero_parcela,
          vitalicia: parcela.vitalicia,
          vitalicia_inicio_parcela: parcela.vitalicia_inicio_parcela,
          label: parcela.label,
          niveis: parcela.niveis.map((nivel, nivelIndex) => ({
            ordem: nivelIndex,
            role: nivel.role,
            nome: nivel.nome,
            tipo_comissao: nivel.tipo_comissao || 'percentual',
            valor: Number(nivel.valor ?? nivel.percentual) || 0,
          })),
        })),
      }];
    }),
  ),
});

export default function GradeComissaoForm({ basePath = '/configuracoes/grades-comissao' }: GradeComissaoFormProps) {
  const { id } = useParams();
  const isEdit = !!id && id !== 'nova';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { roles: appRoles } = useAppRoles();

  const commercialRoles = appRoles.filter(r => COMMERCIAL_ROLE_KEYS.includes(r.role));

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [regrasPorPlano, setRegrasPorPlano] = useState<RegrasPorPlano>({});
  const [saving, setSaving] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ['grade-comissao-planos-options'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('planos')
        .select('id, nome, linha')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as PlanoComissaoOption[];
    },
  });

  const planosSelecionados = useMemo(
    () => selectedPlanIds.map((planId) => planos.find((p) => p.id === planId)).filter(Boolean) as PlanoComissaoOption[],
    [planos, selectedPlanIds],
  );
  const todosPlanosSelecionados = planos.length > 0 && selectedPlanIds.length === planos.length;
  const configuracaoCompartilhada = selectedPlanIds.length > 1;
  const planoConfiguracaoId = selectedPlanIds[0] || '';

  const getRegrasParaSalvar = (): RegrasPorPlano => {
    if (!configuracaoCompartilhada) return regrasPorPlano;

    const modelo = cloneParcelas(regrasPorPlano[planoConfiguracaoId] || []);
    return Object.fromEntries(selectedPlanIds.map((planoId) => [planoId, cloneParcelas(modelo)]));
  };

  const { data: existing, isLoading } = useQuery({
    queryKey: ['grade-comissao-v2', id],
    enabled: isEdit,
    queryFn: async () => {
      const { data: grade, error } = await (supabase as any)
        .from('grades_comissao')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;

      const { data: gps, error: gpErr } = await (supabase as any)
        .from('grade_comissao_planos')
        .select('plano_id')
        .eq('grade_id', id!)
        .eq('ativo', true);
      if (gpErr) throw gpErr;

      const { data: regras, error: rErr } = await (supabase as any)
        .from('grade_comissao_plano_regras')
        .select('*')
        .eq('grade_id', id!)
        .eq('ativo', true)
        .order('ordem');
      if (rErr) throw rErr;

      const { data: parcelasMeta, error: pmErr } = await (supabase as any)
        .from('grades_comissao_parcelas')
        .select('id, numero_parcela, vitalicia, vitalicia_inicio_parcela, supervisor_split_mode')
        .eq('grade_id', id!);
      if (pmErr) throw pmErr;

      return { grade, gradePlanos: gps || [], regras: regras || [], parcelasMeta: parcelasMeta || [] };
    },
  });

  useEffect(() => {
    if (!existing) return;

    setNome(existing.grade.nome);
    setDescricao(existing.grade.descricao || '');

    const planIds = (existing.gradePlanos || []).map((p: any) => p.plano_id);
    setSelectedPlanIds(planIds);

    const regras = existing.regras || [];
    if (regras.length > 0) {
      const next: RegrasPorPlano = {};
      planIds.forEach((planoId: string) => {
        const regrasPlano = regras.filter((r: any) => r.plano_id === planoId);
        const grupos = new Map<string, any[]>();
        regrasPlano.forEach((r: any) => {
          const key = r.vitalicia ? `vitalicia-${r.vitalicia_inicio_parcela || r.parcela_numero || 2}` : `parcela-${r.parcela_numero}`;
          grupos.set(key, [...(grupos.get(key) || []), r]);
        });

        next[planoId] = Array.from(grupos.values())
          .map((grupo, ordem) => {
            const base = grupo[0];
            return {
              id: base.parcela_id || undefined,
              numero_parcela: base.vitalicia ? null : base.parcela_numero,
              vitalicia: !!base.vitalicia,
              vitalicia_inicio_parcela: base.vitalicia ? base.vitalicia_inicio_parcela : null,
              label: base.vitalicia ? 'Vitalícia' : base.parcela_numero === 1 ? 'Taxa de Adesão' : `${base.parcela_numero}ª Parcela`,
              ordem,
              niveis: grupo
                .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
                .map((r: any) => ({
                  id: r.id,
                  nome: r.nome_nivel || r.role,
                  role: r.role,
                  tipo_comissao: r.tipo_comissao || 'percentual',
                  valor: Number(r.valor) || 0,
                  percentual: r.tipo_comissao === 'valor_fixo' ? 0 : Number(r.valor) || 0,
                })),
            } as ParcelaForm;
          })
          .sort((a, b) => (a.vitalicia ? 999 : a.numero_parcela || 0) - (b.vitalicia ? 999 : b.numero_parcela || 0));
      });
      setRegrasPorPlano(next);
      return;
    }

    setRegrasPorPlano(Object.fromEntries(planIds.map((planId: string) => [planId, []])));
  }, [existing]);

  const togglePlano = (planoId: string) => {
    setSelectedPlanIds(prev => {
      if (prev.includes(planoId)) {
        setRegrasPorPlano(current => {
          const { [planoId]: _, ...rest } = current;
          return rest;
        });
        return prev.filter(id => id !== planoId);
      }

      setRegrasPorPlano(current => {
        const primeiraGrade = Object.values(current).find((parcelas) => parcelas.length > 0);
        return {
          ...current,
          [planoId]: primeiraGrade ? cloneParcelas(primeiraGrade) : [defaultParcela(0, 1)],
        };
      });
      return [...prev, planoId];
    });
  };

  const toggleTodosPlanos = () => {
    if (todosPlanosSelecionados) {
      setSelectedPlanIds([]);
      setRegrasPorPlano({});
      return;
    }

    setSelectedPlanIds(planos.map((plano) => plano.id));
    setRegrasPorPlano(current => {
      const primeiraGrade = Object.values(current).find((parcelas) => parcelas.length > 0);
      const modelo = primeiraGrade ? cloneParcelas(primeiraGrade) : [defaultParcela(0, 1)];
      return Object.fromEntries(planos.map((plano) => [plano.id, current[plano.id] || cloneParcelas(modelo)]));
    });
  };

  const updatePlanoParcelas = (planoId: string, updater: (parcelas: ParcelaForm[]) => ParcelaForm[]) => {
    setRegrasPorPlano(prev => {
      const basePlanoId = configuracaoCompartilhada ? planoConfiguracaoId : planoId;
      const nextParcelas = updater(prev[basePlanoId] || []);

      if (!configuracaoCompartilhada) {
        return { ...prev, [planoId]: nextParcelas };
      }

      return {
        ...prev,
        ...Object.fromEntries(selectedPlanIds.map((id) => [id, cloneParcelas(nextParcelas)])),
      };
    });
  };

  const addParcela = (planoId: string) => {
    updatePlanoParcelas(planoId, (parcelas) => {
      const usados = parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela || 0);
      const proximo = (Math.max(0, ...usados)) + 1;
      return [...parcelas, defaultParcela(parcelas.length, proximo)];
    });
  };

  const addVitalicia = (planoId: string) => {
    const parcelas = regrasPorPlano[planoId] || [];
    if (parcelas.some(p => p.vitalicia)) {
      toast.error('Já existe uma regra vitalícia para este plano.');
      return;
    }
    const ultimaConfig = Math.max(0, ...parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela || 0));
    updatePlanoParcelas(planoId, (prev) => [...prev, {
      numero_parcela: null,
      vitalicia: true,
      vitalicia_inicio_parcela: ultimaConfig + 1,
      label: 'Vitalícia',
      ordem: prev.length,
      niveis: [],
    }]);
  };

  const updateParcela = (planoId: string, idx: number, next: ParcelaForm) => {
    updatePlanoParcelas(planoId, (prev) => prev.map((p, i) => i === idx ? next : p));
  };

  const removeParcela = (planoId: string, idx: number) => {
    updatePlanoParcelas(planoId, (prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i })));
  };

  const moveParcela = (planoId: string, idx: number, dir: -1 | 1) => {
    updatePlanoParcelas(planoId, (prev) => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy.map((p, i) => ({ ...p, ordem: i }));
    });
  };

  const validate = (): string | null => {
    if (!nome.trim()) return 'Nome é obrigatório';
    if (selectedPlanIds.length === 0) return 'Selecione pelo menos um plano para a grade';

    const regrasValidacao = getRegrasParaSalvar();
    const planosParaValidar = configuracaoCompartilhada ? [planoConfiguracaoId] : selectedPlanIds;

    for (const planoId of planosParaValidar) {
      const plano = planos.find(p => p.id === planoId);
      const parcelas = regrasValidacao[planoId] || [];
      if (parcelas.length === 0) return configuracaoCompartilhada ? 'Configure pelo menos uma parcela para os planos selecionados' : `Configure pelo menos uma parcela para o plano ${plano?.nome || planoId}`;

      for (const p of parcelas) {
        const contexto = `${configuracaoCompartilhada ? 'Configuração compartilhada' : plano?.nome || 'Plano'} / ${p.label || 'Parcela'}`;
        if (!p.label.trim()) return `${contexto}: informe o rótulo da parcela`;
        if (p.vitalicia) {
          if (!p.vitalicia_inicio_parcela || p.vitalicia_inicio_parcela < 1) return `${contexto}: defina a parcela inicial da regra vitalícia`;
        } else {
          if (!p.numero_parcela || p.numero_parcela < 1) return `${contexto}: parcela precisa de número válido`;
        }
        const total = p.niveis.reduce((s, n) => s + (n.tipo_comissao === 'valor_fixo' ? 0 : Number(n.valor ?? n.percentual) || 0), 0);
        if (p.niveis.length === 0) return `${contexto}: configure pelo menos um perfil remunerado`;
        if (total > 100) return `${contexto}: soma dos percentuais ultrapassa 100%`;
        for (const n of p.niveis) {
          if (!n.role) return `${contexto}: selecione o perfil de cada regra`;
          if (!n.nome.trim()) return `${contexto}: cada regra precisa de nome`;
          if ((Number(n.valor ?? n.percentual) || 0) < 0) return `${contexto}: valor de comissão inválido`;
        }
        const roles = p.niveis.map(n => n.role).filter(Boolean);
        if (roles.length !== new Set(roles).size) return `${contexto}: há perfis duplicados na mesma parcela`;
      }

      const nums = parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela);
      if (nums.length !== new Set(nums).size) return `${configuracaoCompartilhada ? 'Configuração compartilhada' : plano?.nome || 'Plano'}: há parcelas com o mesmo número`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      let gradeId = id;
      let novaVersao = 1;
      const snapshotAnterior = isEdit && existing
        ? {
          grade: {
            id: existing.grade.id,
            nome: existing.grade.nome,
            descricao: existing.grade.descricao || null,
            versao: existing.grade.versao || 1,
          },
          planos: (existing.gradePlanos || []).map((gp: any) => {
            const plano = planos.find((p) => p.id === gp.plano_id);
            return { id: gp.plano_id, nome: plano?.nome || gp.plano_id, linha: plano?.linha || null };
          }),
          regras_por_plano: existing.regras || [],
        }
        : null;

      if (isEdit) {
        const { data: cur } = await (supabase as any)
          .from('grades_comissao')
          .select('versao')
          .eq('id', id!)
          .single();
        novaVersao = (cur?.versao || 1) + 1;

        const { error } = await (supabase as any)
          .from('grades_comissao')
          .update({
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            versao: novaVersao,
            vigente_desde: new Date().toISOString(),
          })
          .eq('id', id!);
        if (error) throw error;

        await (supabase as any).from('grades_comissao_parcelas').delete().eq('grade_id', id!);
        await (supabase as any).from('grades_comissao_niveis').delete().eq('grade_id', id!);
        await (supabase as any).from('grade_comissao_planos').delete().eq('grade_id', id!);
        await (supabase as any).from('grade_comissao_plano_regras').delete().eq('grade_id', id!);
      } else {
        const { data, error } = await (supabase as any)
          .from('grades_comissao')
          .insert({ nome: nome.trim(), descricao: descricao.trim() || null, versao: 1, vigente_desde: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        gradeId = data.id;
      }

      const regrasParaSalvar = getRegrasParaSalvar();
      const parcelaIdByKey = new Map<string, string>();
      const parcelasInsert = selectedPlanIds.flatMap((planoId) =>
        (regrasParaSalvar[planoId] || []).map((p, i) => ({
          grade_id: gradeId!,
          numero_parcela: p.vitalicia ? null : p.numero_parcela,
          vitalicia: p.vitalicia,
          vitalicia_inicio_parcela: p.vitalicia ? p.vitalicia_inicio_parcela : null,
          label: p.label.trim(),
          ordem: selectedPlanIds.indexOf(planoId) * 1000 + i,
          __key: `${planoId}:${i}`,
        }))
      );

      const { data: pcsCriadas, error: pErr } = await (supabase as any)
        .from('grades_comissao_parcelas')
        .insert(parcelasInsert.map(({ __key, ...row }) => row))
        .select('id, ordem');
      if (pErr) throw pErr;

      (pcsCriadas || []).forEach((p: any) => {
        const original = parcelasInsert.find((row) => row.ordem === p.ordem);
        if (original) parcelaIdByKey.set(original.__key, p.id);
      });

      const niveisInsert: any[] = [];
      selectedPlanIds.forEach((planoId) => {
        (regrasParaSalvar[planoId] || []).forEach((p, i) => {
          const parcelaId = parcelaIdByKey.get(`${planoId}:${i}`);
          p.niveis.forEach((n, ni) => {
            niveisInsert.push({
              grade_id: gradeId!,
              parcela_id: parcelaId,
              nome: n.nome.trim(),
              percentual: n.tipo_comissao === 'valor_fixo' ? 0 : Number(n.valor ?? n.percentual) || 0,
              ordem: ni,
              role: n.role,
            });
          });
        });
      });
      if (niveisInsert.length > 0) {
        const { error: nErr } = await (supabase as any).from('grades_comissao_niveis').insert(niveisInsert);
        if (nErr) throw nErr;
      }

      const gradePlanosInsert = selectedPlanIds.map(planoId => ({ grade_id: gradeId!, plano_id: planoId, ativo: true }));
      const { error: gpErr } = await (supabase as any).from('grade_comissao_planos').insert(gradePlanosInsert);
      if (gpErr) throw gpErr;

      const regrasInsert: any[] = [];
      selectedPlanIds.forEach(planoId => {
        (regrasParaSalvar[planoId] || []).forEach((p, i) => {
          const parcelaId = parcelaIdByKey.get(`${planoId}:${i}`);
          p.niveis.forEach((n, ni) => {
            regrasInsert.push({
              grade_id: gradeId!,
              plano_id: planoId,
              parcela_id: parcelaId || null,
              parcela_numero: p.vitalicia ? null : p.numero_parcela,
              vitalicia: p.vitalicia,
              vitalicia_inicio_parcela: p.vitalicia ? p.vitalicia_inicio_parcela : null,
              role: n.role,
              nome_nivel: n.nome.trim(),
              tipo_comissao: n.tipo_comissao || 'percentual',
              valor: Number(n.valor ?? n.percentual) || 0,
              ordem: ni,
              ativo: true,
            });
          });
        });
      });
      if (regrasInsert.length > 0) {
        const { error: rErr } = await (supabase as any).from('grade_comissao_plano_regras').insert(regrasInsert);
        if (rErr) throw rErr;
      }

      const snapshot = buildGradeSnapshot(
        { id: gradeId, nome: nome.trim(), descricao: descricao.trim() || null, versao: novaVersao },
        planos,
        selectedPlanIds,
        regrasParaSalvar,
      );
      await (supabase as any).from('grades_comissao_versoes').insert({
        grade_id: gradeId,
        versao: novaVersao,
        snapshot,
        vigente_desde: new Date().toISOString(),
        criado_por: profile?.id || null,
      });

      await registrarLog({
        acao: isEdit ? 'editar' : 'criar',
        modulo: 'comissoes',
        tabela: 'grades_comissao',
        entidade_id: gradeId!,
        descricao: isEdit ? 'Grade de comissão atualizada para nova versão' : 'Grade de comissão criada',
        dados_anteriores: snapshotAnterior || undefined,
        dados_novos: snapshot,
      });

      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      queryClient.invalidateQueries({ queryKey: ['grade-comissao-v2', id] });
      toast.success(isEdit ? 'Grade atualizada (nova versão)' : 'Grade criada');
      navigate(basePath);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar grade: ' + (e.message || 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(basePath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Editar configuração comercial da grade' : 'Nova configuração comercial de comissão'}
          </h2>
          <p className="text-sm text-muted-foreground">Defina quanto cada plano paga para cada perfil. A atribuição a usuários fica na área de Atribuição de Grades.</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Esta tela configura somente quanto cada <b>plano, parcela e perfil de acesso</b> paga. Ela não atribui grade a usuário; isso é feito em Atribuição de Grades.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center">
              Nome da Grade *
              <FieldHint text="Identifique a regra comercial. Ex: 'Grade Select RJ'." />
            </label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grade Select RJ" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional da regra comercial" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Planos configurados na grade</h3>
              <p className="text-sm text-muted-foreground">Selecione os planos. Com mais de um plano, a mesma configuração de parcelas e comissões será aplicada a todos.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleTodosPlanos} disabled={planos.length === 0}>
              {todosPlanosSelecionados ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
              {todosPlanosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {planos.map(plano => (
              <label key={plano.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm cursor-pointer hover:bg-muted/40">
                <Checkbox checked={selectedPlanIds.includes(plano.id)} onCheckedChange={() => togglePlano(plano.id)} />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground truncate">{plano.nome}</span>
                  {plano.linha && <span className="block text-xs text-muted-foreground truncate">{plano.linha}</span>}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {planosSelecionados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Selecione um plano para configurar quanto cada perfil recebe.
          </CardContent>
        </Card>
      ) : configuracaoCompartilhada ? ((() => {
        const parcelas = regrasPorPlano[planoConfiguracaoId] || [];
        const hasVitalicia = parcelas.some(p => p.vitalicia);
        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" /> Configuração compartilhada
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Estas regras serão refletidas em todos os planos selecionados ao salvar.</p>
                  <div className="flex flex-wrap gap-2">
                    {planosSelecionados.map((plano) => (
                      <Badge key={plano.id} variant="secondary">{plano.nome}</Badge>
                    ))}
                  </div>
                </div>
                <Badge variant="outline">Aplicada a {planosSelecionados.length} planos</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-end gap-2">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => addParcela(planoConfiguracaoId)}>
                        <Plus className="h-4 w-4 mr-1" /> Parcela
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Adicionar parcela para todos os planos selecionados.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => addVitalicia(planoConfiguracaoId)} disabled={hasVitalicia}>
                        <InfinityIcon className="h-4 w-4 mr-1" /> Vitalícia
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regra recorrente compartilhada entre todos os planos selecionados.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {parcelas.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhuma parcela configurada para os planos selecionados.
                </div>
              ) : (
                parcelas.map((p, i) => (
                  <ParcelaEditor
                    key={p.id || `compartilhada-${i}`}
                    parcela={p}
                    index={i}
                    onChange={next => updateParcela(planoConfiguracaoId, i, next)}
                    onRemove={() => removeParcela(planoConfiguracaoId, i)}
                    onMove={dir => moveParcela(planoConfiguracaoId, i, dir)}
                    canMoveUp={i > 0}
                    canMoveDown={i < parcelas.length - 1}
                    commercialRoles={commercialRoles.map(r => ({ role: r.role, label: r.label }))}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })()) : (
        planosSelecionados.map((plano) => {
          const parcelas = regrasPorPlano[plano.id] || [];
          const hasVitalicia = parcelas.some(p => p.vitalicia);
          return (
            <Card key={plano.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" /> {plano.nome}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Regras de pagamento por parcela e perfil para este plano.</p>
                  </div>
                  <Badge variant="outline">{parcelas.length} regra{parcelas.length === 1 ? '' : 's'} de parcela</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-end gap-2">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => addParcela(plano.id)}>
                          <Plus className="h-4 w-4 mr-1" /> Parcela
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Adicionar parcela específica para este plano.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => addVitalicia(plano.id)} disabled={hasVitalicia}>
                          <InfinityIcon className="h-4 w-4 mr-1" /> Vitalícia
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Regra recorrente a partir de uma parcela para este plano.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {parcelas.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Nenhuma parcela configurada para este plano.
                  </div>
                ) : (
                  parcelas.map((p, i) => (
                    <ParcelaEditor
                      key={p.id || `${plano.id}-${i}`}
                      parcela={p}
                      index={i}
                      onChange={next => updateParcela(plano.id, i, next)}
                      onRemove={() => removeParcela(plano.id, i)}
                      onMove={dir => moveParcela(plano.id, i, dir)}
                      canMoveUp={i > 0}
                      canMoveDown={i < parcelas.length - 1}
                      commercialRoles={commercialRoles.map(r => ({ role: r.role, label: r.label }))}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(basePath)}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : isEdit ? 'Salvar nova versão' : 'Criar Grade'}
        </Button>
      </div>
    </div>
  );
}
