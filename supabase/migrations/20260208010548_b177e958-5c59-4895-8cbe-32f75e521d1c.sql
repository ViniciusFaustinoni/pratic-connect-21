-- VM-01: Checklist de manutenção
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS checklist_manutencao jsonb DEFAULT NULL;

COMMENT ON COLUMN servicos.checklist_manutencao IS 
'Checklist tecnico preenchido pelo vistoriador durante manutencao';

-- VM-02: Fotos de manutenção
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS fotos_manutencao jsonb DEFAULT '[]';

COMMENT ON COLUMN servicos.fotos_manutencao IS 
'Fotos do reparo/substituicao [{url, categoria, uploaded_at}]';

-- VM-05: WhatsApp notification tracking
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS whatsapp_notificado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notificado_em timestamptz DEFAULT NULL;

COMMENT ON COLUMN servicos.whatsapp_notificado IS 'Se o associado foi notificado via WhatsApp';
COMMENT ON COLUMN servicos.whatsapp_notificado_em IS 'Timestamp da notificacao WhatsApp';

-- VM-06: Adicionar 'reservado' ao enum status_rastreador
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'reservado' AFTER 'estoque';