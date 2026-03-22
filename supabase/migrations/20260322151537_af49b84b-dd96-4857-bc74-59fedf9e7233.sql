
-- Tabela de configuração do PDF de cotação
CREATE TABLE public.cotacao_pdf_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cor_primaria TEXT NOT NULL DEFAULT '#14376E',
  cor_secundaria TEXT NOT NULL DEFAULT '#C81E41',
  logo_url TEXT,
  nome_empresa TEXT NOT NULL DEFAULT 'PRATICCAR Proteção Veicular',
  mensagem_encerramento TEXT NOT NULL DEFAULT 'Será um prazer ter você como nosso associado. Estaremos aqui para o que precisar.',
  mostrar_validade BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_solicitante BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_veiculo BOOLEAN NOT NULL DEFAULT true,
  mostrar_mensagem_encerramento BOOLEAN NOT NULL DEFAULT true,
  mostrar_whatsapp_rodape BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.cotacao_pdf_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cotacao_pdf_config"
ON public.cotacao_pdf_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Diretor can insert cotacao_pdf_config"
ON public.cotacao_pdf_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Diretor can update cotacao_pdf_config"
ON public.cotacao_pdf_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'))
WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- Registro padrão
INSERT INTO public.cotacao_pdf_config (
  cor_primaria, cor_secundaria, nome_empresa, mensagem_encerramento,
  mostrar_validade, mostrar_dados_solicitante, mostrar_dados_veiculo,
  mostrar_mensagem_encerramento, mostrar_whatsapp_rodape
) VALUES (
  '#14376E', '#C81E41', 'PRATICCAR Proteção Veicular',
  'Será um prazer ter você como nosso associado. Estaremos aqui para o que precisar.',
  true, true, true, true, true
);
