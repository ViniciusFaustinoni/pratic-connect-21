
## Objetivo
Corrigir o erro 500 ao excluir associado, causado por **contratos ainda existentes** que continuam referenciando `associados.id` via FK `fk_contratos_associado` (tabela `contratos.associado_id`). O motivo mais provável (e consistente com os logs e o schema) é que **a exclusão de contratos falha silenciosamente** por dependências que não estão sendo removidas antes — especialmente `comissoes_deducoes`, que tem FK para `contratos` **sem** `ON DELETE CASCADE`.

---

## O que eu encontrei (diagnóstico com base no schema e no código atual)
### 1) A constraint que está estourando
- `fk_contratos_associado`: `contratos(associado_id) -> associados(id)`

Ou seja: se existir **qualquer linha em `contratos`** com `associado_id = associadoId`, o delete do associado falha.

### 2) Por que ainda sobram contratos mesmo com o “force delete”
No `delete-associado/index.ts`, vocês chamam vários `.delete()`/`.update()` em sequência, mas **quase nenhuma chamada verifica `error`**.  
Então, quando uma exclusão falha, o fluxo segue como se tivesse dado certo.

Ponto crítico: existe FK `comissoes_deducoes_contrato_id_fkey`:
- `comissoes_deducoes(contrato_id) -> contratos(id)` **sem cascade**
- Isso impede `DELETE FROM contratos WHERE id = ...` se houver deduções vinculadas.

O schema confirma várias FKs para `contratos`, e as que tipicamente bloqueiam deleção (por não ter cascade) incluem:
- `comissoes_deducoes.contrato_id` (sem ON DELETE)
- `instalacoes.contrato_id` (sem ON DELETE) — esta já está sendo deletada no código
- `instalacoes_pendentes_criacao.contrato_id` (sem ON DELETE) — esta já está sendo deletada no código

Portanto, **falta limpar `comissoes_deducoes`** antes de excluir contratos.

---

## Mudanças planejadas (somente reorganização/correção, sem “reescrever do zero”)

### A) Corrigir a ordem e completar a limpeza de dependências antes de deletar `contratos`
No edge function `supabase/functions/delete-associado/index.ts`:

1. Para cada contrato:
   - Remover dependências que bloqueiam delete do contrato:
     - **Adicionar**: `DELETE FROM comissoes_deducoes WHERE contrato_id = :id`
     - (Opcional/segurança): deletar também `comissoes` (apesar de cascade existir, não atrapalha)
   - Manter as limpezas já existentes:
     - `instalacoes_pendentes_criacao`
     - `instalacoes`
     - `servicos`
     - `asaas_cobrancas`
     - `contratos_documentos`, `contratos_historico`, etc.
     - `vistorias` + `blacklist_veiculos` vinculada

2. Só então:
   - Desvincular `veiculos.contrato_id = null`
   - `DELETE FROM contratos WHERE id = :id`

### B) Parar de ignorar falhas: checar `error` e registrar logs úteis
Para cada operação crítica:
- Capturar `{ error }`
- Se error:
  - `console.error()` com:
    - tabela
    - contrato_id / associado_id
    - mensagem do Postgres
  - retornar erro **mais diagnosticável** (ex: HTTP 409/500 com “qual tabela bloqueou e quantos registros ainda existem”).

Isso evita o cenário atual em que o código “acha” que deletou, mas na prática não deletou.

### C) Verificação final antes do delete do associado (com saída detalhada)
Antes de executar:
```ts
await supabaseAdmin.from("associados").delete().eq("id", associadoId)
```
fazer:
1. `SELECT id FROM contratos WHERE associado_id = associadoId`
2. Se existir algum:
   - retornar `409 Conflict` com:
     - lista de `contrato.id` restantes (limitada, ex: 10)
     - contagem em tabelas bloqueadoras por contrato (principalmente `comissoes_deducoes`)
   - Isso ajuda a confirmar 100% a causa na próxima tentativa.

### D) Ajuste rápido de robustez (opcional, mas recomendado)
- Trocar CORS headers para o padrão completo recomendado (não resolve FK, mas evita problemas de front).
- Padronizar uma helper interna tipo `must()` para “falhar rápido” quando `error` acontecer (mantendo o arquivo simples).

---

## Passo a passo de validação (como vamos provar que resolveu)
1. Tentar excluir um associado que atualmente falha.
2. Conferir logs do edge function:
   - Deve aparecer limpeza de `comissoes_deducoes` por contrato.
   - Deve aparecer `Contratos restantes: 0` antes de deletar associado.
3. Confirmar no banco (test):
   - `select count(*) from contratos where associado_id = '...'` deve ser 0 após o fluxo.
4. Repetir com um associado que tenha histórico financeiro (maior chance de ter `comissoes_deducoes`).

---

## Se ainda falhar depois (plano de contingência)
Se, após adicionar `comissoes_deducoes` + checagem de erro, ainda sobrar contrato:
- A resposta 409 vai indicar quais contratos sobraram e, pelos logs, em qual tabela a deleção falhou.
- Aí adicionamos a limpeza específica que estiver faltando (mesma abordagem, sem “reescrever”, apenas completar a lista de dependências reais).

---

## Arquivos envolvidos
- `supabase/functions/delete-associado/index.ts` (ajustar ordem + deletar `comissoes_deducoes` + checar errors + verificação final)

---

## Observações importantes
- Não vou alterar constraints agora (ex: transformar `fk_contratos_associado` em cascade), porque isso muda regra de integridade no banco e pode ter efeitos colaterais. A correção mais segura é garantir que o edge function delete tudo na ordem correta.
- O erro mostrado é 100% compatível com “contrato não deletou por FK em tabela filha” + “código ignorou error” + “delete do associado estourou”.

