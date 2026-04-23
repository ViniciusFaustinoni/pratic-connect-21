import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Plus, Infinity as InfinityIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FieldHint } from '@/components/admin/planos/FieldHint';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppRoles } from '@/hooks/useAppRoles';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ParcelaEditor, ParcelaForm, NivelForm } from '@/components/comissoes/ParcelaEditor';
import { useAuth } from '@/contexts/AuthContext';

const COMMERCIAL_ROLE_KEYS = ['vendedor_clt', 'vendedor_externo', 'agencia', 'supervisor_vendas', 'gerente_comercial'];

export default function GradeComissaoForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'nova';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { roles: appRoles } = useAppRoles();

  const commercialRoles = appRoles.filter(r => COMMERCIAL_ROLE_KEYS.includes(r.role));

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);
  const [saving, setSaving] = useState(false);

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

      const { data: pcs, error: pErr } = await (supabase as any)
        .from('grades_comissao_parcelas')
        .select('*')
        .eq('grade_id', id!)
        .order('ordem');
      if (pErr) throw pErr;

      const { data: nvs, error: nErr } = await (supabase as any)
        .from('grades_comissao_niveis')
        .select('*')
        .eq('grade_id', id!)
        .order('ordem');
      if (nErr) throw nErr;

      return { grade, parcelas: pcs || [], niveis: nvs || [] };
    },
  });

  useEffect(() => {
    if (existing) {
      setNome(existing.grade.nome);
      setDescricao(existing.grade.descricao || '');
      const parcs: ParcelaForm[] = (existing.parcelas || []).map((p: any) => ({
        id: p.id,
        numero_parcela: p.numero_parcela,
        vitalicia: p.vitalicia,
        vitalicia_inicio_parcela: p.vitalicia_inicio_parcela,
        label: p.label,
        ordem: p.ordem,
        niveis: (existing.niveis || [])
          .filter((n: any) => n.parcela_id === p.id)
          .sort((a: any, b: any) => a.ordem - b.ordem)
          .map((n: any) => ({
            id: n.id, nome: n.nome, percentual: Number(n.percentual), role: n.role || '',
          })),
      }));
      setParcelas(parcs);
    }
  }, [existing]);

  const hasVitalicia = parcelas.some(p => p.vitalicia);

  const addParcela = () => {
    const usados = parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela || 0);
    const proximo = (Math.max(0, ...usados)) + 1;
    setParcelas(prev => [...prev, {
      numero_parcela: proximo,
      vitalicia: false,
      vitalicia_inicio_parcela: null,
      label: proximo === 1 ? 'Taxa de Adesão' : `${proximo}ª Parcela`,
      ordem: prev.length,
      niveis: [],
    }]);
  };

  const addVitalicia = () => {
    if (hasVitalicia) {
      toast.error('Já existe uma parcela vitalícia nesta grade.');
      return;
    }
    const ultimaConfig = Math.max(0, ...parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela || 0));
    setParcelas(prev => [...prev, {
      numero_parcela: null,
      vitalicia: true,
      vitalicia_inicio_parcela: ultimaConfig + 1,
      label: 'Vitalícia',
      ordem: prev.length,
      niveis: [],
    }]);
  };

  const updateParcela = (idx: number, next: ParcelaForm) => {
    setParcelas(prev => prev.map((p, i) => i === idx ? next : p));
  };

  const removeParcela = (idx: number) => {
    setParcelas(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i })));
  };

  const moveParcela = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= parcelas.length) return;
    setParcelas(prev => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy.map((p, i) => ({ ...p, ordem: i }));
    });
  };

  const validate = (): string | null => {
    if (!nome.trim()) return 'Nome é obrigatório';
    if (parcelas.length === 0) return 'Adicione pelo menos uma parcela';
    for (const p of parcelas) {
      if (!p.label.trim()) return 'Cada parcela precisa de rótulo';
      if (p.vitalicia) {
        if (!p.vitalicia_inicio_parcela || p.vitalicia_inicio_parcela < 1) return 'Vitalícia: defina a parcela inicial';
      } else {
        if (!p.numero_parcela || p.numero_parcela < 1) return 'Parcela precisa de número válido';
      }
      const total = p.niveis.reduce((s, n) => s + (Number(n.percentual) || 0), 0);
      if (total > 100) return `Parcela "${p.label}": soma dos níveis ultrapassa 100%`;
      for (const n of p.niveis) {
        if (!n.role) return `Parcela "${p.label}": selecione o perfil de cada nível`;
        if (!n.nome.trim()) return `Parcela "${p.label}": cada nível precisa de nome`;
      }
      const noms = p.niveis.map(n => n.nome.trim().toLowerCase());
      if (noms.length !== new Set(noms).size) return `Parcela "${p.label}": níveis com nomes duplicados`;
    }
    // duplicates entre numero_parcela
    const nums = parcelas.filter(p => !p.vitalicia).map(p => p.numero_parcela);
    if (nums.length !== new Set(nums).size) return 'Há parcelas com o mesmo número';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      let gradeId = id;
      let novaVersao = 1;

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

        // Apaga parcelas + níveis (cascade)
        await (supabase as any).from('grades_comissao_parcelas').delete().eq('grade_id', id!);
        await (supabase as any).from('grades_comissao_niveis').delete().eq('grade_id', id!);
      } else {
        const { data, error } = await (supabase as any)
          .from('grades_comissao')
          .insert({ nome: nome.trim(), descricao: descricao.trim() || null, versao: 1, vigente_desde: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        gradeId = data.id;
      }

      // Insere parcelas
      const parcelasInsert = parcelas.map((p, i) => ({
        grade_id: gradeId!,
        numero_parcela: p.vitalicia ? null : p.numero_parcela,
        vitalicia: p.vitalicia,
        vitalicia_inicio_parcela: p.vitalicia ? p.vitalicia_inicio_parcela : null,
        label: p.label.trim(),
        ordem: i,
      }));
      const { data: pcsCriadas, error: pErr } = await (supabase as any)
        .from('grades_comissao_parcelas')
        .insert(parcelasInsert)
        .select('id, numero_parcela, vitalicia, ordem');
      if (pErr) throw pErr;

      // Insere níveis vinculados às parcelas criadas
      const niveisInsert: any[] = [];
      parcelas.forEach((p, i) => {
        const criada = pcsCriadas.find((c: any) => c.ordem === i);
        if (!criada) return;
        p.niveis.forEach((n, ni) => {
          niveisInsert.push({
            grade_id: gradeId!,
            parcela_id: criada.id,
            nome: n.nome.trim(),
            percentual: n.percentual,
            ordem: ni,
            role: n.role,
          });
        });
      });
      if (niveisInsert.length > 0) {
        const { error: nErr } = await (supabase as any).from('grades_comissao_niveis').insert(niveisInsert);
        if (nErr) throw nErr;
      }

      // Snapshot da nova versão
      const snapshot = {
        grade: { id: gradeId, nome: nome.trim(), descricao: descricao.trim() || null, versao: novaVersao },
        parcelas: parcelas.map((p, i) => ({
          parcela: {
            numero_parcela: p.vitalicia ? null : p.numero_parcela,
            vitalicia: p.vitalicia,
            vitalicia_inicio_parcela: p.vitalicia ? p.vitalicia_inicio_parcela : null,
            label: p.label.trim(),
            ordem: i,
          },
          niveis: p.niveis.map((n, ni) => ({
            nome: n.nome.trim(), percentual: n.percentual, ordem: ni, role: n.role,
          })),
        })),
      };
      await (supabase as any).from('grades_comissao_versoes').insert({
        grade_id: gradeId,
        versao: novaVersao,
        snapshot,
        vigente_desde: new Date().toISOString(),
        criado_por: profile?.id || null,
      });

      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      queryClient.invalidateQueries({ queryKey: ['grade-comissao-v2', id] });
      toast.success(isEdit ? 'Grade atualizada (nova versão)' : 'Grade criada');
      navigate('/configuracoes/grades-comissao');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar grade: ' + (e.message || 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/grades-comissao')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? 'Editar Grade' : 'Nova Grade de Comissão'}
        </h2>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Alterações nesta grade só valem para <b>novas vendas</b> a partir do momento do salvamento.
          Comissões já geradas permanecem inalteradas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center">
              Nome da Grade *
              <FieldHint text="Identifique a grade de forma clara. Ex: 'Grade Agência Premium'." />
            </label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grade Agência Premium" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Parcelas comissionadas</h3>
          <div className="flex gap-2">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={addParcela}>
                    <Plus className="h-4 w-4 mr-1" /> Parcela
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar parcela específica (1ª, 2ª, …)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={addVitalicia} disabled={hasVitalicia}>
                    <InfinityIcon className="h-4 w-4 mr-1" /> Vitalícia
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Vitalícia: a partir da parcela X, todos os pagamentos seguintes geram comissão com este percentual.
                </TooltipContent>
              </Tooltip>
          </TooltipProvider>
          </div>
        </div>

        {parcelas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma parcela configurada. Adicione a "Taxa de Adesão" e/ou parcelas mensais.
            </CardContent>
          </Card>
        ) : (
          parcelas.map((p, i) => (
            <ParcelaEditor
              key={p.id || `new-${i}`}
              parcela={p}
              index={i}
              onChange={next => updateParcela(i, next)}
              onRemove={() => removeParcela(i)}
              onMove={dir => moveParcela(i, dir)}
              canMoveUp={i > 0}
              canMoveDown={i < parcelas.length - 1}
              commercialRoles={commercialRoles.map(r => ({ role: r.role, label: r.label }))}
            />
          ))
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/configuracoes/grades-comissao')}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : isEdit ? 'Salvar nova versão' : 'Criar Grade'}
        </Button>
      </div>
    </div>
  );
}
