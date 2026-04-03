

# Atribuição Manual de Rotas

## Resumo

Adicionar uma configuração "Atribuição Manual de Rotas" na Gestão Comercial (renomeando "Instalação e Rotas" para "Vistorias") com toggle on/off. Quando ativada, o cron de atribuição automática é desabilitado e uma nova aba "Atribuição Manual" aparece como primeira aba em Serviços de Campo (Monitoramento), com drag-and-drop de tarefas para vistoriadores.

## Arquivos e Mudanças

### 1. Migration SQL — criar a configuração

Inserir `atribuicao_manual_rotas` na tabela `configuracoes` com valor `'false'`.

### 2. `src/components/gestao-comercial/InstalacaoRotasConfig.tsx`

- Renomear título da seção de "Instalação e Rotas" para "Vistorias"
- Adicionar chave `atribuicao_manual_rotas` no `CONFIG_CHAVES`
- Adicionar bloco Card no topo com Switch "Atribuição Manual de Rotas" + descrição explicando que desativa o motor automático
- State e save para o toggle

### 3. `src/components/gestao-comercial/TabNavigation.tsx`

- Renomear o item "Instalação e Rotas" / shortLabel "Instalação" para "Vistorias" / "Vistorias"

### 4. `src/pages/diretoria/GestaoComercial.tsx`

- Atualizar o banner `sectionBanners[5]` de "Instalação e Rotas" para "Vistorias"

### 5. `supabase/functions/cron-atribuir-tarefas/index.ts`

- Após o check de `fila_atribuicao_ativa`, adicionar check de `atribuicao_manual_rotas`:
  - Se `atribuicao_manual_rotas === 'true'`, retorna early com mensagem "Atribuição manual ativa — motor automático desligado"

### 6. `src/hooks/useAtribuicaoManual.ts` (novo)

- `useConfigAtribuicaoManual()`: lê `atribuicao_manual_rotas` da tabela `configuracoes`
- `useServicosParaAtribuir()`: busca serviços da tabela `servicos` com status `agendada` e sem `profissional_id`, incluindo dados do associado/veículo
- `useVistoriadoresAtivos()`: busca profiles com `em_servico = true` e papel de vistoriador, com localização e tarefa atual
- `useAtribuirServicoManual()`: mutation que atualiza `servicos.profissional_id`, status para `agendada`, e dispara o template WhatsApp via `supabase.functions.invoke('enviar-template-meta', ...)` (fluxo padrão existente)

### 7. `src/components/monitoramento/AtribuicaoManualTab.tsx` (novo)

Layout em 2 colunas:
- **Coluna esquerda**: lista de serviços pendentes (instalações + vistorias de todos os tipos), agrupados por data, filtráveis por tipo
- **Coluna direita**: cards dos vistoriadores ativos com seus serviços já atribuídos

Drag-and-drop usando `@dnd-kit/core` + `@dnd-kit/sortable`:
- Cada serviço pendente é um `Draggable`
- Cada card de vistoriador é um `Droppable`
- Ao soltar, abre confirmação rápida e executa a mutation de atribuição (seguindo fluxo padrão com template Meta)

### 8. `src/pages/monitoramento/VistoriasInstalacoesMon.tsx`

- Importar `useConfigAtribuicaoManual` e `AtribuicaoManualTab`
- Ler a configuração; se `atribuicao_manual_rotas === true`, adicionar aba "Atribuição Manual" com ícone `Hand` como **primeira aba** (defaultValue condicional)
- Se desativada, a aba não aparece

### 9. Instalar dependência

- `@dnd-kit/core` e `@dnd-kit/utilities` para drag-and-drop

## Fluxo de atribuição manual

1. Operador arrasta tarefa para card do vistoriador
2. Dialog de confirmação: "Atribuir [tipo] em [bairro] para [nome]?"
3. Ao confirmar:
   - `servicos.profissional_id = vistoriador.id`, `status = 'agendada'`
   - Invoca `enviar-template-meta` com template `servico_atribuido_v1` para o vistoriador
   - Toast de sucesso
4. Tarefa sai da lista de pendentes e aparece no card do vistoriador

## Impacto
- 1 migration (1 insert)
- 3 arquivos modificados (InstalacaoRotasConfig, VistoriasInstalacoesMon, cron-atribuir-tarefas, TabNavigation, GestaoComercial)
- 2 arquivos novos (hook + componente)
- 1 dependência npm nova (@dnd-kit/core)

