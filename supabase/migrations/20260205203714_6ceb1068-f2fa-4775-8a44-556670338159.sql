-- Adicionar campo para verificação obrigatória de titularidade do comprovante de residência
ALTER TABLE public.regioes 
ADD COLUMN exigir_titularidade_comprovante BOOLEAN NOT NULL DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.regioes.exigir_titularidade_comprovante IS 'Se true, o nome no comprovante de residência deve corresponder ao nome na CNH do usuário. Se false, aceita comprovantes em nome de terceiros.';