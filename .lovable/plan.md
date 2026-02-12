

# Correcao de Variaveis no Termo de Filiacao (Autentique)

## Problema Identificado

Ao analisar o PDF assinado do Termo de Filiacao (CTR-20260212181635-YMYO0F), foi identificado que:

1. Na pagina 1, o texto `{{plano.descricao}}` aparece como variavel bruta (nao substituida), exibido ACIMA do cabecalho da empresa
2. Na pagina 3, a MESMA variavel esta corretamente substituida com as coberturas do plano
3. O CNPJ da empresa aparece como `00.000.000/0001-00` (dado placeholder na tabela `configuracoes`)

A variavel `plano.descricao` esta mapeada corretamente em `template-utils.ts` (linha 82) e a substituicao funciona (pagina 3 confirma). O problema na pagina 1 e causado pela renderizacao do Autentique: o conversor HTML-para-PDF do Autentique gera uma pagina de capa/resumo que extrai texto do HTML e exibe ANTES do conteudo renderizado. Esse texto extraido nao passa pela nossa substituicao de variaveis.

## Solucao

Duas acoes combinadas para resolver:

### 1. Remover variaveis residuais do HTML final

Adicionar uma funcao `limparVariaveisNaoSubstituidas` que, APOS a substituicao de variaveis, remove qualquer `{{variavel}}` que nao foi mapeada, substituindo por texto vazio ou traco. Isso garante que mesmo que o Autentique extraia texto bruto, nao havera variaveis visiveis.

### 2. Melhorar o mapeamento para cobrir edge cases

Garantir que o mapeamento trate todos os campos que possam vir nulos ou vazios de forma mais robusta, especialmente:
- `plano.descricao` deve ter fallback mais robusto
- Adicionar log de debug para variáveis nao substituidas

### 3. CSS para evitar overflow na pagina 1

Adicionar regras CSS que previnem content overflow na primeira pagina do PDF:
- `page-break-before: always` no conteudo do template
- Overflow hidden no container principal

---

## Detalhes Tecnicos

### Arquivo: `supabase/functions/_shared/template-utils.ts`

**Adicionar funcao de limpeza pos-substituicao (apos linha 122):**

```typescript
export function limparVariaveisNaoSubstituidas(html: string): string {
  // Remove qualquer {{variavel}} que nao foi substituida
  return html.replace(/\{\{[^}]+\}\}/g, '—');
}
```

**Atualizar `substituirVariaveis` para incluir limpeza automatica:**

A funcao `substituirVariaveis` passara a chamar `limparVariaveisNaoSubstituidas` no final, garantindo que NENHUMA variavel bruta apareca no HTML enviado ao Autentique.

### Arquivo: `supabase/functions/autentique-create-by-token/index.ts`

Adicionar chamada de limpeza apos gerar o HTML:

```typescript
// Apos gerar conteudoHTML
contratoHTML = limparVariaveisNaoSubstituidas(contratoHTML);
```

Adicionar log de debug para identificar variaveis nao substituidas:

```typescript
const variaveisRestantes = contratoHTML.match(/\{\{[^}]+\}\}/g);
if (variaveisRestantes) {
  console.warn('[autentique-create-by-token] Variaveis nao substituidas:', variaveisRestantes);
}
```

### CSS: Prevenir overflow na pagina de capa

Adicionar ao `generateStyles()`:

```css
.page {
  overflow: hidden;
}

.section:first-child {
  page-break-before: avoid;
}
```

---

## Nota sobre o CNPJ

O CNPJ `00.000.000/0001-00` e um dado placeholder na tabela `configuracoes` (chave `empresa_cnpj`). Isso nao e um bug de codigo — o valor precisa ser atualizado pelo administrador no banco de dados com o CNPJ real da empresa. O mesmo vale para `empresa_telefone` que esta como `(00) 0000-0000`.

---

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/_shared/template-utils.ts` | Adicionar `limparVariaveisNaoSubstituidas` + limpeza automatica |
| `supabase/functions/autentique-create-by-token/index.ts` | Chamar limpeza + log de debug |
| `supabase/functions/autentique-create/index.ts` | Mesma limpeza (se existir) |

## Impacto

- Nenhuma variavel `{{...}}` aparecera como texto bruto nos PDFs
- Log de variaveis nao mapeadas facilita debug futuro
- Correcao preventiva para todos os termos (filiacao, cancelamento, saida de veiculo)

