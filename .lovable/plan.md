

# Fix: Remover assinatura duplicada no Termo de Afiliacao

## Problema

O documento enviado ao Autentique tem **dois blocos de assinatura**:

1. O template do banco de dados (editado no TipTap) ja inclui um bloco de assinatura no final do conteudo
2. O codigo em `autentique-create/index.ts` (linha 57) adiciona `generateSecaoAssinatura(dados)` apos o conteudo

Resultado: duas areas de assinatura no PDF.

## Solucao

No `autentique-create/index.ts`, verificar se o conteudo HTML ja contem blocos de assinatura antes de adicionar o `generateSecaoAssinatura`. Se o template ja tiver assinatura, nao adicionar a segunda.

**Arquivo:** `supabase/functions/autentique-create/index.ts`

Alterar a montagem do HTML (linha 54-58) para:

```typescript
// Detectar se o template já tem assinatura
const templateTemAssinatura = conteudoHTML.includes('signature-block') || 
                               conteudoHTML.includes('signature-line') ||
                               conteudoHTML.includes('ASSINATURA');

const secaoAssinatura = templateTemAssinatura ? '' : generateSecaoAssinatura(dados);

// Montar HTML
return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>...</head>
<body>
  <div class="page">
    ${generateHeader(dados)}
    ${conteudoHTML}
    ${aditivosHTML}
    ${secaoAssinatura}
    ${generateFooter(dados)}
  </div>
</body>
</html>`;
```

Apos a alteracao, fazer deploy da edge function `autentique-create`.

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/autentique-create/index.ts` | Condicionar `generateSecaoAssinatura` a ausencia de assinatura no template |

