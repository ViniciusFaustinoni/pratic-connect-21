

## Realocar instalação não realizada (no drawer + mapa)

### Problema
Quando a instalação não acontece (status `nao_compareceu`, `reagendada`, `cancelada` ou `agendada` sem instalador) o veículo cai num limbo: o drawer de detalhes só permite mudar o status, sem opção de mover para outra rota nem para uma base. Exemplo: Marcos (placa QXV0H02) está com status `nao_compareceu` e `rota_id=null`, sem ação possível.

### Solução — botão **"Realocar serviço"** no drawer de instalação + atalho no mapa
Visível para perfil **Coordenador de Monitoramento** (e Diretor) sempre que `status ∈ {agendada, nao_compareceu, reagendada, cancelada}`. Abre um modal com 2 abas:

**Aba 1 — Mover para uma Rota**
- Combo "Data" (default = hoje, mín = hoje)
- Combo "Rota" listando rotas daquele dia (`useRotasDoDia`) com nome, instalador e contagem de serviços. Opção "Criar nova rota" abre um campo simples de nome/cidade e cria via insert em `rotas` antes de atribuir.
- Combo opcional "Instalador" (preenchido automaticamente pelo instalador da rota; editável).
- Combo opcional "Novo horário" (`hora_agendada`).
- Campo "Motivo da realocação" (obrigatório).
- Checkbox "Notificar associado por WhatsApp" (default ON).

Ação: `update instalacoes set rota_id, instalador_id, data_agendada, hora_agendada, status='agendada' where id = ?`. Registra em `instalacoes_historico` (ou tabela equivalente) e dispara WhatsApp ao associado quando marcado.

**Aba 2 — Mover para uma Base (oficina)**
- Combo "Base" listando oficinas Pratic (`useBasesPratic`).
- Combo "Data" e "Horário".
- Campo "Motivo" (obrigatório).
- Checkbox "Notificar associado por WhatsApp" (default ON, mensagem padrão "Compareça à base X em ...").

Ação: cria registro em `agendamentos_base` (`instalacao_id`, `oficina_id`, `data_agendada`, `horario`, `cliente_nome`, `cliente_telefone`, `veiculo_placa`, `veiculo_descricao`, `status='confirmado'`) e atualiza `instalacoes` para `status='agendada'` + `rota_id=null` + `local_vistoria='base'`. Histórico + WhatsApp como acima.

### Pontos de entrada
1. **Drawer `InstalacaoDetailDrawer.tsx`** (Serviços de Campo > Instalações): adicionar botão "Realocar serviço" na seção Ações, ao lado de "Reagendar" e "Não Compareceu". Ícone `MapPinned`.
2. **Mapa de Atribuições (`MapaVistoriasContent.tsx`)**: no popup do pin de uma instalação sem instalador atribuído ou com status problemático, adicionar botão "Realocar" que abre o mesmo modal.

### Permissões / RLS
Reutilizar policies existentes (`canManageInstalacoes` / `canManageEquipeEstoque`). Coordenador de Monitoramento já tem acesso (memo `monitoring-coordinator-permissions`). Sem nova policy.

### Banco de dados
Sem migração de schema. Apenas escritas em tabelas existentes:
- `instalacoes` (update)
- `agendamentos_base` (insert quando aba Base)
- `rotas` (insert quando criar rota nova)
- `instalacoes_historico` (insert para auditoria — verificar nome real e ajustar se necessário)

### Arquivos a criar/alterar
- **Novo:** `src/components/instalacoes/RealocarInstalacaoDialog.tsx` — modal com as 2 abas.
- **Novo:** `src/hooks/useRealocarInstalacao.ts` — `useMutation` com 2 funções: `realocarParaRota` e `realocarParaBase`, ambas registrando histórico e disparando WhatsApp opcional via `whatsapp-send-text`.
- **Editar:** `src/components/instalacoes/InstalacaoDetailDrawer.tsx` — botão "Realocar serviço" na seção Ações.
- **Editar:** `src/components/mapa/MapaVistoriasContent.tsx` — botão "Realocar" no popup da instalação sem dono / em limbo.

### Validação pós-deploy
1. Abrir Marcos Vinicius (QXV0H02, status `nao_compareceu`) em Serviços de Campo > Instalações → drawer mostra botão "Realocar serviço".
2. Mover para Rota → status volta para `agendada`, `rota_id` e `instalador_id` preenchidos, WhatsApp enviado, instalação aparece na rota selecionada.
3. Mover para Base → registro criado em `agendamentos_base`, instalação aparece em "Vistoria na Base" do técnico daquela oficina.
4. Reabrir o drawer → status mostra "Agendada" e bloco mostra a nova rota/base.
5. No Mapa de Atribuições, o pin azul desse veículo agora reflete a nova alocação.
6. Conferir entrada em `instalacoes_historico` com tipo "realocada" e motivo digitado.
7. Mobile 400px → modal responsivo, abas empilháveis.

### Pergunta antes de implementar
Quando o veículo é movido para uma **base**, a instalação original em `instalacoes` deve:
- (A) Permanecer como `agendada` mas com `local_vistoria='base'` e linkar via `agendamentos_base.instalacao_id` (sem duplicação) — **recomendado**.
- (B) Ser marcada como `cancelada` e o agendamento na base passa a ser a fonte de verdade.
- (C) Outro comportamento.

Aguardo essa decisão para finalizar a aba Base — as demais partes do plano não dependem dela.

