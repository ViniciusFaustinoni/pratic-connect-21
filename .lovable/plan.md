## Objetivo

Criar uma edge function dedicada que consulta apenas os dois endpoints do Hinova citados — `GET /veiculo/buscar/:placa/placa` e `GET /associado/buscar/:cpf/cpf` — e devolve um snapshot cru para exibição (amostragem) no modal "Substituição de Placa".

Não há mudança de regra de negócio, banco ou fluxo: a edge atual `sga-buscar-associado-completo` (que também busca boletos e agrega vários veículos) **continua sendo a fonte canônica** para a verificação de débito/elegibilidade. A nova edge serve só pra enriquecer o card de exibição.

## O que será feito

### 1. Nova edge `supabase/functions/sga-buscar-veiculo-associado/index.ts`

- Input: `{ placa: string }` (sanitizado p/ A-Z0-9).
- Fluxo:
  1. `getHinovaSession`
  2. `buscarVeiculoPorPlaca(session, placa)` → pega `codigo_associado` + payload cru do veículo
  3. Se achou, `GET /associado/buscar/:cpf/cpf` (reusa o padrão já existente em `fetchAssociadoMeta`) com o CPF retornado pelo veículo
  4. Retorna 200 com:
     ```ts
     {
       encontrado: boolean,
       veiculo: {
         placa, chassi, marca, modelo,
         ano_fabricacao, ano_modelo,
         valor_fipe, codigo_fipe,
         codigo_veiculo, codigo_situacao, descricao_situacao,
         renavam, codigo_cor, codigo_combustivel,
       } | null,
       associado: {
         codigo_associado, nome, cpf,
         email, telefone_celular, telefone_fixo,
         logradouro, numero, complemento, bairro, cidade, estado, cep,
         data_nascimento, dia_vencimento,
         descricao_situacao,
       } | null,
       erro_transitorio?: boolean, motivo?: string
     }
     ```
- Mesma política de erro transitório usada em `sga-buscar-associado-completo`: 200 com `erro_transitorio:true` em vez de 5xx (pra não quebrar a UI).
- Sem boletos, sem agregação por CPF, sem listar outros veículos — é só amostragem.

### 2. Hook fino `src/hooks/useSgaVeiculoAssociado.ts`

- `useQuery` por placa (≥ 7 chars), dispara só quando o usuário seleciona o veículo no modal (`enabled: !!selectedAssociadoId`).
- Retorna `{ data, isLoading, erroTransitorio }`.

### 3. UI — `src/components/vendas/OutrasEntradasMenu.tsx`

- Dentro do bloco `isSubstituicao && selectedAssociadoId` (linhas ~563–612), abaixo do bloco atual de nome/modelo/elegibilidade, inserir um card colapsado de amostragem com os campos retornados pela nova edge.
- Layout: 2 colunas pequenas, tipografia `text-xs text-muted-foreground` para rótulos e `text-sm` para valores; nada de mudança visual no botão "Prosseguir" nem na lógica de bloqueio por débito.
- Loader inline enquanto `isLoading`.
- Se `erroTransitorio`, mostrar nota discreta "Dados do SGA temporariamente indisponíveis" sem bloquear o botão.

## Fora do escopo

- Não toca em `sga-buscar-associado-completo`, `useBuscaPlaca`, `criar-solicitacao-substituicao` nem em nada do fluxo de elegibilidade/débito.
- Não altera banco, RLS, triggers ou tipos.
- Não muda o caminho da cotação subsequente — o snapshot é só visual.

## Arquivos afetados

- **novo** `supabase/functions/sga-buscar-veiculo-associado/index.ts`
- **novo** `src/hooks/useSgaVeiculoAssociado.ts`
- **editado** `src/components/vendas/OutrasEntradasMenu.tsx` (apenas o trecho de exibição da Substituição)
