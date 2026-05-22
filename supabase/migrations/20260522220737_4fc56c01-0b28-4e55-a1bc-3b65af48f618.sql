
UPDATE public.servicos
SET status = 'concluida'::status_servico,
    updated_at = now()
WHERE id IN (
  '225665d9-d6b3-4a3e-b832-5a93d112eb92',
  'b3da7f84-cd47-444c-ab7d-a41678ef29d1'
)
AND status = 'aprovada'::status_servico;

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, dados_anteriores, dados_novos, descricao)
VALUES
  (
    'reativar',
    'monitoramento',
    'servicos',
    '225665d9-d6b3-4a3e-b832-5a93d112eb92',
    jsonb_build_object('status', 'aprovada'),
    jsonb_build_object('status', 'concluida', 'tag', 'saneamento_reabertura_monitoramento'),
    'Saneamento manual (saneamento_reabertura_monitoramento): contrato CTR-20260521175754-XQYXPC (Luiz Amaral Barros Neto / placa KZZ9E93) foi aprovado antes das correcoes de caminho-publico-incompleto e do bug do trigger sync_instalacao_to_servicos, ficando preso entre Monitoramento aprovado e ativacao. Servico vistoria_entrada revertido de aprovada -> concluida para reaparecer em Monitoramento > Aprovacao de Associados; operador deve clicar em Devolver ao Cadastro para reabrir o ciclo canonico Cadastro -> Monitoramento com os guards atuais.'
  ),
  (
    'reativar',
    'monitoramento',
    'servicos',
    'b3da7f84-cd47-444c-ab7d-a41678ef29d1',
    jsonb_build_object('status', 'aprovada'),
    jsonb_build_object('status', 'concluida', 'tag', 'saneamento_reabertura_monitoramento'),
    'Saneamento manual (saneamento_reabertura_monitoramento): contrato CTR-20260521162553-HMCZ80 (Fernanda Fabiane Baptista / chassi 9C2KF5200TR010548) foi aprovado antes das correcoes de caminho-publico-incompleto e do bug do trigger sync_instalacao_to_servicos, ficando preso entre Monitoramento aprovado e ativacao. Servico vistoria_entrada revertido de aprovada -> concluida para reaparecer em Monitoramento > Aprovacao de Associados; operador deve clicar em Devolver ao Cadastro para reabrir o ciclo canonico Cadastro -> Monitoramento com os guards atuais.'
  );
