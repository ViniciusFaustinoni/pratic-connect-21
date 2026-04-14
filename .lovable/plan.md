

## Plano: Gerar descrição com IA para linhas de produto

### O que muda
Adicionar um botao "Gerar com IA" ao lado do campo de descricao de cada linha na aba "Linhas de Produto". Ao clicar, o sistema busca todo o contexto da linha (planos, coberturas, beneficios, regras de elegibilidade), envia para uma edge function que chama o modelo de IA, e retorna um texto focado em conversao que e preenchido no campo e salvo.

### Implementacao

**1. Nova edge function `gerar-descricao-linha` (Deno)**

- Recebe `product_line_id`
- Busca no banco:
  - `product_lines` (nome, slug, vehicle_type)
  - `planos` vinculados a essa linha (nome, descricao, valor_adesao, cobertura_fipe, etc.)
  - `planos_coberturas` + `coberturas` (nome, valor de cada cobertura)
  - `planos_beneficios` + `benefits` (nome, preco_sugerido)
  - `entity_eligibility_rules` da linha (faixas de ano, marcas aceitas, etc.)
- Monta prompt pedindo texto curto, persuasivo, focado em conversao, para o agente WhatsApp usar ao apresentar a linha
- Chama Gemini via AI Gateway (`google/gemini-3-flash-preview`)
- Retorna o texto gerado

**2. Atualizar `AbaLinhas` em `AgenteConsultorIA.tsx`**

- Adicionar botao com icone de IA (Sparkles ou RefreshCw) ao lado do textarea de descricao
- Ao clicar: chama a edge function, exibe loading, preenche o textarea com o resultado
- Apos preencher, salva automaticamente via `updateLinha` (campo `agente_descricao`)
- Estado de loading por linha (para nao bloquear todas)

### Arquivos
- `supabase/functions/gerar-descricao-linha/index.ts` (novo)
- `src/pages/configuracoes/AgenteConsultorIA.tsx` (botao + chamada)

