import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ErrorReportStatus = 'aberto' | 'em_tratamento' | 'concluido' | 'validado' | 'descartado';

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
  descartado_por: string | null;
  descartado_em: string | null;
  motivo_descarte: string | null;
  eh_retratamento: boolean;
  vezes_retratado: number;
  ultimo_motivo_retratamento: string | null;
  ultimo_retratamento_em: string | null;
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

export interface ErrorReportHistoryEntry {
  id: string;
  report_id: string;
  from_status: ErrorReportStatus | null;
  to_status: ErrorReportStatus;
  changed_by: string | null;
  changed_by_nome: string | null;
  observacao: string | null;
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

export interface ErrorReportsFilters {
  status?: ErrorReportStatus | 'todos';
  search?: string;
  reporterId?: string | null;
  dateFrom?: string | null; // ISO
  dateTo?: string | null;   // ISO
}

export function useErrorReportsList(filters?: ErrorReportsFilters) {
  return useQuery({
    queryKey: ['error-reports', 'list', filters],
    queryFn: async () => {
      let q = supabase.from('error_reports').select('*').order('created_at', { ascending: false });
      if (filters?.status && filters.status !== 'todos') q = q.eq('status', filters.status);
      if (filters?.reporterId) q = q.eq('reporter_id', filters.reporterId);
      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);
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

/** Lista de reporters distintos para combobox de filtro do diretor */
export function useReportersList() {
  return useQuery({
    queryKey: ['error-reports', 'reporters'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_reports')
        .select('reporter_id, reporter_nome, reporter_email')
        .order('reporter_nome', { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      const unique: { reporter_id: string; reporter_nome: string | null; reporter_email: string | null }[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.reporter_id)) continue;
        seen.add(r.reporter_id);
        unique.push(r);
      }
      return unique;
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

/** Histórico (transições de status) de UM relato. */
export function useErrorReportHistory(reportId: string | null) {
  return useQuery({
    queryKey: ['error-reports', 'history', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_report_history')
        .select('*')
        .eq('report_id', reportId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ErrorReportHistoryEntry[];
    },
  });
}

/** Histórico GLOBAL com filtros — usado na aba Histórico do diretor. */
export function useErrorReportHistoryGlobal(filters?: {
  reporterId?: string | null;
  changedBy?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string;
}) {
  return useQuery({
    queryKey: ['error-reports', 'history-global', filters],
    queryFn: async () => {
      let q = supabase
        .from('error_report_history')
        .select('*, error_reports!inner(id, area, descricao, reporter_id, reporter_nome)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters?.changedBy) q = q.eq('changed_by', filters.changedBy);
      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);
      if (filters?.reporterId) {
        q = q.eq('error_reports.reporter_id', filters.reporterId);
      }
      if (filters?.search) {
        const s = `%${filters.search}%`;
        q = q.or(`observacao.ilike.${s},changed_by_nome.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<
        ErrorReportHistoryEntry & {
          error_reports: {
            id: string;
            area: string;
            descricao: string;
            reporter_id: string;
            reporter_nome: string | null;
          };
        }
      >;
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
      motivo_descarte,
    }: {
      id: string;
      status: ErrorReportStatus;
      observacao?: string;
      motivo_descarte?: string;
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
      if (status === 'descartado') {
        patch.descartado_por = user?.id;
        patch.descartado_em = new Date().toISOString();
        if (motivo_descarte !== undefined) patch.motivo_descarte = motivo_descarte;
      }
      const { error } = await supabase.from('error_reports').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['error-reports'] });
      const labels: Record<ErrorReportStatus, string> = {
        aberto: 'Reaberto',
        em_tratamento: 'Em tratamento',
        concluido: 'Concluído — enviado para teste do usuário',
        validado: 'Validado!',
        descartado: 'Relato descartado',
      };
      toast.success(labels[vars.status]);
    },
    onError: (e: any) => toast.error('Falha ao atualizar status', { description: e.message }),
  });
}

/** Chama edge function que reescreve a descrição com IA. */
export function useMelhorarTextoRelato() {
  return useMutation({
    mutationFn: async ({ reportId, texto }: { reportId: string; texto?: string }) => {
      const { data, error } = await supabase.functions.invoke('melhorar-texto-relato-erro', {
        body: { report_id: reportId, texto },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as { texto_melhorado: string }).texto_melhorado;
    },
    onError: (e: any) => toast.error('Falha ao melhorar texto', { description: e.message }),
  });
}

export interface PromptCorrecaoResultado {
  titulo: string;
  contexto_resumido: string;
  arquivos_provaveis?: string[];
  passos_diagnostico?: string[];
  prompt_para_lovable: string;
}

/** Chama edge function que gera prompt pronto para o chat do Lovable. */
export function useGerarPromptCorrecao() {
  return useMutation({
    mutationFn: async ({ reportId }: { reportId: string }) => {
      const { data, error } = await supabase.functions.invoke('gerar-prompt-correcao-erro', {
        body: { report_id: reportId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as PromptCorrecaoResultado;
    },
    onError: (e: any) => toast.error('Falha ao gerar prompt', { description: e.message }),
  });
}

/**
 * Usuário (reporter) recusa a correção de um relato concluído:
 * volta para `em_tratamento` com flag de retratamento e contador incrementado.
 */
export function useReabrirRelatoComoRetratamento() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      if (!user) throw new Error('Não autenticado');
      const motivoTrim = motivo.trim();
      if (motivoTrim.length < 10) throw new Error('Informe um motivo com pelo menos 10 caracteres');

      // Buscar contador atual
      const { data: current, error: getErr } = await supabase
        .from('error_reports')
        .select('vezes_retratado, status, reporter_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;
      if (current.reporter_id !== user.id) throw new Error('Apenas o autor do relato pode reabrir');
      if (current.status !== 'concluido') throw new Error('Apenas relatos concluídos podem ser reabertos');

      const { error: updErr } = await supabase
        .from('error_reports')
        .update({
          status: 'em_tratamento',
          eh_retratamento: true,
          vezes_retratado: (current.vezes_retratado ?? 0) + 1,
          ultimo_motivo_retratamento: motivoTrim,
          ultimo_retratamento_em: new Date().toISOString(),
          concluido_em: null,
          concluido_por: null,
          observacao_diretor: null,
        })
        .eq('id', id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-reports'] });
      toast.success('Relato devolvido para tratamento como retratamento');
    },
    onError: (e: any) => toast.error('Falha ao reabrir relato', { description: e.message }),
  });
}

