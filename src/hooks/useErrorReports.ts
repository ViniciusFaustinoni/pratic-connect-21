import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ErrorReportStatus = 'aberto' | 'em_tratamento' | 'concluido' | 'validado';

export interface ErrorReport {
  id: string;
  reporter_id: string;
  reporter_nome: string | null;
  reporter_email: string | null;
  area: string;
  descricao: string;
  status: ErrorReportStatus;
  observacao_diretor: string | null;
  tratado_por: string | null;
  tratado_em: string | null;
  concluido_por: string | null;
  concluido_em: string | null;
  validado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorReportFile {
  id: string;
  report_id: string;
  storage_path: string;
  nome_original: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
}

const BUCKET = 'relatos-erros';

export function useMyPendingValidations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['error-reports', 'my-pending-validations', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('error_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_id', user!.id)
        .eq('status', 'concluido');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMyConcluidosReports() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['error-reports', 'my-concluidos', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_reports')
        .select('*')
        .eq('reporter_id', user!.id)
        .eq('status', 'concluido')
        .order('concluido_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ErrorReport[];
    },
  });
}

export function useErrorReportsList(filters?: {
  status?: ErrorReportStatus | 'todos';
  search?: string;
}) {
  return useQuery({
    queryKey: ['error-reports', 'list', filters],
    queryFn: async () => {
      let q = supabase.from('error_reports').select('*').order('created_at', { ascending: false });
      if (filters?.status && filters.status !== 'todos') q = q.eq('status', filters.status);
      if (filters?.search) {
        const s = `%${filters.search}%`;
        q = q.or(`area.ilike.${s},descricao.ilike.${s},reporter_nome.ilike.${s},reporter_email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ErrorReport[];
    },
  });
}

export function useErrorReportFiles(reportId: string | null) {
  return useQuery({
    queryKey: ['error-reports', 'files', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_report_files')
        .select('*')
        .eq('report_id', reportId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const files = (data ?? []) as ErrorReportFile[];
      // Gerar signed URLs
      const withUrls = await Promise.all(
        files.map(async (f) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(f.storage_path, 3600);
          return { ...f, signedUrl: signed?.signedUrl ?? null };
        })
      );
      return withUrls;
    },
  });
}

export function useCreateErrorReport() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      area,
      descricao,
      files,
    }: {
      area: string;
      descricao: string;
      files: File[];
    }) => {
      if (!user) throw new Error('Não autenticado');

      const { data: report, error } = await supabase
        .from('error_reports')
        .insert({
          reporter_id: user.id,
          reporter_nome: profile?.nome ?? null,
          reporter_email: profile?.email ?? user.email ?? null,
          area: area.trim(),
          descricao: descricao.trim(),
        })
        .select()
        .single();
      if (error) throw error;

      if (files.length > 0) {
        const uploaded: { path: string; file: File }[] = [];
        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\-]/g, '_');
          const path = `${user.id}/${report.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          uploaded.push({ path, file });
        }
        const { error: filesErr } = await supabase.from('error_report_files').insert(
          uploaded.map((u) => ({
            report_id: report.id,
            storage_path: u.path,
            nome_original: u.file.name,
            mime_type: u.file.type,
            tamanho_bytes: u.file.size,
          }))
        );
        if (filesErr) throw filesErr;
      }

      return report;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-reports'] });
      toast.success('Relato de erro enviado com sucesso!');
    },
    onError: (e: any) => toast.error('Falha ao enviar relato', { description: e.message }),
  });
}

export function useUpdateErrorReportStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      observacao,
    }: {
      id: string;
      status: ErrorReportStatus;
      observacao?: string;
    }) => {
      const patch: any = { status };
      if (observacao !== undefined) patch.observacao_diretor = observacao;
      if (status === 'em_tratamento') {
        patch.tratado_por = user?.id;
        patch.tratado_em = new Date().toISOString();
      }
      if (status === 'concluido') {
        patch.concluido_por = user?.id;
        patch.concluido_em = new Date().toISOString();
      }
      if (status === 'validado') {
        patch.validado_em = new Date().toISOString();
      }
      const { error } = await supabase.from('error_reports').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['error-reports'] });
      const labels: Record<ErrorReportStatus, string> = {
        aberto: 'Reaberto',
        em_tratamento: 'Em tratamento',
        concluido: 'Marcado como concluído',
        validado: 'Validado!',
      };
      toast.success(labels[vars.status]);
    },
    onError: (e: any) => toast.error('Falha ao atualizar status', { description: e.message }),
  });
}
