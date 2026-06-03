
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS cpf_tentativas_invalidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_msg_continuidade_em timestamptz;

COMMENT ON COLUMN public.agente_ia_contatos.cpf_tentativas_invalidas IS 'Contador de tentativas seguidas com CPF inválido — reseta ao capturar CPF válido. Na 3ª tentativa, Maya oferece transbordo humano.';
COMMENT ON COLUMN public.agente_ia_contatos.ultima_msg_continuidade_em IS 'Timestamp da última mensagem de "continuidade" (fallback anti-silêncio) enviada pela Maya. Debounce de 2 min impede flood.';
