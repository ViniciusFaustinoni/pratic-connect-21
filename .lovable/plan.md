

# Trocar template Meta "Cobertura Total" → "Proteção 360"

## Situação atual
O template Meta `cobertura_total_ativada` tem o header fixo "Cobertura Total Ativada!" — esse texto é imutável porque é aprovado pela Meta. O fallback Evolution já diz "Proteção 360º" corretamente, mas via Meta API vai com o texto antigo.

## Passo 1 — Criar e registrar novo template Meta

Você precisa criar um novo template na Meta Business Manager (ou via painel de Templates Meta do sistema) com:
- **Nome**: `protecao_360_ativada` (ou similar)
- **Header**: `🛡️ Proteção 360 Ativada!`
- **Corpo**: Mesmo conteúdo do atual, trocando "COBERTURA TOTAL" por "PROTEÇÃO 360"
- **Variáveis**: mesmas 3 (nome, placa, marca/modelo)
- **Categoria**: UTILITY

Após aprovação pela Meta, registrar na tabela `whatsapp_meta_templates`.

## Passo 2 — Atualizar código (após aprovação)

### Arquivo: `supabase/functions/notificar-cliente/index.ts`
- Linha 365: trocar `template_name: 'cobertura_total_ativada'` por `template_name: 'protecao_360_ativada'`

### Deploy
- Deploy da edge function `notificar-cliente`

## Passo 3 — Desativar template antigo
Após confirmar que o novo template funciona, desativar `cobertura_total_ativada` na Meta e na tabela `whatsapp_meta_templates`.

## Nota importante
O template `cadastro_aprovado_botao` (usado em outros fluxos) já recebe "Proteção 360º" como variável dinâmica — não precisa de alteração, pois o texto vem do código e não é fixo no template.

## Resumo da alteração no código
- 1 linha alterada em 1 arquivo
- Depende da aprovação do novo template pela Meta antes de implementar

