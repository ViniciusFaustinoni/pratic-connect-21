

# Detalhar carência e adicionar toggle de migração com upload

## Problema
1. O alerta de carência mostra apenas "120 dias" sem especificar que é carência **geral** — e omite a carência de **vidros e faróis** (também configurável)
2. A migração aparece como banner informativo passivo — o vendedor precisa sair do fluxo de cotação para solicitar migração separadamente

## Alterações

### 1. `src/pages/vendas/Cotador.tsx` — Detalhar carência

Substituir o alerta único "Carência: 120 dias" por dois itens:
- **Carência geral:** X dias (ou "Sem carência" se migração aprovada)
- **Carência vidros/faróis:** Y dias (usando `useCarenciaVidrosDias()` que já existe no hook)

Ambos na mesma Alert, em duas linhas.

### 2. `src/components/cotacoes/CotacaoFormDialog.tsx` — Mesma mudança

Aplicar a mesma alteração no dialog de cotação: importar `useCarenciaVidrosDias` e exibir as duas carências detalhadas.

### 3. `src/pages/vendas/Cotador.tsx` — Toggle de migração

Substituir o banner informativo de migração por:
- Um **Switch** (interruptor) com label "É migração de outra associação?"
- Quando ativado, exibir:
  - Campo de texto para **nome da associação de origem**
  - Área de **upload de comprovantes** (usando o storage bucket existente)
  - Texto informativo: "X comprovantes exigidos · Prazo Yh"
- Os documentos ficam vinculados à cotação para análise posterior

### 4. `src/components/cotacoes/CotacaoFormDialog.tsx` — Mesmo toggle

Replicar o toggle de migração com upload no dialog de cotação.

### 5. Novo componente `src/components/cotacoes/MigracaoToggle.tsx`

Componente reutilizável para ambos os locais (Cotador e CotacaoFormDialog):
- Switch on/off
- Campo associação de origem
- Upload de comprovantes (drag & drop ou botão)
- Upload para bucket `migracao-documentos` no Supabase Storage
- Retorna `{ ativo, associacaoOrigem, arquivos[] }` via callback

### 6. Criar bucket `migracao-documentos` (migration SQL)

Bucket de storage para os comprovantes de migração enviados durante a cotação.

4 arquivos alterados/criados, 1 migration.

