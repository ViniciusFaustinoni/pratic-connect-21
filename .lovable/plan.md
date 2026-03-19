

# Correção: Migração Direta — Isenção de Carência e Ficha do Associado

## Resumo

Dois bugs onde migrações diretas (sem cotação) são ignoradas: (1) a aprovação não registra isenção de carência, e (2) a ficha do associado não reconhece a migração.

## Alterações

### 1. `src/hooks/useSolicitacoesMigracaoAdmin.ts` — `useAprovarMigracao`

No bloco de isenção de carência (linhas 91-105), adicionar fallback para migração direta:

- Manter a lógica existente: se `cotacaoId` existe, buscar contrato por `cotacao_id`
- Adicionar `else`: quando não há `cotacaoId`, buscar o CPF da solicitação na tabela `solicitacoes_migracao`, depois buscar o associado pelo CPF na tabela `associados` (status `ativo`), e finalmente localizar o contrato ativo mais recente desse associado
- Aplicar o mesmo `update` de `carencia_isenta`, `carencia_motivo_isencao`, etc., respeitando a config `migracao_isentar_carencia` (já lida pela função `fetchMigracaoIsentarCarencia`)

```text
Fluxo:
  cotacaoId existe? → update contrato via cotacao_id (como hoje)
  cotacaoId não existe?
    → buscar solicitação pelo solicitacaoId → pegar associado_cpf
    → buscar associado ativo com esse CPF
    → buscar contrato ativo mais recente desse associado
    → aplicar isenção (se config ativa)
```

### 2. `src/components/associados/detalhe/OrigemCadastroCard.tsx` — `useOrigemCadastro`

No bloco de migração (linhas 143-168), o código só filtra por `cotacao_id`. Adicionar fallback por CPF:

- Após a query existente (por `cotacao_id`), se não encontrou resultado E o `tipoEntradaRaw` é `'migracao'` (ou mesmo se não é — para cobrir migrações diretas que podem não ter `tipo_entrada` setado):
  - Buscar o CPF do associado na tabela `associados`
  - Buscar em `solicitacoes_migracao` por `associado_cpf` + `status = 'aprovada'`
  - Se encontrar, preencher `result.migracao` e atualizar `tipoEntradaKey` para `'migracao'`
- Também ajustar a detecção inicial de `tipoEntradaKey`: antes de cair em `'adesao'` por padrão, verificar se existe solicitação de migração aprovada pelo CPF do associado

A busca do CPF do associado será feita com uma query adicional a `associados.cpf` usando o `associadoId` já disponível.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSolicitacoesMigracaoAdmin.ts` | Fallback para encontrar contrato por CPF quando não há `cotacaoId` |
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Fallback para detectar migração direta por CPF do associado |

