

# Corrigir Exclusao em Cascata de Sinistros e Chamados

## Problema Identificado

A Edge Function `delete-sinistro` nao limpa todas as tabelas dependentes antes de excluir o sinistro. Varias tabelas possuem FK com `NO ACTION` (sem cascata), o que causa **falha na exclusao** quando existem registros vinculados. As tabelas problematicas sao:

| Tabela | FK Delete Rule | Situacao |
|---|---|---|
| `sinistro_vidros_historico` | NO ACTION | **Bloqueia exclusao** - historico de vidros permanece |
| `consultas_juridicas` | NO ACTION | **Bloqueia exclusao** |
| `evento_cotacoes_pecas` | NO ACTION | **Bloqueia exclusao** |
| `sinistro_prestadores` | NO ACTION | **Bloqueia exclusao** |
| `vistorias` | NO ACTION | **Bloqueia exclusao** |
| `processos_prazos` | NO ACTION | **Bloqueia exclusao** |

Alem disso, a Edge Function `delete-chamado-assistencia` tambem nao limpa tabelas como `gastos_beneficios` vinculados ao chamado.

## Solucao

### 1. Atualizar `delete-sinistro/index.ts`

Adicionar limpeza das tabelas faltantes na exclusao em cascata, **antes** de excluir o sinistro principal:

```text
Ordem de exclusao completa:
 1. sinistro_mensagens (ja existe)
 2. sinistro_fotos + storage (ja existe)
 3. sinistro_documentos (ja existe)
 4. sinistro_historico (ja existe)
 5. gastos_beneficios (ja existe)
 6. sinistro_vidros_historico  ← NOVO
 7. sinistro_prestadores       ← NOVO
 8. consultas_juridicas        ← NOVO (desvincular: set sinistro_id = null)
 9. evento_cotacoes_pecas      ← NOVO (desvincular: set sinistro_id = null)
10. vistorias                  ← NOVO (desvincular: set sinistro_id = null)
11. processos_prazos           ← NOVO (excluir onde evento_id = sinistroId)
12. ordens_servico (ja existe - desvincular)
13. processos (ja existe - desvincular)
14. chat_mensagens_ia (ja existe)
15. sinistros (exclusao principal)
16. Log de auditoria
```

### 2. Atualizar `delete-chamado-assistencia/index.ts`

Adicionar limpeza de tabelas faltantes vinculadas ao chamado:

```text
Adicionar antes da exclusao principal:
- gastos_beneficios onde chamado_id = chamadoId (excluir)
```

### 3. Deploy das Edge Functions

Redeployar ambas as funcoes apos as alteracoes.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/delete-sinistro/index.ts` | Adicionar limpeza de 6 tabelas faltantes |
| `supabase/functions/delete-chamado-assistencia/index.ts` | Adicionar limpeza de gastos_beneficios |

