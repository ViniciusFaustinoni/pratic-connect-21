DO $$
DECLARE
  v_conteudo TEXT;
BEGIN
  SELECT conteudo INTO v_conteudo FROM documento_templates WHERE codigo = 'AF1';
  
  v_conteudo := REPLACE(v_conteudo, '( ) Adesão', '{{operacao.adesao}} Adesão');
  v_conteudo := REPLACE(v_conteudo, '( ) Migração', '{{operacao.migracao}} Migração');
  v_conteudo := REPLACE(v_conteudo, '( ) Inclusão', '{{operacao.inclusao}} Inclusão');
  v_conteudo := REPLACE(v_conteudo, '( ) Troca de Titularidade', '{{operacao.troca_titularidade}} Troca de Titularidade');
  v_conteudo := REPLACE(v_conteudo, '( ) Reativação', '{{operacao.reativacao}} Reativação');
  v_conteudo := REPLACE(v_conteudo, '() Subs. Placa', '{{operacao.substituicao_placa}} Subs. Placa');
  
  UPDATE documento_templates SET conteudo = v_conteudo, updated_at = now() WHERE codigo = 'AF1';
END $$;