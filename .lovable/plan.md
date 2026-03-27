

# Corrigir Contrato Autentique: Variáveis Não Substituídas + Assinatura

## Problemas Encontrados

### Problema 1: Variáveis não substituídas nos anexos
Os templates marcados como `anexar_proposta` (REGULAMENTO e Manual de Assistência 24h) são adicionados ao HTML **após** a substituição de variáveis. Resultado: variáveis como `{{empresa.nome}}`, `{{associado.cpf}}`, `{{plano.cota_participacao_valor}}` aparecem como texto bruto no documento final.

**Causa raiz** (linhas 530-557 de `autentique-create/index.ts`):
```ts
// Anexos inseridos SEM substituição de variáveis
anexosHTML += `...${tmpl.conteudo}...`;
```

### Problema 2: Assinatura duplicada + variável faltante
- O template AF1 tem sua própria área de assinatura no final (com `{{associado.nome}}` e `{{associado.cpf}}`), mas sem classes CSS que `hasSignatureArea` detecte. Resultado: o sistema injeta uma **segunda** assinatura via `generateSecaoAssinatura`.
- A variável `{{empresa.complemento}}` usada no template REGULAMENTO não existe no mapeamento.
- Bug no `generateSecaoAssinatura` (linha 803): usa `dados.empresa.razaoSocial` (camelCase) mas a interface define `razao_social` (snake_case) → mostra `undefined`.

## Correções

### 1. `supabase/functions/autentique-create/index.ts`
**Substituir variáveis nos templates anexados** (linhas 540-556):
- Chamar `substituirVariaveis(tmpl.conteudo, templateData)` em cada template anexo antes de inseri-lo no HTML
- Aplicar `limparVariaveisNaoSubstituidas()` no HTML final **depois** de anexar tudo (mover a linha 528 para depois do bloco de anexos)

### 2. `supabase/functions/_shared/template-utils.ts`

**A) Adicionar `empresa.complemento` ao mapeamento** (~linha 184):
```ts
'empresa.complemento': dados.empresa.complemento || '',
```

**B) Melhorar detecção de assinatura existente** em `hasSignatureArea` (~linha 753):
Adicionar padrão que detecte o formato do template AF1 — associado.nome + CPF em contexto de assinatura:
```ts
/Associado\(a\)\s*:\s*/i,
/{{associado\.nome}}.*{{associado\.cpf}}/s,
```
E também detectar texto já substituído com padrão nome + CPF centralizado.

**C) Corrigir `generateSecaoAssinatura`** (linha 803):
```ts
// De:
dados.empresa.razaoSocial
// Para:
dados.empresa.razao_social
```

### 3. `supabase/functions/_shared/termo-afiliacao-utils.ts`
**Adicionar campo `complemento` à interface `EmpresaData`** (~linha 119):
```ts
complemento?: string;
```
**Mapear `complemento` na função `mapearDadosParaTemplate`** (~linha 460):
```ts
complemento: empresa?.empresa_complemento || '',
```

### 4. `supabase/functions/autentique-create-by-token/index.ts`
Aplicar a mesma correção dos anexos (substituição de variáveis nos templates anexados), se existir bloco equivalente.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/autentique-create/index.ts` | Substituir variáveis nos templates anexados; mover limpeza final |
| `supabase/functions/autentique-create-by-token/index.ts` | Mesma correção de anexos |
| `supabase/functions/_shared/template-utils.ts` | Adicionar `empresa.complemento`, melhorar `hasSignatureArea`, corrigir `razaoSocial` |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Adicionar `complemento` à interface e ao mapeamento |

