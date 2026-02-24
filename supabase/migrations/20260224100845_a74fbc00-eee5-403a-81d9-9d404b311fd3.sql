
-- Adicionar coluna provedor na tabela whatsapp_instancias
ALTER TABLE public.whatsapp_instancias ADD COLUMN IF NOT EXISTS provedor text DEFAULT 'evolution';

-- Tabela de configuração da API Oficial da Meta
CREATE TABLE public.whatsapp_meta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL DEFAULT '',
  waba_id text NOT NULL DEFAULT '',
  verify_token text DEFAULT 'sga_pratic_meta_webhook',
  testado boolean DEFAULT false,
  testado_em timestamptz,
  ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_config_select" ON public.whatsapp_meta_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "meta_config_insert" ON public.whatsapp_meta_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "meta_config_update" ON public.whatsapp_meta_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

-- Tabela de templates da API Oficial da Meta
CREATE TABLE public.whatsapp_meta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  categoria text NOT NULL DEFAULT 'UTILITY',
  idioma text DEFAULT 'pt_BR',
  status text DEFAULT 'DRAFT',
  header_tipo text DEFAULT 'none',
  header_texto text,
  corpo text NOT NULL,
  rodape text,
  botoes jsonb,
  variaveis_exemplo jsonb,
  meta_template_id text,
  motivo_rejeicao text,
  enviado_em timestamptz,
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_templates_select" ON public.whatsapp_meta_templates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'regulador'::app_role)
  );

CREATE POLICY "meta_templates_insert" ON public.whatsapp_meta_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "meta_templates_update" ON public.whatsapp_meta_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "meta_templates_delete" ON public.whatsapp_meta_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

-- Templates padrão (rascunho)
INSERT INTO public.whatsapp_meta_templates (nome, categoria, corpo, variaveis_exemplo) VALUES
  ('boas_vindas_associado', 'UTILITY', 'Olá {{1}}! Seja bem-vindo(a) à PraticCar. Seu cadastro foi aprovado e seu veículo {{2}} já está protegido. Em caso de dúvidas, estamos à disposição.', '{"1": "João", "2": "ABC-1234"}'::jsonb),
  ('cobranca_mensalidade', 'UTILITY', 'Olá {{1}}, sua mensalidade PraticCar de {{2}} vence em {{3}}. Acesse o app para pagar via Pix ou boleto.', '{"1": "Maria", "2": "Fevereiro/2026", "3": "10/02/2026"}'::jsonb),
  ('sinistro_aberto', 'UTILITY', 'Olá {{1}}, recebemos seu acionamento de sinistro (Protocolo {{2}}). Nossa equipe entrará em contato em breve para os próximos passos.', '{"1": "Carlos", "2": "SIN-2026-001"}'::jsonb),
  ('sinistro_atualizado', 'UTILITY', 'Olá {{1}}, há uma atualização no seu sinistro {{2}}: {{3}}. Acompanhe pelo app.', '{"1": "Ana", "2": "SIN-2026-001", "3": "Orçamento aprovado"}'::jsonb),
  ('assistencia_confirmada', 'UTILITY', 'Olá {{1}}, seu pedido de assistência foi confirmado. O prestador {{2}} está a caminho e chegará em aproximadamente {{3}} minutos.', '{"1": "Pedro", "2": "Auto Socorro SP", "3": "30"}'::jsonb),
  ('tarefa_vistoriador', 'UTILITY', 'Olá {{1}}, você tem uma nova tarefa de vistoria. Associado: {{2}}, Endereço: {{3}}, Data: {{4}}. Confirme no sistema.', '{"1": "Ricardo", "2": "José Silva", "3": "Rua das Flores, 123", "4": "25/02/2026"}'::jsonb),
  ('orcamento_oficina', 'UTILITY', 'Olá {{1}}, a PraticCar solicita orçamento para o veículo {{2}} ({{3}}). Problema relatado: {{4}}. Envie o orçamento pelo sistema ou responda esta mensagem.', '{"1": "Oficina Central", "2": "HB20 2022", "3": "ABC-1234", "4": "Colisão frontal"}'::jsonb),
  ('documentacao_pendente', 'UTILITY', 'Olá {{1}}, identificamos que falta(m) documento(s) para concluir seu cadastro: {{2}}. Envie pelo app ou acesse nosso portal.', '{"1": "Fernanda", "2": "CNH e comprovante de residência"}'::jsonb);
