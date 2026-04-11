

## Plano: Reescrever sanitizeSignatureBlocks para cobrir todos os padrões

### Padrões encontrados nos templates reais

Analisei os 7 templates e 4 aditivos ativos. Encontrei 6 padrões distintos de assinatura que a função atual **não** remove:

| Padrão | Onde aparece | Exemplo |
|--------|-------------|---------|
| Linhas de underscores `___` | Regulamento, TEV01, V_QR0, Aditivos | `____________` |
| Texto "ASSINATURA DO ASSOCIADO" | Regulamento | `<p><strong>ASSINATURA DO ASSOCIADO</strong></p>` |
| Bordas decorativas `━━━` | TEV01, Aditivos 0Km/Blindado/Microperfurado | `━━━━━━━━━━━━━━━` |
| Blocos "Local: ___  Data:" | Regulamento | `Local: ___... Data: {{sistema.data_atual}}` |
| Sintaxe legada `!{Associado}` / `!{Associacao}` | Aditivo Leilão | `!{Associado}` em tabela |
| Nome+CPF solto no final | AF1, Rastreador, todos | `{{associado.nome}} - CPF: {{associado.cpf}}` como últimos parágrafos |

A função atual só remove 3 classes CSS (`signature-block`, `signature-line`, `signature-labels`) que **nenhum** template real usa.

### Implementação

**Arquivo**: `supabase/functions/_shared/template-utils.ts` — função `sanitizeSignatureBlocks` (linhas 781-791)

A nova função será uma sequência de regexes ordenadas do mais específico ao mais genérico:

```typescript
export function sanitizeSignatureBlocks(html: string): string {
  if (!html) return html;
  let result = html;

  // 1. Blocos com classes CSS (existente)
  result = result.replace(/<div[^>]*class\s*=\s*["'][^"']*signature-(?:block|area|labels)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  result = result.replace(/<p[^>]*class\s*=\s*["'][^"']*signature-line[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, '');

  // 2. Bordas decorativas ━━━ (linhas inteiras de ━)
  result = result.replace(/<p[^>]*>\s*[━]{5,}\s*<\/p>/gi, '');

  // 3. Bordas decorativas ──── (linhas inteiras de ─)
  result = result.replace(/<p[^>]*>\s*[─]{5,}\s*<\/p>/gi, '');

  // 4. Parágrafos com linhas de underscores (3+ underscores seguidos)
  //    que apareçam em contexto de assinatura (perto de nome/CPF/ASSOCIADO)
  //    Remove: <p>_______________</p> e <p>Local: ___ Data: ...</p>
  result = result.replace(/<p[^>]*>[^<]*_{3,}[^<]*<\/p>/gi, '');

  // 5. Texto "ASSINATURA DO ASSOCIADO" / "Assinatura do Associado / Terceiro"
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*(?:ASSINATURA|Assinatura)\s+(?:DO|do|da)\s+(?:ASSOCIADO|Associado)[^<]*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 6. Texto "ASSOCIADO" sozinho (label de bloco de assinatura)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*ASSOCIADO\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 7. Texto "ASSOCIAÇÃO" sozinho (label de bloco de assinatura)
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*ASSOCIAÇÃO\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 8. Texto "AUTORIZAÇÃO" sozinho (TEV01)
  result = result.replace(/<p[^>]*>\s*AUTORIZAÇÃO\s*<\/p>/gi, '');

  // 9. Sintaxe legada !{Associado}, !{Associacao}, ${local}, #{data_de_emissao}
  result = result.replace(/<p[^>]*>[^<]*!\{(?:Associado|Associacao)\}[^<]*<\/p>/gi, '');
  result = result.replace(/<p[^>]*>[^<]*\$\{local\}[^<]*#\{data_de_emissao\}[^<]*<\/p>/gi, '');

  // 10. Tabela de assinatura legada (Leilão) — tabela com !{Associado}
  result = result.replace(/<table[^>]*>[\s\S]*?!\{(?:Associado|Associacao)\}[\s\S]*?<\/table>/gi, '');

  // 11. Parágrafos finais com só nome+CPF do associado (últimos blocos)
  //     Match: <p>{{associado.nome}} - CPF: {{associado.cpf}}</p>
  //     ou variantes com <strong>, — etc.
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*\{\{associado\.nome\}\}[\s\S]{0,30}(?:CPF|cpf)[:\s]*\{\{associado\.cpf\}\}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 12. Parágrafos com dados da empresa em contexto de assinatura
  result = result.replace(/<p[^>]*>\s*(?:<strong>)?\s*\{\{empresa\.nome\}\}[\s\S]{0,30}(?:CNPJ|cnpj)[:\s]*\{\{empresa\.cnpj\}\}\s*(?:<\/strong>)?\s*<\/p>/gi, '');

  // 13. Parágrafo "Dados da Agencia" (Leilão)
  result = result.replace(/<p[^>]*>\s*Dados da Agencia\s*<\/p>/gi, '');

  // 14. Limpar <p><br></p> e <p></p> consecutivos que sobraram
  result = result.replace(/(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){3,}/gi, '<p><br></p>');

  return result;
}
```

### O que NÃO será tocado
- `hasSignatureArea` — permanece igual
- `generateAssinaturaAnexo` / `generateSecaoAssinatura` — sem alterações
- Nenhum outro arquivo — apenas a função `sanitizeSignatureBlocks` em `template-utils.ts`
- A lógica de injeção de assinaturas nos callers (`autentique-create`, `autentique-create-by-token`) não muda

### Resultado esperado
Após a sanitização, o HTML sai completamente limpo de qualquer bloco de assinatura original, permitindo que `generateAssinaturaAnexo` ou `generateSecaoAssinatura` injete um bloco padronizado único e correto.

