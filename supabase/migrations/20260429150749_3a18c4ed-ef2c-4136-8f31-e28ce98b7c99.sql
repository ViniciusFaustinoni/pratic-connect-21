-- 1) Consolidar chave duplicada: migrar valor de operacional_prazo_instalacao se for diferente, depois remover
UPDATE public.configuracoes c1
   SET valor = c2.valor
  FROM public.configuracoes c2
 WHERE c1.chave = 'prazo_instalacao_autovistoria_horas'
   AND c2.chave = 'operacional_prazo_instalacao'
   AND c1.valor = '72'
   AND c2.valor <> '72';

DELETE FROM public.configuracoes WHERE chave = 'operacional_prazo_instalacao';

-- 2) Atualizar descrição da chave canônica (default)
UPDATE public.configuracoes
   SET descricao = 'Prazo padrão (horas) entre a assinatura do contrato e a instalação do rastreador, para UFs sem prazo regional configurado. Vencido o prazo sem instalação, a cobertura do veículo é suspensa automaticamente.'
 WHERE chave = 'prazo_instalacao_autovistoria_horas';

-- 3) Adicionar prazos regionais (RJ 48h, SP 72h)
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES
  ('prazo_instalacao_horas_rj', '48', 'numero', 'operacional',
   'Prazo (horas) para instalação do rastreador após assinatura, para associados com UF = RJ.', true),
  ('prazo_instalacao_horas_sp', '72', 'numero', 'operacional',
   'Prazo (horas) para instalação do rastreador após assinatura, para associados com UF = SP.', true)
ON CONFLICT (chave) DO NOTHING;