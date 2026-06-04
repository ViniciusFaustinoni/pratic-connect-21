
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS ultima_reconfirmacao_em timestamptz;

-- Saneamento pontual: zera identidade cacheada do telefone 5521992593830
-- (cache antigo era Thais; agora atende Vinicius). Força o gate canônico
-- na próxima mensagem.
UPDATE public.agente_ia_contatos
  SET cpf = NULL,
      cpf_capturado_em = NULL,
      nome = NULL,
      nome_confirmado_em = NULL,
      sga_associado_id = NULL,
      sga_associado_status = NULL,
      sga_associado_encontrado = false,
      ultima_saudacao_em = NULL,
      ultima_reconfirmacao_em = NULL,
      liberacao_enviada_em = NULL,
      cpf_tentativas_invalidas = 0
WHERE telefone = '5521992593830';
