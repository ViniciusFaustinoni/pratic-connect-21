

## Fase 3 — Saneamento de leituras legadas (`instalacoes` / `vistorias` → `servicos`)

### Diagnóstico
59 arquivos em `src/` ainda leem das tabelas legadas. A grande maioria é de telas históricas/relatórios (fora de escopo). O foco desta fase são **hooks e componentes ATIVOS no fluxo operacional** (monitoramento, equipe, rotas, vistoriador), onde a divergência de fonte de dados causa contadores zerados, atribuições fantasma e inconsistência com `useEquipe`.

### Arquivos prioritários (ordem de execução)

#### Lote 1 — Operação técnico (alta criticidade)
1. **`src/components/vistoriador/ImprevistoBotao.tsx`** (linhas 81-100)
   - Hoje: ao registrar imprevisto, atualiza `instalacoes.instalador_responsavel_id=null` e `vistorias.vistoriador_id=null`.
   - Correção: atualizar `servicos` (via `id` do serviço atual) — `profissional_id=null`, `status='pendente_realocacao'` (ou similar). Remover lógica que diferencia `instalacao_origem_id` vs `vistoria_origem_id` — usar só `servico_id`.

2. **`src/hooks/useRealocarInstalacao.ts`** (linhas 75-170)
   - Hoje: realocação de instalação opera em `instalacoes` (rota e base).
   - Correção: trocar para `servicos` com filtro `tipo='vistoria_instalacao'`. Renomear hook → `useRealocarServico` (mantendo alias temporário para compatibilidade).

#### Lote 2 — Rotas (média criticidade)
3. **`src/hooks/useRotas.ts`** (linhas 123-545)
   - Hoje: 11 referências a `instalacoes`/`vistorias` para vincular/desvincular rota.
   - Correção: unificar em `servicos.rota_id` com filtros por `tipo`. Remover queries duplicadas (uma query em `servicos` substitui as duas).
   - Maior refator do lote — quebrar em commits menores se necessário.

#### Lote 3 — Modal de monitoramento (baixa criticidade visual, mas dado errado)
4. **`src/components/monitoramento/CalendarioDiaModal.tsx`** (linha 174+)
   - Verificar se a query do calendário está somando duas tabelas legadas em vez de `servicos` — se for o caso, migrar.

### Não tocar (relatórios históricos / telas desativadas)
Os outros 55 arquivos com `from('instalacoes')` ou `from('vistorias')` ficam como estão. Critério: se o componente é referenciado pelas rotas `/monitoramento/*`, `/vistoriador/*`, `/rotas/*`, `/servicos-campo/*` E modifica dados, está em escopo. Demais (relatórios, dashboards históricos, exports) ficam intocados.

### Padrão de migração

Para cada query:
- `from('instalacoes')` → `from('servicos').eq('tipo', 'vistoria_instalacao')`
- `from('vistorias')` → `from('servicos').in('tipo', ['vistoria_manutencao', 'vistoria_retirada'])` (ou `.eq` específico, conforme contexto)
- `instalador_responsavel_id` / `vistoriador_id` / `instalador_id` → `profissional_id`
- `instalacao_origem_id` / `vistoria_origem_id` → usar apenas o `id` do serviço

### Critérios de aceitação

1. Imprevisto registrado por vistoriador desatribui o serviço corretamente (verificável: `servicos.profissional_id` fica `null` após clique).
2. Realocação de instalação para outra rota/base atualiza `servicos.rota_id` e reflete no card de equipe (contador `tarefas_hoje_pendentes` diminui no profissional anterior, aumenta no novo).
3. `useRotas` retorna a mesma listagem de antes (sem regressão visual em `/rotas`).
4. Calendário de monitoramento exibe contagem unificada (sem duplicação ou ausência de itens que estão em `servicos`).
5. Sem warnings de TypeScript após renomeação/migração.

### Fora de escopo
- Drop das tabelas `instalacoes` e `vistorias` (fase futura).
- Migração dos 55 arquivos de relatório/dashboard histórico.
- Renomeação de páginas/rotas (`/rotas` continua como está).
- Backfill de dados antigos de `instalacoes`/`vistorias` para `servicos` (assumimos que dados novos já caem em `servicos`).

### Ordem de aprovação sugerida
- **Lote 1 isolado** (ImprevistoBotao + useRealocarInstalacao) — 2 arquivos, baixo risco, alto ganho operacional.
- **Lote 2** (useRotas) — em segundo momento, requer teste manual em `/rotas`.
- **Lote 3** (CalendarioDiaModal) — incremental, após confirmação dos lotes anteriores.

