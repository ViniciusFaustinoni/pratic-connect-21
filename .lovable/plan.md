
# Analista de Eventos nao ve sinistros gerados pela IA

## Problema

O sinistro gerado pela IA fica como solicitacao pendente na tabela `chat_solicitacoes_ia` (status `pendente`). Ele so aparece na tabela `sinistros` apos ser aprovado via a pagina `/diretoria/solicitacoes-ia`.

O Analista de Eventos:
- Ve o alerta "1 sinistro aguardando aprovacao via IA" na listagem
- Mas o botao "Revisar Solicitacoes" aponta para `/diretoria/solicitacoes-ia`
- Essa rota esta **bloqueada** pelo route guard (so permite `/dashboard`, `/eventos`, `/perfil`, `/notificacoes`)
- Resultado: o analista nao consegue acessar, aprovar, nem ver o sinistro

## Solucao

Permitir que o Analista de Eventos acesse a pagina de solicitacoes IA para aprovar/rejeitar sinistros.

### Mudanca 1 — Liberar rota no route guard

**Arquivo:** `src/hooks/useRouteGuard.ts`

Adicionar `/diretoria/solicitacoes-ia` na lista de `allowedPaths` do bloco `isAnalistaEventosOnly`:

```
const allowedPaths = [
  '/dashboard',
  '/eventos',
  '/perfil',
  '/notificacoes',
  '/diretoria/solicitacoes-ia',
];
```

### Mudanca 2 — Sidebar (se necessario)

Verificar se o item "Solicitacoes IA" aparece na sidebar para o analista de eventos. Se nao aparece, garantir que o link no alerta da SinistrosList ja funciona (ja aponta para `/diretoria/solicitacoes-ia`).

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useRouteGuard.ts` | Adicionar `/diretoria/solicitacoes-ia` ao array `allowedPaths` do `isAnalistaEventosOnly` |

## Resultado

- O Analista de Eventos clica em "Revisar Solicitacoes" no alerta amarelo
- Acessa a pagina de solicitacoes IA e pode aprovar/rejeitar sinistros pendentes
- Apos aprovacao, o sinistro aparece na listagem de sinistros com status "comunicado"
