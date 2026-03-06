ALTER TABLE servicos DROP CONSTRAINT IF EXISTS servicos_decisao_instalador_check;
ALTER TABLE servicos ADD CONSTRAINT servicos_decisao_instalador_check 
  CHECK (decisao_instalador = ANY (ARRAY[
    'aprovado', 'aprovado_ressalva', 'negado', 
    'pendente_monitoramento', 'declinado_monitoramento'
  ]));