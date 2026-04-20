

## Equipe de Monitoramento — Tabs e drill-down de serviços

### Mudanças

#### 1. Duas abas dentro de "Equipe"
Substituir o grid único por sub-abas baseadas no `role` do `user_roles`:

- **Instaladores** → profissionais com role `instalador_vistoriador` (executam vistorias/instalações em campo).
- **Administrativo** → todos os demais perfis ligados ao monitoramento que **não são** instaladores: `analista_monitoramento`, `coordenador_monitoramento` e quaisquer outros papéis administrativos do módulo.

A aba "Plantões" existente permanece intacta como aba irmã. Filtros, métricas e busca passam a operar sobre a lista da aba ativa. Contadores `(N)` ficam ao lado do nome de cada aba.

#### 2. Click no card → modal "Serviços Atribuídos"
Adicionar handler `onClick` ao corpo do `EquipeCard` (preservando que cliques no menu `⋮` e no botão "Relatório" não disparam o drill-down via `stopPropagation`).

Abre um novo modal `ServicosAtribuidosModal` com **comportamento dependente do tipo**:

- **Card de Instalador** → lista todos os serviços atribuídos a **ele mesmo** (agendada, em_rota, em_andamento, concluída, nao_compareceu, reagendada). Colunas: Data/hora, Tipo, Associado, Veículo/placa, Bairro, Status, link "Abrir".
- **Card Administrativo** → lista todos os serviços atribuídos **a qualquer instalador**, agrupados por técnico (nome do instalador como cabeçalho, com avatar/iniciais). É a visão de monitoramento "ver todos os serviços com os técnicos". Mesmas colunas + coluna **Técnico**.

Filtros do modal: período (Hoje / 7 dias / 30 dias / Todos), status (todos / agendada / em andamento / concluída / nao_compareceu) e busca por associado/placa.

### Arquivos editados

- `src/pages/monitoramento/Equipe.tsx` — sub-abas Instaladores/Administrativo dentro da aba "Equipe", contagem por aba, filtragem por role.
- `src/hooks/useEquipe.ts` — incluir `role` (`instalador_vistoriador` | `analista_monitoramento` | demais) no objeto `ProfissionalEquipe` para permitir o split.
- `src/components/equipe/EquipeCard.tsx` — `onClick` no card + prop `onVerServicos`; `stopPropagation` no menu `⋮` e no botão "Relatório".
- **Novo** `src/components/monitoramento/ServicosAtribuidosModal.tsx` — modal com lista/agrupamento conforme o tipo do profissional.
- **Novo** `src/hooks/useServicosAtribuidos.ts` — query parametrizada: por `profissional_id` (instalador) **ou** todos os serviços de instaladores ativos (modo administrativo), com filtros de período/status/busca.

### Validação
1. Aba "Instaladores" mostra apenas profissionais com role `instalador_vistoriador`; "Administrativo" mostra os demais (analistas, coordenadores).
2. Contadores `(N)` em cada sub-aba batem com o total filtrado.
3. Clicar em card de instalador abre modal só com os serviços dele.
4. Clicar em card administrativo abre modal com todos os serviços de todos os instaladores, agrupados por técnico.
5. Cliques em "Editar/Desativar/Relatório" continuam funcionando sem abrir o modal de serviços.
6. Filtros (período, status, busca) funcionam em ambos os modos do modal.
7. Aba "Plantões" continua acessível e inalterada.

