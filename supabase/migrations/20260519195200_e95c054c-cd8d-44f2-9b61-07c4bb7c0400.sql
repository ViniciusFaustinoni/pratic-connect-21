-- Rewind Flavio (TTX8A88) ao Cadastro + realocar Base para hoje (19/05/2026)
BEGIN;

-- 1. Reverter cadastro_aprovado no contrato
UPDATE contratos
SET cadastro_aprovado = false,
    aprovado_por = NULL,
    aprovado_em = NULL,
    updated_at = now()
WHERE id = '93bfd060-e70e-4469-9988-282d4835e01d';

-- 2. Devolver cotação para fila do Cadastro
UPDATE cotacoes
SET status_contratacao = 'aguardando_aprovacao_cadastro',
    updated_at = now()
WHERE id = 'c205b940-dc4c-42ce-8538-4ae197f18fa9';

-- 3. Reverter status do associado
UPDATE associados
SET status = 'em_analise',
    updated_at = now()
WHERE id = 'c7ae48e9-db6d-4d45-8b43-c5b27a206163';

-- 4. Realocar agendamento_base para hoje 19/05/2026, mantendo período Tarde (13:00) e mesma oficina
UPDATE agendamentos_base
SET data_agendada = '2026-05-19',
    horario = '13:00:00',
    status = 'agendado',
    updated_at = now()
WHERE id = 'a0d21e62-c5b6-42d6-b59a-8f35b6617bda';

-- 5. Histórico no associado
INSERT INTO associados_historico (associado_id, tipo, descricao, created_at)
VALUES (
  'c7ae48e9-db6d-4d45-8b43-c5b27a206163',
  'status_alterado',
  'Rewind manual (admin): cotação estava em limbo pós-pagamento (cadastro_aprovado=true sem instalações/serviços materializados, mesmo bug do caso Marllon). Cadastro revertido para aguardar reaprovação manual dos documentos. Agendamento Base realocado de 18/05 13:00 para 19/05 13:00 (Tarde) na mesma oficina (41ef21e6-8d8e-487f-b6b5-8b26e4653790). Após reaprovação do Cadastro, aprovar-proposta materializará instalacoes+servicos para 19/05.',
  now()
);

COMMIT;