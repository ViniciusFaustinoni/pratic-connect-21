

## Plano: Remover blocos de assinatura dos templates e usar rubricas + assinatura padrão Autentique

### Contexto

O Autentique já gera uma **página separada de assinaturas** automaticamente. O que precisamos é apenas:
- **INITIALS (rubrica)** em todas as páginas exceto a última
- **SIGNATURE (assinatura)** apenas na última página

Hoje o sistema injeta blocos visuais de assinatura (local/data/linha/nome/CPF) no HTML, o que é redundante e causa sobreposição com a página de assinaturas do Autentique.

### Alterações

**1. `supabase/functions/_shared/autentique-positions.ts`** — Corrigir `gerarPosicoesAssinatura`

Hoje só gera SIGNATURE em todas as páginas. Corrigir para:
- Páginas 1 a (N-1): `element: "INITIALS"` (rubrica)
- Página N (última): `element: "SIGNATURE"` (assinatura completa)

```typescript
export function gerarPosicoesAssinatura(config: PosicoesConfig = {}) {
  const {
    rubricaX = "78.0",
    rubricaY = "95.0",
    assinaturaX = "65.0",
    assinaturaY = "85.0",
    totalPaginas = 20,
  } = config;

  const positions = [];

  // INITIALS em todas as páginas exceto a última
  for (let p = 1; p < totalPaginas; p++) {
    positions.push({ x: rubricaX, y: rubricaY, z: String(p), element: "INITIALS" });
  }

  // SIGNATURE apenas na última página
  positions.push({ x: assinaturaX, y: assinaturaY, z: String(totalPaginas), element: "SIGNATURE" });

  return positions;
}
```

**2. `supabase/functions/autentique-create/index.ts`** — Remover injeção de blocos visuais de assinatura

- Remover chamada a `generateSecaoAssinatura` (linha ~133) e a variável `assinaturaHTML`
- Remover chamada a `generateAssinaturaAnexo` nos anexos (linha ~685)
- Manter `sanitizeSignatureBlocks` para limpar templates do banco

**3. `supabase/functions/autentique-create-by-token/index.ts`** — Mesmas remoções

- Remover `generateSecaoAssinatura` (linha ~482) e `generateAssinaturaAnexo` (linha ~543)

**4. `supabase/functions/_shared/template-utils.ts`** — Limpar funções obsoletas

- Remover (ou marcar como deprecated) `generateAssinaturaAnexo` e `generateSecaoAssinatura` — já não serão chamadas
- Manter `sanitizeSignatureBlocks` ativo para continuar limpando templates do banco que tenham blocos manuais

### Resultado

- Templates ficam limpos: sem nenhum bloco visual de assinatura no HTML final
- Autentique posiciona rubrica em todas as páginas e assinatura na última
- A página de assinaturas do Autentique aparece normalmente no final do documento
- Comportamento padronizado para todos os tipos de termo

### Arquivos
- `supabase/functions/_shared/autentique-positions.ts`
- `supabase/functions/_shared/template-utils.ts`
- `supabase/functions/autentique-create/index.ts`
- `supabase/functions/autentique-create-by-token/index.ts`
- Deploy das edge functions afetadas

