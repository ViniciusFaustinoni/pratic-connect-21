UPDATE servicos
   SET status = 'aprovada_ressalvas',
       iniciada_em = COALESCE(iniciada_em, created_at),
       concluida_em = now(),
       observacoes = COALESCE(observacoes,'') ||
         E'\n[20/04 - ajuste manual] Serviço finalizado no SISTEMA LEGADO pelo instalador WALLACE. Registrado como CONCLUÍDO COM RESSALVAS para destravar fluxo e ativar veículo no Monitoramento 360.'
 WHERE id = '1ae32eeb-41a2-4d23-99b7-e825c0e3da2d';

UPDATE vistorias
   SET status = 'concluida',
       concluida_em = now(),
       iniciada_em = COALESCE(iniciada_em, created_at),
       ressalvas = COALESCE(ressalvas,'') ||
         E'\n[20/04] Instalação finalizada no sistema legado. Migrada com ressalvas para destravar fluxo operacional e ativar Monitoramento 360.',
       observacoes = COALESCE(observacoes,'') || E'\n[20/04] Origem: sistema legado. Instalador: WALLACE.',
       updated_at = now()
 WHERE id = '9a79a9b4-7894-44bf-a23b-efd67ab1c086';

UPDATE agendamentos_base
   SET status = 'realizado',
       updated_at = now()
 WHERE id = '836bcba0-92a5-4193-b608-5426461b2d69';

UPDATE servicos
   SET status = 'cancelada',
       observacoes = COALESCE(observacoes,'') ||
         E'\n[20/04] Cancelada por DUPLICIDADE — instalação já realizada no sistema legado por WALLACE em 20/04 (servico 1ae32eeb).'
 WHERE id = '5671f5cd-a7e8-4ff0-a1c7-bfce8807d23a';

INSERT INTO associados_historico
  (associado_id, veiculo_id, tipo, acao, descricao, status_anterior, status_novo, motivo, dados_novos)
SELECT v.associado_id,
       v.id,
       'instalacao_concluida',
       'concluir_legado',
       'Instalação CONCLUÍDA COM RESSALVAS (sistema legado) — Wallace finalizou no sistema antigo. Veículo marcado para Monitoramento 360 manualmente.',
       'agendada',
       'aprovada_ressalvas',
       'Finalização realizada no sistema legado pelo instalador WALLACE',
       jsonb_build_object(
         'instalador', 'Wallace',
         'placa', 'HAT3D43',
         'origem_ajuste', 'sistema_legado',
         'com_ressalvas', true,
         'servico_id', '1ae32eeb-41a2-4d23-99b7-e825c0e3da2d',
         'vistoria_id', '9a79a9b4-7894-44bf-a23b-efd67ab1c086',
         'instalacao_duplicada_cancelada', '5671f5cd-a7e8-4ff0-a1c7-bfce8807d23a',
         'observacao', 'Rastreador físico instalado no sistema legado; cadastro do device no novo sistema deve ser feito pelo coordenador vinculando ao veiculo_id 0357a7f9-bcaf-434c-a89b-e90528269b63.'
       )
  FROM veiculos v
 WHERE v.placa = 'HAT3D43';