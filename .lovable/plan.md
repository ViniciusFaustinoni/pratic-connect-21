

# Fix: Botão CTA do Template `assinatura_instalacao_v1` sem URL base

## Problema

O botão de ação do template está com URL = `{{3}}` (só a variável). A Meta exige que botões do tipo URL tenham um **domínio base fixo** com apenas um sufixo dinâmico opcional. Uma URL composta apenas por variável será rejeitada.

Além disso, o corpo tem variáveis `{{1}}` (nome) e `{{2}}` (veículo), e o link está como `{{3}}` no corpo — mas na Meta, **variáveis de botão são numeradas separadamente** das variáveis do corpo. O botão usa `{{1}}` (sua própria primeira variável).

## Correção

### 1. Migration SQL — Corrigir template no banco

```sql
UPDATE whatsapp_meta_templates
SET 
  botoes = '[{"type": "URL", "text": "Assinar agora", "url": "https://app.praticprotecao.com.br/acompanhar/{{1}}"}]'::jsonb,
  variaveis_exemplo = '{"1": "João", "2": "HB20 - ABC1234"}'::jsonb
WHERE nome = 'assinatura_instalacao_v1';
```

- URL do botão: `https://app.praticprotecao.com.br/acompanhar/{{1}}` — domínio fixo + token dinâmico
- Remove a variável `"3"` do `variaveis_exemplo` pois o link agora é do botão (variável separada)

### 2. `src/hooks/useServicos.ts` — Ajustar variáveis de envio

Atualmente envia:
```ts
template_variaveis: [nomeAssociado, veiculoDesc, linkPublico]
```

Deve separar variáveis do corpo e do botão. O corpo tem 2 variáveis (`{{1}}`, `{{2}}`), o botão tem 1 (`{{1}}` do botão = o token do link). Ajustar para enviar apenas o **token** para o botão (não a URL completa), já que a URL base é fixa no template.

Extrair o token do `linkPublico` e enviar de forma adequada conforme a edge function `whatsapp-send-text` espera.

| Arquivo | Ação |
|---|---|
| Nova migration SQL | UPDATE botões com URL base fixa + remover variável 3 dos exemplos |
| `src/hooks/useServicos.ts` | Ajustar array de variáveis: corpo `[nome, veiculo]` + botão `[token]` separado |

