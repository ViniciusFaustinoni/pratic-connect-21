# Correção: "ASSOCIADO NÃO ENCONTRADO" na Inclusão de Veículo

## Diagnóstico

Relato de **Maria Júlia Florêncio Gomes** (`error_reports.7fa873f1...`):

> *"Ao clicar na aba de inclusão, não consegui encontrar o associado no sistema."*

O screenshot mostra a busca por **"VICTOR HUGO FERREIRA DOS SANTOS CARDOZO"** (texto livre) → "Nenhum associado encontrado". Confirmado: esse nome **não existe na tabela local `associados`**, mas o associado é cliente da Praticcar — vive apenas no **SGA (Hinova)**.

### Causa-raiz técnica

Em `src/components/vendas/OutrasEntradasMenu.tsx`, a Inclusão de Veículo usa dois hooks:

1. `useAssociadoSearch(termo)` — só consulta SGA quando o termo é **CPF de 11 dígitos**. Para nome/telefone parcial, faz `SELECT` apenas na tabela local `associados`.
2. `useBuscaPlaca(termo)` — consulta SGA, mas só com **placa de 7+ caracteres**.

A API Hinova/SGA (`hinova-client.ts`) **não oferece endpoint de busca por nome** — só `associado/buscar/{cpf}/cpf` e `veiculo/buscar/{placa}/placa`. Portanto, buscar por nome textual nunca consegue alcançar associados que estão exclusivamente no SGA, e a vendedora vê apenas "Nenhum associado encontrado", sem entender por quê.

## Correção

Como a API SGA não suporta busca por nome, a solução é **orientar a vendedora a usar CPF ou placa** quando o associado não aparece pelo nome.

### 1) Empty-state contextual e acionável (`OutrasEntradasMenu.tsx`)

Substituir a mensagem genérica `"Nenhum associado encontrado"` por um bloco que:
- Detecta o tipo de termo digitado (texto vs. número parcial vs. CPF/placa incompletos);
- Mostra **dica clara**: *"Não encontramos esse nome na nossa base. Se o cliente já é associado da Praticcar, busque pelo **CPF completo** (11 dígitos) ou pela **placa** (7 caracteres) — assim conseguimos consultar o SGA em tempo real."*
- Mostra ícone informativo + atalho visual indicando que CPF/placa fazem busca SGA.

### 2) Indicador "buscando no SGA"

Quando o usuário digita CPF completo ou placa válida, mostrar um pequeno hint *"Consultando SGA…"* enquanto `loadingAssociados`/`loadingPlacas` está ativo, para deixar claro que o sistema vai além da base local.

### 3) Aceitar busca por placa também na lista de associados

Hoje `useBuscaPlaca` é mesclado com `useAssociadoSearch` em `mergedAssociadoResults` — verificar se está realmente sendo disparado para tipo `inclusao` (linhas 92-94: `selectedTipo !== 'migracao'` ✓, ok). Manter, e garantir que o placeholder do input já cite *"nome, CPF ou placa"* (já cita).

### 4) Marcar relato como resolvido

Atualizar `error_reports.7fa873f1...` para status `concluido` com observação descrevendo a correção (limitação SGA + UX nova).

## Fora de escopo (intencional)

- **Não vamos** abrir endpoint de busca por nome no SGA — Hinova não oferece.
- **Não vamos** sincronizar toda a base SGA para a tabela local — escopo grande, fora do relato.
- **Não vamos** tocar no relato de "forma de pagamento" (excluído pelo usuário em mensagens anteriores).

## Arquivos afetados

- `src/components/vendas/OutrasEntradasMenu.tsx` — empty-state inteligente + hint "consultando SGA"
- update em `error_reports` (data, via insert tool)
