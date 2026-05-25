ALTER TABLE public.auth_logs DROP CONSTRAINT IF EXISTS auth_logs_acao_check;
ALTER TABLE public.auth_logs ADD CONSTRAINT auth_logs_acao_check CHECK (acao = ANY (ARRAY[
  'login_sucesso','login_falha','logout','usuario_criado',
  'senha_reset_solicitado','senha_reset_concluido','senha_alterada',
  'perfil_adicionado','perfil_removido',
  'usuario_bloqueado','usuario_desbloqueado',
  'usuario_ativado','usuario_desativado',
  'sessao_expirada','sessoes_encerradas_desativacao','acesso_negado'
]));