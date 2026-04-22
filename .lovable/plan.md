

## Exportação inteligente de Associados com filtro de data customizado

### O que já existe (não vou mexer)
- Página `src/pages/cadastro/Associados.tsx` já tem dropdown "Exportar" com XLSX/CSV.
- Hook `useAssociados` já aceita `data_adesao_inicio` e `data_adesao_fim` (server-side).
- Painel de filtros `AssociadoFilters.tsx` tem período pré-definido (último mês, 3 meses, último ano) — só radio, sem datas customizadas.
- Export atual usa `filteredAssociados` (apenas a página atual paginada — limitado a 20/50/100 linhas) e exporta um conjunto fixo de 10 colunas.

### O que está faltando (o pedido)
1. Filtro de **data customizada** (intervalo "de/até") na barra principal e no painel de filtros, indo direto ao banco.
2. **Exportação inteligente**: modal dedicado onde o usuário escolhe:
   - Intervalo de datas (de/até) sobre `data_adesao`.
   - Quais filtros aplicar (status, plano, cidade, UF) — herda os filtros ativos da tela, mas permite ajustar.
   - Quais colunas incluir no arquivo.
   - Formato: XLSX ou CSV.
3. Export deve buscar **todos os registros** que casam com os filtros (não só a página atual).

---

### Mudanças

#### 1. `src/components/cadastro/AssociadoFilters.tsx` — adicionar datas customizadas
- Substituir o `RadioGroup` "Período de Adesão" por:
  - Manter atalhos rápidos (último mês, 3 meses, ano) como botões.
  - Adicionar dois `Input type="date"` lado a lado ("De" / "Até"), com label "Data de adesão".
- Estender o `onApply` para entregar `data_adesao_inicio?: string` e `data_adesao_fim?: string` (ISO `YYYY-MM-DD`).
- Atalhos preenchem os dois inputs; usuário pode editar manualmente.

#### 2. `src/pages/cadastro/Associados.tsx` — propagar datas para o servidor
- Adicionar `data_adesao_inicio` e `data_adesao_fim` ao `sheetFilters` e passar dentro de `useAssociados({ filters })` (já tem suporte server-side).
- Remover a lógica client-side de filtro de período em `filteredAssociados` (não é mais necessária — vem filtrado do banco).
- Atualizar `clearFilters`, `activeFilterCount` e `hasFilters` para considerar as novas chaves.

#### 3. Novo componente `src/components/cadastro/ExportAssociadosDialog.tsx` — exportação inteligente
- Dialog acionado pelo botão "Exportar" (substituindo o dropdown atual de 2 itens).
- Seções:
  - **Intervalo de datas** (de/até) — pré-preenchido com o filtro atual da tela; com atalhos: Hoje, Últimos 7 dias, Mês atual, Mês passado, Últimos 3 meses, Ano atual, Tudo.
  - **Filtros aplicados** (resumo) — mostra status, plano, cidade vindos da tela, com switch "Usar filtros da tela" (default ON). Se OFF, exporta tudo dentro do intervalo.
  - **Colunas a incluir** — checkboxes (todas marcadas por padrão): Nome, CPF, Telefone, Email, Veículo (placa+modelo), Plano, Status, Data Adesão, Cidade, UF, Data de nascimento, Endereço, Bairro, CEP. Botões "Marcar todos" / "Desmarcar".
  - **Formato**: XLSX ou CSV (radio).
- Ao confirmar:
  - Faz uma query Supabase direta (igual ao hook, mas **sem paginação** — usa `.range(0, 9999)` em batches se passar de 1000 para evitar limite, ou faz `count` + loops). Padrão recomendado: loop em páginas de 1000 até atingir total.
  - Monta `dataToExport` apenas com colunas selecionadas.
  - Gera arquivo via `xlsx` com nome `associados_{YYYYMMDD}_a_{YYYYMMDD}.{ext}`.
  - Toast de sucesso com quantidade exportada.
  - Loader no botão durante a busca paginada.

#### 4. Atualizar botão "Exportar" em `Associados.tsx`
- Remover `DropdownMenu` atual.
- Botão simples que abre `ExportAssociadosDialog`.

---

### Detalhes técnicos
- Filtro de data usa `data_adesao` (date) via `gte`/`lte` (já implementado no hook).
- Para evitar o limite default de 1000 linhas do PostgREST na exportação, o dialog faz paginação interna em loop até atingir `count`.
- Datas vão para o banco como `YYYY-MM-DD` (sem timezone), batendo com a coluna `date`.
- Atalhos calculam datas em horário local do navegador (BR).
- O dialog reaproveita `usePlanos`/`useAssociadosCidades` já no escopo da página via props.

### Arquivos envolvidos
- `src/components/cadastro/AssociadoFilters.tsx` (datas customizadas + atalhos)
- `src/pages/cadastro/Associados.tsx` (propagar datas server-side, trocar dropdown por dialog)
- `src/components/cadastro/ExportAssociadosDialog.tsx` (novo — exportação inteligente)

### Fora de escopo
- Mexer em `useAssociados` (já suporta os filtros de data).
- Salvar presets de exportação.
- Exportar dados além da tabela `associados` (não inclui histórico financeiro, sinistros etc.).
- Job assíncrono para >50k linhas (loop síncrono cobre o volume atual de 9.5k).

