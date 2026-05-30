## Objetivo

No modal **Substituição de Placa**, exigir também a placa do **veículo novo** e consultar o SGA. Se a placa nova **existir no SGA**, bloquear a substituição e oferecer um botão para abrir automaticamente o modal de **Troca de Titularidade** (com o associado anterior já resolvido a partir da placa antiga).

Regra: substituição só é permitida quando o veículo novo **não está** no SGA.

## Mudanças (somente UI/orquestração — sem backend novo)

### 1. `src/components/vendas/OutrasEntradasMenu.tsx`

**a) Novo estado**
- `placaNova: string` + `setPlacaNova`
- Resetar junto com os demais no `useEffect` de fechamento.

**b) Consulta SGA da placa nova**
- Reusar o hook existente `useSgaVeiculoAssociado(placaNova, isSubstituicao && !!selectedAssociadoId)`.
- Já retorna `{ encontrado, veiculo, associado, erro_transitorio }` — não criar edge nova.

**c) UI dentro do bloco `selectedAssociadoId` da Substituição (após o snapshot SGA do veículo antigo, antes do botão "Prosseguir")**
- Input: "Placa do veículo novo…" (uppercase, regex placa Mercosul/antiga aplicada).
- Estados visuais:
  - Digitando / placa incompleta → hint cinza.
  - `isLoading` → spinner "Consultando SGA…".
  - `erro_transitorio` → alerta âmbar (reusa `SgaTransientAlert`).
  - **`encontrado === true`** → Alert destacado:
    > "Este veículo já pertence a outro associado no SGA — não é uma substituição. Use **Troca de Titularidade**."
    + amostra curta (placa, marca/modelo SGA, nome do associado SGA).
    + Botão **"Prosseguir com Troca de Titularidade"** (variant default).
  - **`encontrado === false`** → check verde "Veículo novo não cadastrado no SGA — apto a substituição".

**d) Habilitação do botão "Prosseguir — Cotar novo veículo"**
- Só habilita quando: `placaNova` válida + consulta concluída + `!encontrado` + `!erro_transitorio`.

**e) Handler `handleProsseguirComoTroca`** (quando SGA novo retorna `encontrado`)
1. Pega o associado anterior (dono do veículo antigo) — já temos `selectedAssociadoId` (codigo SGA), `selectedAssociadoNome`, `selectedAssociadoCpf` vindos de `handleSelectPlaca`.
2. Importa o associado anterior do SGA para obter o UUID local: `supabase.functions.invoke('importar-associado-sga', { body: { cpf: selectedAssociadoCpf } })` — mesmo caminho já usado em `handleSelectAssociado` para troca (linhas 307–337). Tratamento de erro idêntico.
3. Substitui `selectedAssociadoId` pelo UUID local retornado, seta `selectedCodigoHinova`.
4. `setShowTrocaTitularidade(true)` + `setTimeout(() => onOpenChange(false), 0)` (mesmo padrão da linha 348–351, evita race com reset do `useEffect`).
5. `TrocaTitularidadeDialog` abre normalmente com o associado anterior já carregado.

**f) Reset**
- Quando o usuário muda a placa nova, limpar mensagens anteriores (estado derivado do hook, basta resetar `placaNova`).

## Fora de escopo

- Nenhuma edge function nova (reusa `sga-buscar-veiculo-associado` via `useSgaVeiculoAssociado` e `importar-associado-sga`).
- Sem alterações em `criar-solicitacao-substituicao`, schema, RLS, ou `TrocaTitularidadeDialog`.
- Sem alteração em outros fluxos (Inclusão / Troca direta).

## Critério de aceite

1. Em Substituição, com placa antiga selecionada, o segundo campo "placa do veículo novo" aparece.
2. Placa nova **achada no SGA** ⇒ botão "Prosseguir" some, surge alerta + botão "Prosseguir com Troca de Titularidade" que fecha o modal atual e abre o de Troca já com o associado anterior preenchido.
3. Placa nova **não achada no SGA** ⇒ check verde + botão "Prosseguir — Cotar novo veículo" habilitado, fluxo segue como hoje.
4. Erro transitório do SGA na placa nova ⇒ banner âmbar com retry, "Prosseguir" desabilitado.
