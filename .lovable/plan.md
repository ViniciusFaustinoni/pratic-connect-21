

## Correção do fluxo de reenvio de templates Meta

### Problema atual

1. **Não exclui antes de recriar**: O fluxo de retry após erro "already exists" tenta deletar, mas depois apenas fica esperando sem estratégia de fallback.
2. **Não versiona o nome**: Quando a Meta impõe o cooldown de 4 semanas após exclusão, o sistema falha sem alternativa.

### Solução

**`supabase/functions/whatsapp-meta-templates/index.ts`** — Reestruturar o bloco de retry (linhas ~250-333):

1. **Sempre deletar primeiro**: Independente do tipo de erro ("already exists" ou "being deleted"), executar DELETE antes de tentar recriar.
2. **Fallback com versionamento de nome**: Se após 2 tentativas com o nome original ainda falhar, gerar um nome versionado (`nome_v2`, `nome_v3`, etc.) e tentar criar com o novo nome. Atualizar o campo `nome` no banco local para manter a correspondência.

Fluxo revisado:
```text
POST falha →
  1. DELETE template pelo nome original
  2. Aguardar 10s → POST com nome original
  3. Se falhar → Aguardar 15s → POST com nome original
  4. Se falhar → Gerar nome_v2 (ou _v3, _v4...) → POST com nome versionado
  5. Se sucesso → Atualizar nome no banco local
  6. Se falhar → Marcar REJECTED com mensagem clara
```

**Detecção de versão existente**: Verificar se o nome já termina com `_v\d+` para incrementar corretamente (ex: `_v2` → `_v3`).

**Atualização do banco**: Quando o nome versionado for usado com sucesso, atualizar o campo `nome` do template no banco para refletir o novo nome na Meta.

