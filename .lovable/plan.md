# Vistoria Interna em Modal (Coordenador de Monitoramento)

Hoje os botões "Realizar Vistoria Interna" (aba **Veículos Suspensos** e card de serviço em **Serviços de Campo**) fazem `window.open('/instalador/instalacao/:id')`, levando o Coordenador para o app do instalador em outra aba.

O pedido é manter **exatamente a mesma tela** (mesmas etapas, campos, textos, fotos, vídeo, checklist e decisão), mas exibida em um **modal full-screen** dentro do contexto do Monitoramento.

## O que vai mudar

### 1. Refatoração mínima de `src/pages/instalador/InstaladorChecklist.tsx`

A página hoje lê `id` de `useParams` e chama `navigate('/instalador')` em ~6 pontos (sucesso, erro, voltar). Vou torná-la **embedável**:

- Adicionar props opcionais: `servicoIdProp?: string` e `onClose?: () => void`.
- `const id = servicoIdProp ?? params.id`.
- Criar `const exitToList = () => onClose ? onClose() : navigate('/instalador')` e substituir as 6 ocorrências de `navigate('/instalador')` por `exitToList()`.
- Nenhuma mudança visual, de etapa, de texto ou de lógica de negócio. A rota `/instalador/instalacao/:id` continua funcionando idêntica para o técnico.

### 2. Novo componente `src/components/monitoramento/VistoriaInternaDialog.tsx`

- `Dialog` do shadcn com `DialogContent` em modo full-screen (`max-w-none w-screen h-screen p-0 overflow-y-auto bg-slate-900`) para acomodar a UI escura do instalador.
- Renderiza `<InstaladorChecklist servicoIdProp={servicoId} onClose={() => onOpenChange(false)} />`.
- Botão "fechar" do Dialog no canto superior direito (sobreposto ao header existente).
- Invalida queries de Monitoramento ao fechar (`servicos-campo`, `veiculos-suspensos-instalacao`, `instalacoes-aguardando-aprovacao-monitoramento`) para refletir a conclusão imediatamente na lista.

### 3. `RealizarVistoriaInternaButton.tsx` (Serviços de Campo)

- Substituir `window.open(...)` por estado local `[dialogOpen, setDialogOpen]` e abrir `<VistoriaInternaDialog servicoId={servico.id} ... />`.
- Guard de permissão (Coordenador/Diretor) permanece igual.
- Auditoria (`registrarLog`) permanece igual.

### 4. `VeiculosSuspensosTab.tsx` (aba Veículos Suspensos)

- `VeiculoCard` ganha estado local para o dialog.
- Caso A (serviço aberto já existe): abre o Dialog direto com `servico_aberto.id`.
- Caso B (sem serviço): chama a edge `abrir-servico-instalacao-suspenso` como hoje, mas em vez de `window.open`, guarda o `servicoId` retornado e abre o Dialog.
- Toda a lógica de motivos/permissão/listagem permanece igual.

## O que NÃO muda

- A página `InstaladorChecklist` continua sendo a mesma tela usada pelo técnico em `/instalador/instalacao/:id` — mesmos hooks, mesmas mutations, mesma chamada à edge `concluir-instalacao-tecnico` (e portanto mesmos triggers DB de religar cobertura, mover para fila de Aprovação de Associados, etc.).
- Nenhuma mudança em edge functions, no hook `useVeiculosSuspensos`, em permissões ou em fluxo de negócio.
- Nada relativo ao app PWA do instalador é alterado.

## Arquivos

- editar `src/pages/instalador/InstaladorChecklist.tsx` (props opcionais + helper `exitToList`)
- criar `src/components/monitoramento/VistoriaInternaDialog.tsx`
- editar `src/components/servicos-campo/RealizarVistoriaInternaButton.tsx`
- editar `src/pages/monitoramento/VeiculosSuspensosTab.tsx`
