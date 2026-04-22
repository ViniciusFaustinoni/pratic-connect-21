

## Ordenação cronológica + reordenar colunas em Serviços de Campo

Na página `/monitoramento/vistorias-instalacoes-mon` (componente `ServicosCampoUnificado.tsx`) hoje os serviços vêm em ordem **crescente** por `data_agendada`, então os mais recentes ficam no fim da lista. Além disso, a tabela tem a ordem **Tipo → Data → Associado → Veículo → Endereço → Técnico → Status**, e você quer **Tipo → Associado → Data → (demais)**.

### O que vai mudar

**1. Ordenação cronológica decrescente (mais recentes no topo)**
- `src/hooks/useServicos.ts` (linha ~283): trocar `.order('data_agendada', { ascending: true })` por `.order('data_agendada', { ascending: false, nullsFirst: false })` e `.order('hora_agendada', { ascending: false, nullsFirst: false })`.
- Como critério de desempate (e para serviços sem data agendada), adicionar `.order('created_at', { ascending: false })` ao final, garantindo que serviços recém-criados sempre apareçam no topo.

**2. Reordenar colunas da tabela**
- `src/components/servicos-campo/ServicosTable.tsx`: trocar a ordem dos `<TableHead>` e `<TableCell>` para:
  ```
  Tipo  →  Associado  →  Data / Período  →  Veículo  →  Endereço  →  Técnico  →  Status
  ```
- Nenhuma mudança de conteúdo das células — apenas reposicionamento dos blocos JSX correspondentes.

### Impacto

- Vale para todas as abas/fases (Pré-execução, Em campo, Concluídas, etc.) já que todas consomem o mesmo hook.
- Não afeta a página `/cobranca/...` nem outras telas que usam `useServicos`, pois elas têm ordenações próprias (ex.: ranking concluídos por `concluida_em desc` na linha 690 — preservado).
- Sem migrações, sem mudança de schema.

### Arquivos editados

- `src/hooks/useServicos.ts` (1 trecho — ~3 linhas)
- `src/components/servicos-campo/ServicosTable.tsx` (reordenar header + body)

