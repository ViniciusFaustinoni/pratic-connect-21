

# Fix: Remover "Serviços: {{plano.descricao}}" do contrato PDF

## Problema
O bloco "Serviços: {{plano.descricao}}" continua aparecendo no contrato enviado ao Autentique. As regexes de limpeza existentes falham quando:
- O `ç` está como HTML entity (`&ccedil;`)
- O texto está dentro de tags inline (`<strong>`, `<span>`, `<em>`)
- O TipTap gera chips de variável com `<span data-variable>`

## Solução
Reforçar as regexes de limpeza em **3 arquivos** e remover `plano.descricao` do mapeamento de variáveis (já que é redundante com `plano.coberturas`):

### 1. `supabase/functions/_shared/template-utils.ts`
- **Remover** a linha `'plano.descricao'` do mapeamento (linha 96) — sem essa variável no mapa, ela será substituída por `—` pela limpeza residual, facilitando a remoção do bloco
- **Reforçar** regex de limpeza (linhas 153-163): adicionar variantes com `&ccedil;` e padrão que ignore tags inline aninhadas

### 2. `supabase/functions/autentique-create/index.ts`
- Após `substituirVariaveis` e antes de montar o HTML final, adicionar uma limpeza extra específica para o bloco "Serviços:" no `gerarHTMLDoTemplate` (linha 69-71)

### 3. `src/hooks/useGerarDocumento.ts`
- **Reforçar** regex de limpeza (linhas 146-154): mesmas variantes com `&ccedil;` e tags inline

### Regexes reforçadas
```typescript
// 1. Container com qualquer conteúdo inline (strong, span, em) ao redor de "Serviços:"
resultado = resultado.replace(
  /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi[çc]os\s*:[\s\S]*?<\/\1>/gi,
  ''
);
// 2. Com HTML entity &ccedil;
resultado = resultado.replace(
  /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi&ccedil;os\s*:[\s\S]*?<\/\1>/gi,
  ''
);
// 3. Inline residual (ambas formas)
resultado = resultado.replace(
  /Servi([çc]|&ccedil;)os\s*:\s*[^\n<]*/gi,
  ''
);
// 4. Variable chip residual com data-variable contendo plano.descricao
resultado = resultado.replace(
  /<span[^>]*data-variable="[^"]*plano\.descricao[^"]*"[^>]*>[^<]*<\/span>/gi,
  ''
);
```

### Edge function requer redeploy
A função `autentique-create` e `_shared/template-utils.ts` precisam ser redeployadas após a alteração.

## Arquivos a modificar
1. `supabase/functions/_shared/template-utils.ts` — remover `plano.descricao` do mapeamento + reforçar regexes
2. `supabase/functions/autentique-create/index.ts` — limpeza adicional no `gerarHTMLDoTemplate`
3. `src/hooks/useGerarDocumento.ts` — reforçar regexes no frontend

