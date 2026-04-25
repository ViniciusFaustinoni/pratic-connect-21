## Relatórios inteligentes de Cotações + Status SGA

Vou adicionar, na aba **Vendas → Cotações** (visível apenas para Diretor), um botão **"Relatório Inteligente"** que abre um modal com filtros avançados e gera um Excel multi-aba. Em paralelo, vou exibir o **status real do SGA/Hinova** nas cotações fechadas (que já viraram veículo).

---

### 1. Botão "Relatório Inteligente" (Diretor)

Aparece no header da página de Cotações, ao lado de "Nova Cotação", visível apenas para `isDiretor`.

Abre um diálogo com filtros:

- **Período**: presets (Hoje, Ontem, Últimos 7/30/90 dias, Mês atual, Mês anterior, Ano atual) + intervalo customizado (data início / data fim)
- **Estado / Cidade**: multi-select alimentado com os valores distintos de `cliente_uf` e `cliente_cidade` (com normalização básica de maiúsculas/acentos)
- **Situação**: Em andamento, Finalizadas, Todas
- **Status detalhado** (multi-select): Rascunho, Link Enviado, Escolhendo Plano, Enviando Docs, Assinando Contrato, Pagando Taxa, Agendando Vistoria, Em Análise, Fechado, Recusada/Cancelada
- **Consultor / Vendedor**: multi-select
- **Plano escolhido**: multi-select
- **Status SGA** (apenas faz sentido em fechadas): Não enviado, Pendente, Sincronizando, Ativado no SGA, Erro

Preview no modal: contagem de cotações que serão exportadas + estimativa de tempo.

### 2. Geração do Excel (multi-aba)

Botão "Gerar Excel" baixa um arquivo `cotacoes_relatorio_AAAA-MM-DD.xlsx` com 4 abas:

- **Resumo**: total geral, totais por status, por UF, por consultor, taxa de conversão (Fechadas / Total), ticket médio (FIPE), filtros aplicados
- **Cotações**: linha por cotação com nº, data criação, cliente, CPF/CNPJ, telefone, cidade/UF, veículo (marca/modelo/ano/placa), FIPE, plano escolhido, status atual, etapa do funil, consultor, data última atualização, link público, **status SGA** (quando aplicável)
- **Por Status**: agregação status × quantidade × valor FIPE total
- **Por Região**: agregação UF/cidade × quantidade × ticket médio × % de conversão

Implementação: edge function `gerar-relatorio-cotacoes` recebe os filtros, faz a query com paginação, monta o XLSX com `xlsx`/`exceljs` e devolve como base64 (ou faz upload no Storage e retorna URL assinada).

### 3. Status real de envio para o SGA

Hoje a coluna "Consultor" é a última informação visual relevante. Vou:

- Adicionar uma coluna **"SGA"** na listagem (apenas exibida para diretor/admin) com badge colorido:
  - cinza "—" → cotação ainda não fechada
  - amarelo "Pendente" → veículo criado, `status_sga = 'pendente'`
  - azul "Sincronizando" → `status_sga = 'sincronizando'`
  - verde "Ativado" → `sincronizado_hinova = true`
  - vermelho "Erro" → `status_sga = 'erro_sincronizacao'` (com tooltip mostrando o motivo se disponível)
- O hook `useCotacoes` passará a fazer um JOIN leve com `veiculos` (via `associado_id` da cotação fechada) para trazer `sincronizado_hinova`, `status_sga`, `sincronizado_hinova_em`.
- Adicionar filtro "Status SGA" também no header da listagem (não só no relatório).

---

### Arquivos afetados

- `src/pages/vendas/Cotacoes.tsx` — botão, coluna SGA, filtro SGA
- `src/components/vendas/RelatorioInteligenteCotacoesDialog.tsx` (novo) — modal de filtros + preview
- `src/hooks/useRelatorioCotacoes.ts` (novo) — chamada à edge function + download
- `src/hooks/useCotacoes.ts` — incluir join com veiculos para status SGA
- `supabase/functions/gerar-relatorio-cotacoes/index.ts` (novo) — gera o XLSX com filtros server-side
- `supabase/config.toml` — registrar a nova edge function

### Observações

- Cidade tem inconsistência de capitalização/acento ("RIO DE JANEIRO" vs "Rio de Janeiro"). Vou normalizar (UPPER + remoção de acentos) para o agrupamento, exibindo a versão capitalizada.
- O relatório respeita as regras de RLS já existentes (a edge function usa o JWT do diretor).
- O status SGA só aparece preenchido após a cotação virar associado/veículo (status `aceita`/`concluido`).
