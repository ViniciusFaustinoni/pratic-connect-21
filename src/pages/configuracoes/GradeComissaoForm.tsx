import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { FieldHint } from '@/components/admin/planos/FieldHint';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppRoles } from '@/hooks/useAppRoles';

interface NivelForm {
  id?: string;
  nome: string;
  percentual: number;
  role: string;
}

export default function GradeComissaoForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'nova';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { roles: appRoles } = useAppRoles();

  // Filter to commercial roles only
  const commercialRoles = appRoles.filter(r => ['vendedor_clt', 'vendedor_externo', 'agencia'].includes(r.role));

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [niveis, setNiveis] = useState<NivelForm[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['grade-comissao', id],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grades_comissao')
        .select('*, grades_comissao_niveis(id, nome, percentual, ordem, role)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setNome(existing.nome);
      setDescricao(existing.descricao || '');
      const sorted = [...(existing.grades_comissao_niveis || [])].sort((a: any, b: any) => a.ordem - b.ordem);
      setNiveis(sorted.map((n: any) => ({ id: n.id, nome: n.nome, percentual: Number(n.percentual), role: n.role || '' })));
    }
  }, [existing]);

  const totalPercentual = niveis.reduce((s, n) => s + (Number(n.percentual) || 0), 0);
  const exceedsLimit = totalPercentual > 100;

  const addNivel = () => setNiveis(prev => [...prev, { nome: '', percentual: 0, role: '' }]);

  const removeNivel = (idx: number) => setNiveis(prev => prev.filter((_, i) => i !== idx));

  const updateNivel = (idx: number, field: keyof NivelForm, value: string | number) => {
    setNiveis(prev => prev.map((n, i) => i === idx ? { ...n, [field]: value } : n));
  };

  const moveNivel = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= niveis.length) return;
    setNiveis(prev => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const handleSave = async () => {
    if (!nome.trim()) return toast.error('Nome é obrigatório');
    if (niveis.length === 0) return toast.error('Adicione pelo menos um nível');
    if (niveis.some(n => !n.role)) return toast.error('Selecione o perfil de cada nível');
    if (niveis.some(n => !n.nome.trim())) return toast.error('Todos os níveis precisam de nome');
    // Check duplicate roles
    const rolesUsed = niveis.map(n => n.role);
    const hasDuplicates = rolesUsed.length !== new Set(rolesUsed).size;
    if (hasDuplicates) return toast.error('Cada perfil só pode aparecer uma vez na grade');
    if (exceedsLimit) return;

    setSaving(true);
    try {
      let gradeId = id;

      if (isEdit) {
        const { error } = await (supabase as any)
          .from('grades_comissao')
          .update({ nome: nome.trim(), descricao: descricao.trim() || null })
          .eq('id', id!);
        if (error) throw error;

        await (supabase as any).from('grades_comissao_niveis').delete().eq('grade_id', id!);
      } else {
        const { data, error } = await (supabase as any)
          .from('grades_comissao')
          .insert({ nome: nome.trim(), descricao: descricao.trim() || null })
          .select('id')
          .single();
        if (error) throw error;
        gradeId = data.id;
      }

      const { error: nErr } = await (supabase as any)
        .from('grades_comissao_niveis')
        .insert(niveis.map((n, i) => ({
          grade_id: gradeId!,
          nome: n.nome.trim(),
          percentual: n.percentual,
          ordem: i,
          role: n.role,
        })));
      if (nErr) throw nErr;

      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      toast.success(isEdit ? 'Grade atualizada' : 'Grade criada');
      navigate('/configuracoes/grades-comissao');
    } catch (err) {
      toast.error('Erro ao salvar grade');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/grades-comissao')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? 'Editar Grade' : 'Nova Grade de Comissão'}
        </h2>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center">
              Nome da Grade *
              <FieldHint text="Identifique a grade de forma clara. Ex: 'Grade Agência Premium', 'Grade Vendedor Direto'." />
            </label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grade Agência Premium" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center">
              Descrição
              <FieldHint text="Opcional. Use para detalhar o propósito ou público-alvo desta grade." />
            </label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center">
              Níveis de Comissão
              <FieldHint text="Cada nível representa um participante na cadeia de vendas que recebe parte da taxa de adesão." />
            </CardTitle>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={addNivel}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Nível
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicione um novo nível de comissionamento (ex: Vendedor, Supervisor, Agência).</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {niveis.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum nível adicionado. Clique em "Adicionar Nível".
            </p>
          ) : (
            niveis.map((nivel, idx) => (
              <TooltipProvider delayDuration={200} key={idx}>
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                  <div className="flex flex-col gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveNivel(idx, -1)} disabled={idx === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Altere a ordem de prioridade deste nível na grade.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveNivel(idx, 1)} disabled={idx === niveis.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Altere a ordem de prioridade deste nível na grade.</TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 relative">
                    <Input
                      className="flex-1"
                      placeholder="Nome do nível (ex: Vendedor Externo)"
                      value={nivel.nome}
                      onChange={e => updateNivel(idx, 'nome', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1 w-28">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-20"
                      value={nivel.percentual}
                      onChange={e => updateNivel(idx, 'percentual', parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-sm text-muted-foreground flex items-center">
                      %
                      <FieldHint text="Percentual da taxa de adesão destinado a este nível. O total de todos os níveis não pode ultrapassar 100%." />
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeNivel(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove este nível da grade.</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            ))
          )}

          {niveis.length > 0 && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  Total alocado:
                  <FieldHint text="Soma de todos os percentuais. Pode ser menor que 100%, mas nunca maior." />
                </span>
                <span className={exceedsLimit ? 'text-destructive font-semibold' : 'font-medium text-foreground'}>
                  {totalPercentual}% de 100%
                </span>
              </div>
              <Progress
                value={Math.min(totalPercentual, 100)}
                className="h-2"
                indicatorClassName={exceedsLimit ? 'bg-destructive' : undefined}
              />
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Percentual da empresa:
                  <FieldHint text="Este é o percentual que permanece na empresa. Corresponde à diferença entre 100% e o total distribuído nos níveis." />
                </span>
                <span className="font-medium text-primary">
                  {totalPercentual >= 100
                    ? '0% — Todo o valor é distribuído'
                    : totalPercentual === 0
                      ? '100% — Nenhum nível configurado'
                      : `${100 - totalPercentual}%`}
                </span>
              </div>
              {exceedsLimit && (
                <p className="text-xs text-destructive font-medium">
                  A soma dos percentuais dos níveis não pode ultrapassar 100%. Total atual: {totalPercentual}%
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => navigate('/configuracoes/grades-comissao')}>Cancelar</Button>
            </TooltipTrigger>
            <TooltipContent>Descarta alterações e volta para a lista de grades.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSave} disabled={saving || exceedsLimit}>
                {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Grade'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salva a grade com todos os níveis configurados.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
