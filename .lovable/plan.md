

# Correções: Ficha e Proposta do Novo Titular — Troca de Titularidade

## Problemas Identificados

### Ficha (OrigemCadastroCard.tsx)

1. **Campo cenário não encontrado** — A query busca `dados?.cenario || dados?.scenario` (linha 288), mas `aprovar-solicitacao-ia` salva como `cenario_aplicado`. O cenário nunca é encontrado.

2. **Status incorreto no filtro** — A query filtra por `status: 'aprovada'` (linha 282), mas o sistema grava `status: 'aprovado'`. Nenhuma solicitação é encontrada.

3. **Busca pelo associado errado** — A query busca por `associado_id = associadoId` do novo titular (linha 280), mas a solicitação foi criada com o `associado_id` do titular anterior. A busca deveria usar o `origem_troca_titularidade_id` do contrato (que contém o `solicitacao_id`) para encontrar a solicitação diretamente.

4. **Carência não exibida** — A seção de carência (linha 637) só renderiza para `migracao` e `reativacao`. A troca de titularidade não exibe carência mesmo quando o contrato tem esses dados.

### Proposta (template-utils.ts)

5. **Sem variáveis de troca** — O mapeamento de variáveis tem `operacao.troca_titularidade` (checkbox), mas não tem variáveis para titular anterior, cenário aplicado e label do cenário. Templates não conseguem exibir essas informações.

6. **Interface sem campo troca** — `TermoAfiliacaoData` tem campos para `migracao` e `substituicao`, mas não para `trocaTitularidade`.

---

## Alterações

### 1. `OrigemCadastroCard.tsx` — Corrigir busca e exibição

**Dados (useOrigemCadastro):**
- Usar `contrato.origem_troca_titularidade_id` (que armazena o `solicitacao_id`) para buscar a solicitação diretamente por `id`, eliminando os problemas de `associado_id` errado e `status` errado.
- Ler `dados.cenario_aplicado` em vez de `dados.cenario`.
- Buscar `carencia_isenta`, `data_carencia_inicio`, `data_carencia_fim` do contrato (já na query existente).

**Interface `trocaTitularidade`:**
- Adicionar campos `carenciaIsenta`, `carenciaInicio`, `carenciaFim`.

**Render (RenderTrocaTitularidade):**
- Exibir seção de carência inline (como já faz para migração e reativação).

**Seção de carência global (linha 637):**
- Adicionar `troca_titularidade` à condição de exibição. Alternativamente, mover a carência para dentro do `RenderTrocaTitularidade` para controle mais preciso.

### 2. `termo-afiliacao-utils.ts` — Adicionar interface de troca

Adicionar campo opcional `trocaTitularidade` em `TermoAfiliacaoData`:
```typescript
trocaTitularidade?: {
  titular_anterior: string;
  cenario: string;
  cenario_label: string;
};
```

### 3. `template-utils.ts` — Adicionar variáveis de troca

No `criarMapeamentoVariaveis`, adicionar bloco condicional:
```typescript
...(dados.trocaTitularidade ? {
  'troca.titular_anterior': dados.trocaTitularidade.titular_anterior || '—',
  'troca.cenario': dados.trocaTitularidade.cenario || '—',
  'troca.cenario_label': dados.trocaTitularidade.cenario_label || '—',
} : {}),
```

### 4. `autentique-create` e `autentique-create-by-token` — Injetar dados de troca

Nos dois edge functions que geram propostas, quando o contrato tem `tipo_entrada === 'troca_titularidade'`:
- Buscar a solicitação via `origem_troca_titularidade_id`
- Buscar o nome do titular anterior via contrato anterior
- Montar o campo `trocaTitularidade` no `TermoAfiliacaoData`

---

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Corrigir busca da solicitação, ler `cenario_aplicado`, adicionar carência |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Adicionar `trocaTitularidade` à interface `TermoAfiliacaoData` |
| `supabase/functions/_shared/template-utils.ts` | Adicionar variáveis `troca.*` no mapeamento |
| `supabase/functions/autentique-create/index.ts` | Injetar dados de troca no `TermoAfiliacaoData` |
| `supabase/functions/autentique-create-by-token/index.ts` | Injetar dados de troca no `TermoAfiliacaoData` |

