
# Adicionar Regra "Evento Vidros e Farois" aos Aditivos

## Problema
O aditivo de Vidros e Farois existe no banco, mas nao e anexado automaticamente ao Termo de Entrada de Evento porque:
1. Nao existe um tipo de regra para avaliar se o sinistro e do tipo "vidros"
2. A Edge Function `autentique-evento-create` nao chama `buscarEGerarAditivos`

## Solucao

### 1. Novo tipo de regra: `evento_vidros`

**Arquivo:** `src/hooks/useAditivos.ts`
- Adicionar `'evento_vidros'` ao union type de `RegraAditivo.tipo`

**Arquivo:** `src/pages/documentos/AditivoForm.tsx`
- Adicionar nova entrada no array `TIPOS_REGRA` com label "Evento Vidros e Farois", descricao "Anexado quando o evento/sinistro contiver vidros e farois", e icone adequado (ex: `Shield` ou outro)
- Adicionar `evento_vidros: false` ao estado inicial de regras

**Arquivo:** `src/hooks/useAvaliarAditivos.ts`
- Adicionar case `evento_vidros` no switch (retorna false no frontend pois a avaliacao real e feita no backend)

### 2. Backend: avaliar regra no Edge Function

**Arquivo:** `supabase/functions/_shared/template-utils.ts`
- Adicionar case `evento_vidros` na funcao `avaliarRegraEdge`
- Atualizar assinatura de `buscarEGerarAditivos` para aceitar parametro opcional `contexto` com `tipo_evento`
- No case `evento_vidros`: verificar se `contexto?.tipo_evento === 'vidros'`

### 3. Injetar aditivos no Termo de Evento

**Arquivo:** `supabase/functions/autentique-evento-create/index.ts`
- Importar `buscarEGerarAditivos` de `template-utils.ts`
- Apos gerar o `htmlContent`, chamar `buscarEGerarAditivos` passando dados do veiculo e contexto `{ tipo_evento: sinistro.tipo }`
- Injetar o HTML dos aditivos antes do `</body>` no documento

### 4. Atualizar regras do aditivo no banco

- Executar SQL para definir a regra `evento_vidros` no aditivo "ADITIVO DE VIDROS E FAROIS" (ID: `74d170ba-4a2a-4b1a-aedc-175370ddb4ed`)

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useAditivos.ts` | Adicionar `evento_vidros` ao tipo |
| `src/pages/documentos/AditivoForm.tsx` | Nova opcao na UI de regras |
| `src/hooks/useAvaliarAditivos.ts` | Case `evento_vidros` no switch |
| `supabase/functions/_shared/template-utils.ts` | Regra + parametro contexto |
| `supabase/functions/autentique-evento-create/index.ts` | Chamar `buscarEGerarAditivos` |
| SQL (dados) | Atualizar regras do aditivo no banco |
