
UPDATE public.ia_habilidades
SET ativa = false,
    atualizado_em = now()
WHERE slug = 'vendas';

UPDATE public.ia_habilidades
SET nome_exibicao = 'Atendimento Pratic',
    nome_agente = 'Atendimento Pratic',
    audiencias_elegiveis = ARRAY['lead','associado','diretor'],
    horario_atendimento = NULL,
    mensagem_fora_horario = NULL,
    persona = regexp_replace(persona, 'Maya', 'Atendimento Pratic', 'gi'),
    regras_absolutas = regexp_replace(regras_absolutas, 'Maya', 'Atendimento Pratic', 'gi'),
    saudacao_inicial = regexp_replace(saudacao_inicial, 'Maya', 'Atendimento Pratic', 'gi'),
    tom_voz = regexp_replace(tom_voz, 'Maya', 'Atendimento Pratic', 'gi'),
    descricao = 'IA \u00fanica de atendimento (FAQ + suporte) para leads e associados',
    ativa = true,
    atualizado_em = now()
WHERE slug = 'relacionamento';
