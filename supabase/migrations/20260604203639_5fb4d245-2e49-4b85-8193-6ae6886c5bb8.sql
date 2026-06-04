
ALTER TABLE public.ia_habilidades
  ADD COLUMN IF NOT EXISTS mensagem_cpf_encontrado text,
  ADD COLUMN IF NOT EXISTS mensagem_cpf_nao_encontrado_retry text,
  ADD COLUMN IF NOT EXISTS mensagem_cpf_nao_encontrado_transbordo text;

UPDATE public.ia_habilidades
SET
  mensagem_cpf_encontrado = COALESCE(mensagem_cpf_encontrado, 'Encontrei você, {nome}! Em que posso te ajudar hoje? 😊'),
  mensagem_cpf_nao_encontrado_retry = COALESCE(mensagem_cpf_nao_encontrado_retry, 'Não encontrei esse CPF na nossa base. Pode digitar novamente, por favor? 😉'),
  mensagem_cpf_nao_encontrado_transbordo = COALESCE(mensagem_cpf_nao_encontrado_transbordo, 'Não consegui localizar seu cadastro. Vou te passar para um de nossos atendentes, tudo bem?')
WHERE slug = 'relacionamento';

ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS cpf_nao_encontrado_tentativas int NOT NULL DEFAULT 0;
