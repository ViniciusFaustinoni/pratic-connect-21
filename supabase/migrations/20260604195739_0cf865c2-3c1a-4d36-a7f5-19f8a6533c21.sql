
-- Reset estado de atendimento APENAS para telefone 5521982244909 / 21982244909 (Marcos, CPF 14194896742)
DELETE FROM public.whatsapp_mensagens WHERE telefone IN ('5521982244909','21982244909');
DELETE FROM public.agente_ia_locks   WHERE telefone IN ('5521982244909','21982244909');
DELETE FROM public.whatsapp_ia_pausas WHERE telefone IN ('5521982244909','21982244909');
-- agente_ia_contatos já não tinha registro para este telefone/CPF; nada a apagar lá.
