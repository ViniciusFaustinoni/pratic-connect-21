import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Copy, Power, Trash2, Layers, Users, Infinity as InfinityIcon, ListOrdered, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GradeNivel {
  id: string;
  percentual: number;
}

interface GradeParcela {
  id: string;
  vitalicia: boolean;
  numero_parcela: number | null;
}

interface GradeComissao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao?: number;
  created_at: string;
  grades_comissao_niveis: GradeNivel[];
  grades_comissao_parcelas: GradeParcela[];
  grade_comissao_planos?: { plano_id: string }[];
  grade_comissao_plano_regras?: { role: string; tipo_comissao: string }[];
}

interface GradesComissaoProps {
  basePath?: string;
}

export default function GradesComissao({ basePath = '/configuracoes/grades-comissao' }: GradesComissaoProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['grades-comissao'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grades_comissao')
        .select('id, nome, descricao, ativo, versao, created_at, grades_comissao_niveis(id, percentual), grades_comissao_parcelas(id, vitalicia, numero_parcela), grade_comissao_planos(plano_id), grade_comissao_plano_regras(role, tipo_comissao)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GradeComissao[];
    },
  });

  // Buscar contagem de usuários por grade
  const { data: userCounts = {} } = useQuery({
    queryKey: ['grades-comissao-user-counts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('usuario_grade_comissao')
        .select('grade_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.grade_id] = (counts[r.grade_id] || 0) + 1;
      });
      return counts;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from('grades_comissao').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (gradeId: string) => {
      const grade = grades.find(g => g.id === gradeId);
      if (!grade) throw new Error('Grade não encontrada');

      // Buscar parcelas e níveis originais
      const { data: parcOrig, error: pErr } = await (supabase as any)
        .from('grades_comissao_parcelas')
        .select('id, numero_parcela, vitalicia, vitalicia_inicio_parcela, label, ordem')
        .eq('grade_id', gradeId)
        .order('ordem');
      if (pErr) throw pErr;

      const { data: nvsOrig, error: nErr } = await (supabase as any)
        .from('grades_comissao_niveis')
        .select('parcela_id, nome, percentual, ordem, role')
        .eq('grade_id', gradeId)
        .order('ordem');
      if (nErr) throw nErr;

      const { data: planosOrig, error: gpErr } = await (supabase as any)
        .from('grade_comissao_planos')
        .select('plano_id, ativo')
        .eq('grade_id', gradeId);
      if (gpErr) throw gpErr;

      const { data: regrasOrig, error: rErr } = await (supabase as any)
        .from('grade_comissao_plano_regras')
        .select('plano_id, parcela_numero, vitalicia, vitalicia_inicio_parcela, role, nome_nivel, tipo_comissao, valor, ativo, ordem')
        .eq('grade_id', gradeId);
      if (rErr) throw rErr;

      const { data: newGrade, error: gErr } = await (supabase as any)
        .from('grades_comissao')
        .insert({ nome: `${grade.nome} (Cópia)`, descricao: grade.descricao, versao: 1 })
        .select('id')
        .single();
      if (gErr) throw gErr;

      // Recriar parcelas mapeando ids antigos -> novos
      const parcMap: Record<string, string> = {};
      if (parcOrig && parcOrig.length > 0) {
        for (const p of parcOrig) {
          const { data: novaP, error: e1 } = await (supabase as any)
            .from('grades_comissao_parcelas')
            .insert({
              grade_id: newGrade.id,
              numero_parcela: p.numero_parcela,
              vitalicia: p.vitalicia,
              vitalicia_inicio_parcela: p.vitalicia_inicio_parcela,
              label: p.label,
              ordem: p.ordem,
            })
            .select('id')
            .single();
          if (e1) throw e1;
          parcMap[p.id] = novaP.id;
        }
      }

      if (nvsOrig && nvsOrig.length > 0) {
        const { error: iErr } = await (supabase as any)
          .from('grades_comissao_niveis')
          .insert(nvsOrig.map((n: any) => ({
            grade_id: newGrade.id,
            parcela_id: n.parcela_id ? parcMap[n.parcela_id] : null,
            nome: n.nome,
            percentual: n.percentual,
            ordem: n.ordem,
            role: n.role,
          })));
        if (iErr) throw iErr;
      }

      if (planosOrig && planosOrig.length > 0) {
        const { error: gpiErr } = await (supabase as any).from('grade_comissao_planos').insert(
          planosOrig.map((p: any) => ({ grade_id: newGrade.id, plano_id: p.plano_id, ativo: p.ativo }))
        );
        if (gpiErr) throw gpiErr;
      }

      if (regrasOrig && regrasOrig.length > 0) {
        const { error: riErr } = await (supabase as any).from('grade_comissao_plano_regras').insert(
          regrasOrig.map((r: any) => ({ ...r, grade_id: newGrade.id, parcela_id: null }))
        );
        if (riErr) throw riErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      toast.success('Grade duplicada');
    },
    onError: () => toast.error('Erro ao duplicar'),
  });

  const handleDeleteClick = async (id: string) => {
    const count = userCounts[id] || 0;
    if (count > 0) {
      toast.error(`Esta grade é usada por ${count} usuário(s) na área de Atribuição. Remova as atribuições primeiro.`);
      return;
    }
    setDeleteId(id);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('grades_comissao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      queryClient.invalidateQueries({ queryKey: ['grades-comissao-user-counts'] });
      toast.success('Grade excluída');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Não foi possível excluir. A grade pode estar em uso.');
      setDeleteId(null);
    },
  });

  const getTotalPercentual = (niveis: GradeNivel[]) =>
    niveis.reduce((sum, n) => sum + Number(n.percentual), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Grades de Comissão</h2>
          <p className="text-sm text-muted-foreground">Configure quanto cada plano paga para cada perfil de acesso. Usuários são vinculados somente em Atribuição de Grades.</p>
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate(`${basePath}/nova`)}>
                <Plus className="h-4 w-4 mr-2" /> Nova Grade
              </Button>
            </TooltipTrigger>
            <TooltipContent>Criar uma nova grade de comissão do zero.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : grades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma grade cadastrada</p>
            <Button variant="outline" onClick={() => navigate(`${basePath}/nova`)}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeira grade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {grades.map((grade) => {
            const total = getTotalPercentual(grade.grades_comissao_niveis);
            const qtdNiveis = grade.grades_comissao_niveis.length;
            const qtdUsuarios = userCounts[grade.id] || 0;
            const parcelas = grade.grades_comissao_parcelas || [];
            const qtdParcelas = parcelas.filter(p => !p.vitalicia).length;
            const temVitalicia = parcelas.some(p => p.vitalicia);
            const qtdPlanos = grade.grade_comissao_planos?.length || 0;
            const perfisConfigurados = Array.from(new Set((grade.grade_comissao_plano_regras || []).map(r => r.role))).length;
            return (
              <Card key={grade.id} className={!grade.ativo ? 'opacity-60' : ''}>
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{grade.nome}</span>
                      <Badge variant={grade.ativo ? 'default' : 'secondary'}>
                        {grade.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                      {grade.versao && grade.versao > 1 && (
                        <Badge variant="outline">v{grade.versao}</Badge>
                      )}
                      {qtdUsuarios > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          Usada por {qtdUsuarios}
                        </Badge>
                      )}
                      {temVitalicia && (
                        <Badge variant="default" className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
                          <InfinityIcon className="h-3 w-3" /> Vitalícia
                        </Badge>
                      )}
                      {qtdPlanos > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Package className="h-3 w-3" /> {qtdPlanos} plano{qtdPlanos === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>
                    {grade.descricao && (
                      <p className="text-xs text-muted-foreground truncate">{grade.descricao}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <ListOrdered className="h-3 w-3" />
                        {qtdParcelas} {qtdParcelas === 1 ? 'parcela' : 'parcelas'}
                        {temVitalicia && ' + vitalícia'}
                      </span>
                      <span>{qtdNiveis} regra{qtdNiveis === 1 ? '' : 's'} auxiliar{qtdNiveis === 1 ? '' : 'es'}</span>
                      <span>{perfisConfigurados || qtdNiveis} perfil{(perfisConfigurados || qtdNiveis) === 1 ? '' : 'is'} remunerado{(perfisConfigurados || qtdNiveis) === 1 ? '' : 's'}</span>
                      <span>Percentual auxiliar: {total}%</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-primary font-medium cursor-help">Empresa: {Math.max(100 - total, 0)}%</span>
                        </TooltipTrigger>
                        <TooltipContent>Percentual auxiliar retido pela empresa nas regras percentuais</TooltipContent>
                      </Tooltip>
                    </div>
                    <Progress value={Math.min(total, 100)} className="h-1.5 w-40" />
                  </div>

                  <TooltipProvider delayDuration={200}>
                    <div className="flex items-center gap-1 ml-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`${basePath}/${grade.id}`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar regras comerciais por plano e perfil</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(grade.id)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Criar uma cópia desta grade com as mesmas regras comerciais</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: grade.id, ativo: !grade.ativo })}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ativar ou inativar esta grade. Grades inativas não podem ser atribuídas a novos usuários.</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(grade.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir esta grade. Só é possível se não estiver em uso.</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grade?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se a grade estiver em uso, considere inativá-la.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
