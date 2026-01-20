import { supabase } from '@/integrations/supabase/client';

// Tipos de ações possíveis no sistema
export type AcaoAuditoria = 
  | 'criar' | 'editar' | 'excluir' | 'visualizar'
  | 'aprovar' | 'reprovar' | 'cancelar' | 'reativar'
  | 'enviar' | 'duplicar' | 'exportar' | 'importar'
  | 'ativar' | 'desativar' | 'atribuir' | 'baixar'
  | 'login' | 'logout';

// Módulos do sistema
export type ModuloAuditoria = 
  | 'cotacoes' | 'leads' | 'contratos' | 'associados' 
  | 'vistorias' | 'instalacoes' | 'veiculos' | 'planos'
  | 'cobrancas' | 'sinistros' | 'processos' | 'documentos'
  | 'rotas' | 'usuarios' | 'configuracoes' | 'acordos'
  | 'rh' | 'marketing' | 'monitoramento' | 'diretoria';

interface LogParams {
  acao: AcaoAuditoria;
  modulo: ModuloAuditoria;
  descricao: string;
  entidade_id?: string;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
}

/**
 * Registra uma ação de auditoria no sistema
 * Não propaga erros para não afetar a operação principal
 */
export async function registrarLog(params: LogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('[AuditLog] Usuário não autenticado, log não registrado');
      return;
    }
    
    // Buscar dados do profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .eq('user_id', user.id)
      .maybeSingle();
    
    // Inserir na tabela logs_auditoria (usada pela diretoria)
    // Usando type assertion pois o schema pode não estar sincronizado
    const logData = {
      usuario_id: profile?.id || user.id,
      usuario_nome: profile?.nome || user.email || 'Desconhecido',
      acao: params.acao,
      modulo: params.modulo,
      descricao: params.descricao,
      registro_id: params.entidade_id || null,
      dados_anteriores: params.dados_anteriores || null,
      dados_novos: params.dados_novos || null,
    };
    
    const { error } = await supabase
      .from('logs_auditoria')
      .insert([logData] as never[]);
    
    if (error) {
      console.error('[AuditLog] Erro ao registrar:', error);
    }
  } catch (error) {
    // Silenciosamente falha para não afetar operação principal
    console.error('[AuditLog] Erro inesperado:', error);
  }
}

/**
 * Hook React para uso em componentes
 */
export function useAuditLog() {
  return { registrarLog };
}
