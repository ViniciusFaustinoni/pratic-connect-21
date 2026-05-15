## Objetivo

Adicionar um campo **"Tipo da cotação"** (informativo, com sugestões + texto livre) no fluxo padrão de cotação, salvar na cotação e enviar no campo `observacao` do veículo no SGA junto ao histórico de avisos já existente.

## Estado atual (auditado)

- `cotacoes.tipo_entrada` (text, sem default) **já existe** no DB. Valores canônicos em uso: `adesao`, `migracao`, `inclusao`, `troca_titularidade`, `reativacao`, `substituicao_placa`.
- `CotacaoFormDialog` já preenche automaticamente quando o contexto é claro:
  - `origemTroca` → `tipo_entrada = 'troca_titularidade'`
- Pages `Cotador.tsx` / `Cotacao.tsx` preenchem `inclusao` ou `substituicao` quando vêm via querystring.
- `sga-hinova-sync` (linha 877) já monta `observacao` com cabeçalho + histórico de `cotacao_avisos_sga`. **Não inclui o tipo hoje.**

## Alterações

### 1. UI — `src/components/cotacoes/CotacaoFormDialog.tsx`
- Novo bloco "Tipo da cotação" (uma linha, dentro do passo de dados gerais).
- Componente: `Select` com opções:
  - Cotação nova (adesão) → `adesao`
  - Inclusão de veículo → `inclusao`
  - Substituição de veículo → `substituicao_placa`
  - Troca de titularidade → `troca_titularidade`
  - Reativação → `reativacao`
  - Migração → `migracao`
  - Outro (texto livre) → mostra `Input` adicional para descrição
- Pré-seleção automática:
  - `origemTroca` presente → `troca_titularidade` (campo desabilitado/locked)
  - `cotacaoBase` com `tipo_entrada` → herda
  - default: `adesao`
- Se selecionar "Outro", salvar `tipo_entrada = 'outro'` e `dados_extras.tipo_entrada_descricao` com o texto livre.
- O fluxo de cotação não muda — campo é apenas informativo.

### 2. Persistência — `src/components/cotacoes/CotacaoFormDialog.tsx`
- Estender o objeto enviado ao criar a cotação:
  - Coluna direta `tipo_entrada` (já há precedente para troca).
  - `dados_extras.tipo_entrada` espelhado (mantém padrão atual).
  - `dados_extras.tipo_entrada_descricao` quando "Outro".
- Sem migração: campo já existe; `dados_extras` é `jsonb`.

### 3. SGA — `supabase/functions/sga-hinova-sync/index.ts`
- No bloco que monta `observacao` (linha 877), buscar a cotação vinculada ao contrato (`contratos.cotacao_id`) e ler `tipo_entrada` + `dados_extras.tipo_entrada_descricao`.
- Inserir cabeçalho:
  ```
  Tipo: <label legível em pt-BR>[ — <descricao livre>]
  ```
  antes da linha "Cadastro via Pratic Connect — contrato …".
- Mapa de labels: `adesao`→"Cotação nova (adesão)", `inclusao`→"Inclusão de veículo", `substituicao_placa`→"Substituição de veículo", `troca_titularidade`→"Troca de titularidade", `reativacao`→"Reativação", `migracao`→"Migração", `outro`→"Outro".
- Mantém o truncamento de 1900 caracteres já existente.

### 4. Sem alterações
- Não mexer em `Cotador.tsx`/`Cotacao.tsx` (já preenchem o tipo via querystring) — apenas garantir que o novo Select respeite valor pré-existente.
- Sem alterações em RLS, triggers, outras edges, ou `cotacao_avisos_sga`.

## Resultado esperado

- Toda cotação criada pelo modal padrão tem `tipo_entrada` preenchido (manual ou auto).
- Quando o veículo for sincronizado ao SGA, o campo `observacao` começa com `Tipo: <descrição>` seguido pelo cabeçalho do contrato e pelo bloco `=== Avisos SGA durante a cotação ===` já existente.
- Fluxo, validações e regras de negócio continuam idênticos.
