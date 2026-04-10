

## Plano: Ações de status para rastreadores em manutenção (retorno_base / em_garantia)

### Contexto
Rastreadores avariados ficam com status `retorno_base` e `portador_id` do técnico. O coordenador precisa poder:
1. **Retorno base** → "Disponível" (`estoque`) ou "Enviado para Fornecedor" (`em_garantia`)
2. **Em garantia** → "Disponível" (`estoque`)

Atualmente a UI não oferece ações para esses status — só mostra portador para `estoque`.

### Mudanças

**1. `src/components/rastreadores/RastreadorCard.tsx`**
- Mostrar portador também para status `retorno_base` e `em_garantia` (não só `estoque`)
- Adicionar botões de ação rápida:
  - Status `retorno_base`: botão "Disponível" (→ estoque) e "Enviar Fornecedor" (→ em_garantia)
  - Status `em_garantia`: botão "Disponível" (→ estoque)

**2. `src/components/rastreadores/RastreadorTableView.tsx`**
- No dropdown de ações, adicionar as mesmas opções para rastreadores com status `retorno_base` e `em_garantia`
- Mostrar portador na coluna associado/portador para esses status

**3. `src/components/rastreadores/RastreadorGridView.tsx`**
- Passar novo callback `onChangeStatus` para os cards

**4. `src/hooks/useRastreadores.ts`** (ou novo hook)
- Criar mutation `useAlterarStatusRastreador` que:
  - Atualiza `status` do rastreador
  - Limpa `portador_id` quando volta para `estoque`
  - Registra movimentação em `estoque_movimentacoes`

**5. Página principal de rastreadores** (onde monta grid/table)
- Conectar o novo callback de mudança de status

### Resultado
O coordenador verá botões claros nos cards e menus de rastreadores em manutenção para movê-los entre "Disponível" e "Enviado para Fornecedor", com registro automático de movimentação.

