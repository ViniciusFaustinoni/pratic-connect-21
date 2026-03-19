

# Migração Aprovada — Rastreabilidade na Ficha, Coberturas e Proposta

## Resumo

Integrar dados da migração aprovada em 3 pontos: (1) OrigemCadastroCard com dados completos da solicitação, (2) StatusCoberturaCard e hook de coberturas do app com indicação de isenção de carência, (3) Proposta PDF com seção de migração e bloqueio antes da aprovação.

## Ponto 1 — OrigemCadastroCard

**Arquivo:** `src/components/associados/detalhe/OrigemCadastroCard.tsx`

O hook `useOrigemCadastro` já detecta tipo de entrada via contrato. Expandir para:

1. Buscar `contratos.tipo_entrada` do contrato vinculado ao associado
2. Quando `tipo_entrada === 'migracao'`, buscar `solicitacoes_migracao` via `cotacao_id` do contrato (join `contratos.cotacao_id → solicitacoes_migracao.cotacao_id`) com status `aprovada`
3. Join em `profiles` para obter nome do analista (`aprovado_por`) e consultor (`consultor_id`)
4. Exibir campos adicionais no card:
   - Tipo de entrada: Badge "Migração Aprovada" (verde)
   - Associação de origem: `solicitacoes_migracao.associacao_origem`
   - Data de aprovação: `solicitacoes_migracao.aprovado_em`
   - Analista responsável: nome do `aprovado_por`
   - Consultor: nome do `consultor_id`
   - Carência: se `contrato.carencia_isenta === true` e `carencia_motivo_isencao` contém "migração", exibir "Isento de carência — origem: migração aprovada"; senão exibir período normal (início/fim)

## Ponto 2 — Coberturas

### 2a. StatusCoberturaCard (painel do operador)

**Arquivo:** `src/components/cadastro/StatusCoberturaCard.tsx`

- Adicionar prop opcional `carenciaIsenta?: boolean` e `carenciaMotivoIsencao?: string | null`
- Quando `carenciaIsenta === true`, exibir ao lado de cada cobertura ativa uma nota: "Sem carência — {motivo}"
- Atualizar o componente pai (`VistoriaCompletaAnalise`) para passar esses valores do contrato

### 2b. useMinhasCoberturasApp (app do associado)

**Arquivo:** `src/hooks/useMinhasCoberturasApp.ts`

- Buscar dados do contrato ativo do associado (`contratos` com `associado_id` e status ativo)
- Quando `carencia_isenta === true`, incluir na `mensagemCoberturaParcial` a informação de isenção
- A lógica já existente em `useAssociadoSituacao` respeita `carencia_isenta` do contrato — garantir que o hook do app também consulte esse campo

### 2c. Registro automático de isenção

**Arquivo:** `src/hooks/useSolicitacoesMigracaoAdmin.ts` (mutation de aprovação)

Na mutation `useAprovarMigracao`, após aprovar, buscar o contrato vinculado à cotação da solicitação e atualizar:
- `contratos.carencia_isenta = true`
- `contratos.carencia_motivo_isencao = 'Migração aprovada'`
- `contratos.data_carencia_inicio = null`
- `contratos.data_carencia_fim = null`

Isso só ocorre se `useMigracaoConfig().isentar_carencia` estiver ativa. O valor é gravado no contrato (snapshot), então mudanças futuras na config global não afetam contratos já aprovados.

## Ponto 3 — Proposta PDF

### 3a. Expandir `DadosProposta`

**Arquivo:** `src/types/proposta.ts`

Adicionar campo opcional ao tipo:
```typescript
migracao?: {
  aprovada: boolean;
  associacaoOrigem: string;
  carenciaIsenta: boolean;
  dataAprovacao: string;
};
```

### 3b. Atualizar `useGerarProposta`

**Arquivo:** `src/hooks/useGerarProposta.ts`

Na função `gerarPropostaDoZero`, após a seção "PLANO":
- Se `dados.migracao?.aprovada`, desenhar seção "MIGRAÇÃO" com:
  - "Tipo de entrada: Migração"
  - "Associação de origem: {nome}"
  - "Carência: Dispensada — Migração aprovada em {data}"
- Se `dados.migracao` existir mas `aprovada === false`, não gerar (bloqueio)

### 3c. Bloqueio de geração

**Arquivo:** `src/components/vendas/BotaoGerarProposta.tsx`

Quando `tipoOperacao === 'migracao'` e a solicitação não está aprovada:
- Desabilitar botão com tooltip "Aguardando aprovação da migração"

### 3d. Template do Termo (Edge Function)

**Arquivo:** `supabase/functions/_shared/template-utils.ts`

Adicionar variáveis ao mapeamento:
- `migracao.associacao_origem`: nome da associação de origem
- `migracao.data_aprovacao`: data formatada
- `migracao.carencia_status`: "Dispensada — migração aprovada" ou período normal
- `migracao.aprovada`: "Sim" / "Não"

Buscar dados da `solicitacoes_migracao` via `cotacao_id` do contrato.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Expandir com dados de migração |
| `src/components/cadastro/StatusCoberturaCard.tsx` | Adicionar props de carência |
| `src/hooks/useMinhasCoberturasApp.ts` | Consultar carência do contrato |
| `src/hooks/useSolicitacoesMigracaoAdmin.ts` | Registrar isenção na aprovação |
| `src/types/proposta.ts` | Adicionar tipo migração |
| `src/hooks/useGerarProposta.ts` | Seção migração no PDF |
| `src/components/vendas/BotaoGerarProposta.tsx` | Bloqueio antes da aprovação |
| `supabase/functions/_shared/template-utils.ts` | Variáveis de migração |

Nenhuma mudança de schema necessária — os campos `carencia_isenta` e `carencia_motivo_isencao` já existem na tabela `contratos`, e `solicitacoes_migracao` já tem todos os dados necessários.

