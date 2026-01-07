-- Tabela de templates de mensagem WhatsApp
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(50) NOT NULL CHECK (categoria IN (
    'vendas', 'cadastro', 'cobranca', 'monitoramento', 
    'eventos', 'assistencia', 'geral'
  )),
  
  -- Conteúdo
  mensagem TEXT NOT NULL,
  variaveis TEXT[] DEFAULT '{}',
  
  -- Controle
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wpp_templates_categoria ON public.whatsapp_templates(categoria);
CREATE INDEX idx_wpp_templates_codigo ON public.whatsapp_templates(codigo);
CREATE INDEX idx_wpp_templates_ativo ON public.whatsapp_templates(ativo) WHERE ativo = TRUE;

-- RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionários podem ver templates ativos" ON public.whatsapp_templates
  FOR SELECT USING (ativo = TRUE);

CREATE POLICY "Gerência pode gerenciar templates" ON public.whatsapp_templates
  FOR ALL USING (public.am_i_gerencia());

-- Trigger de updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar template (substituir variáveis)
CREATE OR REPLACE FUNCTION public.processar_template(
  p_template_id UUID,
  p_variaveis JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mensagem TEXT;
  v_chave TEXT;
  v_valor TEXT;
BEGIN
  SELECT mensagem INTO v_mensagem
  FROM whatsapp_templates
  WHERE id = p_template_id AND ativo = TRUE;
  
  IF v_mensagem IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado ou inativo';
  END IF;
  
  FOR v_chave, v_valor IN SELECT * FROM jsonb_each_text(p_variaveis)
  LOOP
    v_mensagem := REPLACE(v_mensagem, '{{' || v_chave || '}}', COALESCE(v_valor, ''));
  END LOOP;
  
  RETURN v_mensagem;
END;
$$;

-- Inserir templates padrão
INSERT INTO public.whatsapp_templates (codigo, nome, descricao, categoria, mensagem, variaveis) VALUES

-- VENDAS
('vendas_cotacao', 'Cotação Enviada', 'Enviar após gerar cotação', 'vendas',
'Olá {{nome}}! 👋

Segue a cotação para proteção do seu veículo *{{placa}}*:

💰 *Valor mensal:* R$ {{valor_mensal}}
📋 *Plano:* {{plano}}

A cotação é válida por 7 dias.

Alguma dúvida? Estou à disposição! 🚗',
ARRAY['nome', 'placa', 'valor_mensal', 'plano']),

('vendas_followup', 'Follow-up de Cotação', 'Lembrar sobre cotação pendente', 'vendas',
'Olá {{nome}}! 

Vi que você recebeu uma cotação para seu *{{veiculo}}* há alguns dias. 

Posso te ajudar com alguma dúvida? O valor continua o mesmo! 😊',
ARRAY['nome', 'veiculo']),

-- CADASTRO
('cadastro_documentos', 'Solicitar Documentos', 'Pedir documentos pendentes', 'cadastro',
'Olá {{nome}}! 

Para finalizar seu cadastro, preciso que envie os seguintes documentos:

{{lista_documentos}}

📎 Pode enviar as fotos aqui mesmo no WhatsApp!',
ARRAY['nome', 'lista_documentos']),

('cadastro_aprovado', 'Cadastro Aprovado', 'Avisar aprovação de cadastro', 'cadastro',
'🎉 Parabéns {{nome}}!

Seu cadastro foi *APROVADO*!

Agora vamos agendar a instalação do rastreador no seu *{{veiculo}}*.

Em breve entraremos em contato para combinar o melhor dia e horário. 🚗✨',
ARRAY['nome', 'veiculo']),

-- COBRANÇA
('cobranca_lembrete', 'Lembrete de Vencimento', 'Lembrar 3 dias antes', 'cobranca',
'Olá {{nome}}! 👋

Seu boleto vence em *{{dias_para_vencer}} dias* ({{data_vencimento}}).

💰 *Valor:* R$ {{valor}}
🔗 *Link para pagamento:* {{link_boleto}}

Qualquer dúvida, estou à disposição!',
ARRAY['nome', 'dias_para_vencer', 'data_vencimento', 'valor', 'link_boleto']),

('cobranca_vencido', 'Boleto Vencido', 'Avisar sobre boleto vencido', 'cobranca',
'Olá {{nome}}!

Identificamos que seu boleto de *{{referencia}}* venceu em {{data_vencimento}}.

Para evitar a suspensão da proteção, regularize o pagamento:

🔗 {{link_boleto}}

Se já pagou, desconsidere esta mensagem. 🙏',
ARRAY['nome', 'referencia', 'data_vencimento', 'link_boleto']),

-- MONITORAMENTO
('instalacao_agendada', 'Instalação Agendada', 'Confirmar agendamento', 'monitoramento',
'Olá {{nome}}! ✅

Sua instalação de rastreador foi agendada:

📅 *Data:* {{data}}
⏰ *Horário:* {{horario}}
📍 *Local:* {{endereco}}
👤 *Instalador:* {{instalador}}

Por favor, esteja com o veículo disponível no horário marcado. 🚗',
ARRAY['nome', 'data', 'horario', 'endereco', 'instalador']),

('instalacao_concluida', 'Instalação Concluída', 'Confirmar conclusão', 'monitoramento',
'Olá {{nome}}! 🎉

A instalação do rastreador no seu *{{veiculo}}* foi *concluída com sucesso*!

📱 Acesse o app para rastrear seu veículo: {{link_app}}

Qualquer dúvida, estamos à disposição! 🚗✨',
ARRAY['nome', 'veiculo', 'link_app']),

-- EVENTOS
('sinistro_aberto', 'Sinistro Registrado', 'Confirmar abertura de sinistro', 'eventos',
'Olá {{nome}}!

Seu sinistro foi registrado com sucesso.

📋 *Protocolo:* {{protocolo}}
🚗 *Veículo:* {{veiculo}}
📅 *Data:* {{data}}

Nossa equipe está analisando o caso e entrará em contato em breve.

⚠️ Não se esqueça de registrar o B.O. se ainda não o fez.',
ARRAY['nome', 'protocolo', 'veiculo', 'data']),

-- ASSISTÊNCIA
('assistencia_despachada', 'Assistência a Caminho', 'Avisar sobre prestador', 'assistencia',
'Olá {{nome}}! 🚗

Seu chamado de assistência foi atendido!

🔧 *Tipo:* {{tipo_servico}}
👤 *Prestador:* {{prestador}}
📞 *Telefone:* {{telefone_prestador}}
⏱️ *Previsão:* {{previsao}}

O prestador está a caminho do local informado.',
ARRAY['nome', 'tipo_servico', 'prestador', 'telefone_prestador', 'previsao']),

-- GERAL
('boas_vindas', 'Boas-vindas', 'Primeiro contato após adesão', 'geral',
'🎉 *Bem-vindo(a) à PRATIC, {{nome}}!*

Agora você faz parte de uma associação que protege mais de 10.000 veículos!

📱 *Baixe nosso app:* {{link_app}}
📞 *Central 24h:* (XX) XXXX-XXXX

Qualquer dúvida, conte conosco! 🚗💙',
ARRAY['nome', 'link_app']);