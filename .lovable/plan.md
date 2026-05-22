# Aba "Veículos Suspensos" em Serviços de Campo

## Objetivo

Em `/monitoramento/vistorias-instalacoes-mon` adicionar nova aba **Veículos Suspensos** listando veículos cuja cobertura de Roubo & Furto foi suspensa por falta de instalação no prazo, e permitir que o Coordenador de Monitoramento execute internamente a vistoria/instalação (mesmo botão e mesmo fluxo já criado em `RealizarVistoriaInternaButton`).

## Critério de inclusão

Veículo aparece na aba quando:
- `veiculos.cobertura_suspensa = true`
- `veiculos.cobertura_suspensa_motivo` casa com prazos de instalação (ILIKE `%não realizada%`, `%não instalou no prazo%`, `%Recusa do instalador%`)
- veículo não está cancelado/inativo (`status NOT IN ('cancelado','inativo')`)

Não aparecem: suspensões por sub-FIPE autovistoria incompleta, suspensões por inadimplência, suspensões manuais por outros motivos.

## UI

**1. Nova `<TabsTrigger value="suspensos">`** em `VistoriasInstalacoesMon.tsx` (após "Serviços"), com ícone `ShieldOff` e badge contando suspensos. Visível para todos os perfis que já acessam a página; ações restritas (ver abaixo).

**2. Novo componente** `src/pages/monitoramento/VeiculosSuspensosTab.tsx`:
- Card por veículo: placa, modelo, associado, motivo da suspensão, data da suspensão (`cobertura_suspensa_em` + "há X dias"), badge do plano.
- Coluna "Última instalação/serviço" mostrando se já existe `instalacao`/`servico` aberto vinculado (para o Coordenador decidir).
- Busca por placa/nome/CPF e ordenação por dias suspenso (desc default).
- Ação principal: botão **"Realizar Vistoria Interna"** (reusa `RealizarVistoriaInternaButton`).

**3. Novo hook** `src/hooks/useVeiculosSuspensos.ts` — query agregando `veiculos` + `contratos` + `associados` + último `servico`/`instalacao` aberto.

## Execução da vistoria interna

Mesma regra do trabalho anterior: só `coordenador_monitoramento`, `diretor`, `admin_master`, `desenvolvedor` veem o botão.

Dois casos:

- **Caso A — já existe serviço aberto** (`servicos` em `agendada`/`atribuida`/`em_andamento` para o veículo): botão reusa o serviço existente, abre `/instalador/instalacao/:servicoId` (rota já habilitada no `InstaladorGuard`). Mesma trilha de auditoria já implementada.

- **Caso B — não há serviço aberto**: botão chama nova edge function `abrir-servico-instalacao-suspenso` que:
  1. Valida role (coordenador_monitoramento + superusers) com `has_role`
  2. Localiza ou cria `instalacoes` vinculada ao veículo/contrato com `data_agendada = now()`, `status = 'agendada'`, `tipo = 'instalacao'`
  3. Cria `servicos` (`tipo='instalacao'`, `status='agendada'`, `instalacao_origem_id`) com `profissional_id = auth.uid()` para liberar o fluxo do instalador
  4. Loga em `logs_auditoria` (`acao='abrir_servico_vistoria_interna_suspenso'`)
  5. Retorna `servico_id` para o front navegar para `/instalador/instalacao/:servicoId` em nova aba

A conclusão pelo Coordenador segue o caminho canônico já existente (`concluir-instalacao-prestador`), que ao finalizar dispara `fn_reativar_cobertura_pos_instalacao` (trigger já existente) — religando R&F e tirando o veículo da fila automaticamente.

## Permissões e auditoria

- Aba visível para todos os perfis com acesso à página (apenas leitura).
- Botão "Realizar Vistoria Interna" só renderiza para `coordenador_monitoramento` + superusers (mesma checagem do componente atual).
- Toda abertura grava em `logs_auditoria` com placa, veiculo_id, motivo da suspensão.

## Arquivos

**Criar:**
- `src/hooks/useVeiculosSuspensos.ts`
- `src/pages/monitoramento/VeiculosSuspensosTab.tsx`
- `supabase/functions/abrir-servico-instalacao-suspenso/index.ts`

**Editar:**
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` (nova tab + badge de contagem)
- `src/components/servicos-campo/RealizarVistoriaInternaButton.tsx` (aceitar `veiculoId` opcional → chama edge para abrir serviço quando não houver um)

**Sem migration de schema** — colunas e triggers já existem. Edge function nova precisa ser registrada em `supabase/config.toml`.

## Fora de escopo

- Não mexe nos critérios de suspensão automática (cron já existente em produção).
- Não altera o fluxo do técnico externo nem do prestador.
- Não exibe suspensões por sub-FIPE/inadimplência nesta aba (têm fluxos próprios).
