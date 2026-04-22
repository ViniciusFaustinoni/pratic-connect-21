

## Corrigir realocação quando "Atribuição Manual" está ativa

### Problema identificado

No `RealocarInstalacaoDialog`, quando o modo **Atribuição Manual** está ativado:

1. O aviso azul diz: *"o serviço entrará na fila de atribuição para você designar o instalador no mapa"* — mas a UI ainda **exige** que se escolha uma rota existente (ou se crie uma nova).
2. O botão **"Realocar para esta rota"** fica desabilitado por `(!criandoRota && !rotaId)` mesmo no modo manual — então o usuário preenche data/período/motivo e não consegue submeter.
3. Mesmo se forçar uma rota, o `useRealocarInstalacao.realocarParaRota` envia `instaladorId: null` (correto) mas mantém `rota_id` setado — o que **tira o serviço da fila de atribuição manual** (a fila lista serviços com `profissional_id IS NULL` e sem rota efetiva atribuída ao mapa).

Resultado: realocar em modo manual não funciona como prometido pelo aviso.

### O que vou fazer

**1. `src/components/instalacoes/RealocarInstalacaoDialog.tsx`** — único arquivo alterado

Quando `manualAtiva === true` na aba **Rota**:
- **Esconder** o seletor de rota, o botão "Criar nova rota" e o seletor de instalador (já está oculto, OK).
- Mostrar apenas: **Data**, **Período**, **Motivo da realocação** e **Notificar por WhatsApp**.
- Atualizar o aviso para deixar claro: *"O serviço será reagendado para a data/período escolhidos e entrará na fila de Atribuição Manual. Você designará o instalador depois pelo mapa."*
- Remover do `disabled` do botão a obrigatoriedade de `rotaId`/`criandoRota` quando manual está ativo. O botão passa a depender apenas de `motivoRota.trim()` + data + período.
- Renomear o label do botão para **"Reagendar e enviar para fila"** quando manual está ativo (mantém "Realocar para esta rota" no modo automático).

Quando `manualAtiva === false`: comportamento atual permanece igual (rota obrigatória, instalador opcional).

**2. `src/hooks/useRealocarInstalacao.ts`** — leve ajuste em `realocarParaRota`

Adicionar suporte para `rotaId: null` (modo manual). Quando `rotaId === null`:
- `update.rota_id = null`
- `update.profissional_id = null`
- Mantém `status = 'agendada'`, atualiza `data_agendada` e `periodo`
- Histórico registra como "enviada para fila de atribuição manual"

Isso garante que o serviço apareça em `useServicosParaAtribuir` (filtro: `profissional_id IS NULL` + `status IN ('pendente','agendada')` + `data_agendada >= hoje`) — exatamente onde o gestor o pegará no mapa/aba de atribuição manual.

**3. Tipos**

Atualizar `RealocarParaRotaParams.rotaId` para `string | null` no hook.

### Fora do escopo
- Aba **Base** não muda (ela não depende de rota).
- Não toco no fluxo do mapa nem na tabela `agendamentos_base`.
- Sem alteração de schema do banco (campos `rota_id` e `profissional_id` já são nullable em `servicos`).

### Como testar (após aprovação)
1. Logar como diretor (`admin@teste.com`), ativar **Atribuição Manual** em Configurações.
2. Em `/monitoramento/vistorias-instalacoes-mon`, abrir uma instalação agendada → clicar **Realocar**.
3. Confirmar que aparecem só Data + Período + Motivo (sem seletor de rota/instalador).
4. Reagendar para amanhã, manhã, com motivo "teste" → verificar toast de sucesso.
5. Ir na aba **Atribuição Manual** → o serviço deve aparecer na fila com a nova data/período.
6. Desativar atribuição manual → reabrir o diálogo de realocar → confirmar que o seletor de rota volta a aparecer (comportamento antigo preservado).

