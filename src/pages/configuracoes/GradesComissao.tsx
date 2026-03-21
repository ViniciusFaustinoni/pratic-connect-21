import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Copy, Power, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GradeComissao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  grades_comissao_niveis: { id: string; percentual: number }[];
}

export default function GradesComissao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['grades-comissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grades_comissao')
        .select('id, nome, descricao, ativo, created_at, grades_comissao_niveis(id, percentual)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GradeComissao[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('grades_comissao').update({ ativo }).eq('id', id);
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

      // Fetch full levels
      const { data: niveis, error: nErr } = await supabase
        .from('grades_comissao_niveis')
        .select('nome, percentual, ordem')
        .eq('grade_id', gradeId)
        .order('ordem');
      if (nErr) throw nErr;

      const { data: newGrade, error: gErr } = await supabase
        .from('grades_comissao')
        .insert({ nome: `${grade.nome} (Cópia)`, descricao: grade.descricao })
        .select('id')
        .single();
      if (gErr) throw gErr;

      if (niveis && niveis.length > 0) {
        const { error: iErr } = await supabase
          .from('grades_comissao_niveis')
          .insert(niveis.map(n => ({ ...n, grade_id: newGrade.id })));
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      toast.success('Grade duplicada');
    },
    onError: () => toast.error('Erro ao duplicar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grades_comissao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-comissao'] });
      toast.success('Grade excluída');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Não foi possível excluir. A grade pode estar em uso.');
      setDeleteId(null);
    },
  });

  const getTotalPercentual = (niveis: { percentual: number }[]) =>
    niveis.reduce((sum, n) => sum + Number(n.percentual), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Grades de Comissão</h2>
          <p className="text-sm text-muted-foreground">Configure grades com níveis de comissionamento sobre taxa de adesão</p>
        </div>
        <Button onClick={() => navigate('/configuracoes/grades-comissao/nova')}>
          <Plus className="h-4 w-4 mr-2" /> Nova Grade
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : grades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma grade cadastrada</p>
            <Button variant="outline" onClick={() => navigate('/configuracoes/grades-comissao/nova')}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeira grade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {grades.map((grade) => {
            const total = getTotalPercentual(grade.grades_comissao_niveis);
            const qtdNiveis = grade.grades_comissao_niveis.length;
            return (
              <Card key={grade.id} className={!grade.ativo ? 'opacity-60' : ''}>
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{grade.nome}</span>
                      <Badge variant={grade.ativo ? 'default' : 'secondary'}>
                        {grade.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    {grade.descricao && (
                      <p className="text-xs text-muted-foreground truncate">{grade.descricao}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{qtdNiveis} {qtdNiveis === 1 ? 'nível' : 'níveis'}</span>
                      <span>Total: {total}%</span>
                    </div>
                    <Progress value={Math.min(total, 100)} className="h-1.5 w-40" />
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/configuracoes/grades-comissao/${grade.id}`)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(grade.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: grade.id, ativo: !grade.ativo })}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(grade.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
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
