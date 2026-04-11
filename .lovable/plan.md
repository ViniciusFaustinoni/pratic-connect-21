

## Plano: Correção definitiva dos templates e deploy das funções

### Causa raiz

As correções feitas nas mensagens anteriores (sanitização reforçada, estimativa de páginas com 2000 chars/página + margem de +2, remoção do bloco ASSINATURA do rastreador) **não foram deployadas**. Os edge functions logs estão vazios, confirmando que `autentique-create` e `autentique-create-by-token` rodam ainda com o código antigo. O documento assinado que você enviou foi gerado com o código antigo.

Além disso, **3 templates no banco de dados** ainda contêm blocos manuais de assinatura que precisam ser removidos diretamente no banco (a sanitização por regex é um fallback, mas o ideal é limpar na fonte):

1. **Proposta de Filiação** (`eb09759f`): termina com `{{associado.cidade}}, {{sistema.data_extenso}}.` + `{{associado.nome}} - CPF: {{associado.cpf}}`
2. **REGULAMENTO** (`34e1e572`): termina com linha de underscores + `ASSINATURA DO ASSOCIADO` + `{{associado.nome}} — CPF: {{associado.cpf}}`
3. **TERMO DE RESPONSABILIDADE DO RASTREADOR** (`a644ab91`): termina com `{{empresa.cidade}} - {{empresa.uf}}, {{sistema.data_extenso}}.` + `{{associado.nome}}` + `CPF: {{associado.cpf}}`

E há um valor obsoleto no banco: `configuracoes.assinatura_total_paginas = 20` que, embora já seja sobrescrito pelo código, deve ser removido para evitar confusão.

### Alterações

**1. Migration SQL — limpar blocos de assinatura dos 3 templates no banco**

Usar `regexp_replace` para remover os blocos finais de assinatura (local/data, underscores, nome/CPF) dos 3 templates identificados. Também deletar `assinatura_total_paginas` da tabela `configuracoes` (já é calculado dinamicamente).

**2. Deploy dos edge functions**

Forçar o deploy de `autentique-create`, `autentique-create-by-token` e `_shared` para que as correções já implementadas (sanitização reforçada, estimativa de páginas, remoção do bloco ASSINATURA do rastreador) entrem em produção.

**3. Nenhuma alteração de código necessária**

As correções de código já foram feitas nas mensagens anteriores:
- `sanitizeSignatureBlocks` já tem 23 regras que cobrem todos os padrões
- `estimarPaginasHTML` já usa 2000 chars/página + margem de +2
- `generateSecaoRastreador` já não gera bloco de assinatura
- Os edge functions já chamam `sanitizeSignatureBlocks` antes de `estimarPaginasHTML`

### Resultado esperado
- Templates limpos na fonte (sem blocos manuais de assinatura)
- Funções deployadas com sanitização reforçada como fallback de segurança
- SIGNATURE posicionada corretamente na última página real
- Nenhum bloco manual de "Nome - CPF" ou "Local, data" no documento final

