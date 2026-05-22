## Objetivo

Permitir que o **Coordenador de Monitoramento** execute manualmente uma vistoria/instalação a partir de um serviço de campo — anexando fotos, vídeo 360°, dados do rastreador e concluindo — usando exatamente as mesmas telas e o mesmo caminho de conclusão de um técnico, sem duplicar lógica.

## Princípios

- **Zero retrabalho**: reusar `InstaladorChecklist` (instalação/vistoria_entrada), `ExecutarVistoriaCompleta` (vistoria sem instalação), `ExecutarRetirada` e `ExecutarManutencao` — exatamente como o técnico vê.
- **Conclusão idêntica à do técnico**: nenhuma edge function nova, nenhum trigger novo. A finalização passa pelas mesmas mutations/edges que hoje fecham serviço de técnico (mesmas regras de cadastro→R/F, mesmos guards DB, mesma fila de aprovação no Monitoramento).
- **Acesso restrito**: somente `coordenador_monitoramento` (e Diretor, por padrão de superuser). Outros papéis nem veem o botão nem conseguem acessar a rota.

## Entradas (botão "Realizar Vistoria Interna")

1. **Header do `ServicoDetailModal`** (`src/components/servicos-campo/ServicoDetailModal.tsx`), na mesma linha de Realocar/Cancelar/Devolver, com ícone `ClipboardCheck`.
2. **Card do serviço** na aba "Atribuição Manual" e na tabela "Serviços" do painel `/monitoramento/vistorias-instalacoes-mon` — pequeno botão/ícone no rodapé do card.

Ambos só renderizam quando `usePermissions().isCoordenadorMonitoramento === true` (Diretor herda por ser superuser). Para serviços já em status terminal (`concluida`, `aprovada`, `reprovada`, `aprovada_ressalvas`, `cancelada`) o botão fica escondido.

## Rota interna

Nova rota dentro do app principal (não dentro de `InstaladorLayout` — esse é mobile-only do técnico):

```
/monitoramento/executar/:servicoId
```

A página resolve o `servico` por id, decide qual sub-tela renderizar com base em `servico.tipo`:

- `instalacao` ou `vistoria_entrada` → `<InstaladorChecklist />`
- `vistoria` / `revistoria` / `vistoria_saida` / `vistoria_periodica` / `vistoria_sinistro` / `vistoria_cancelamento` → `<ExecutarVistoriaCompleta />`
- `vistoria_retirada` → `<ExecutarRetirada />`
- `manutencao` → `<ExecutarManutencao />`

Guard de rota: `CoordenadorMonitoramentoGuard` (composição simples sobre `usePermissions` + redirect para `/acesso-negado`).

## Como reusar as telas do técnico sem quebrar a validação "este serviço é meu?"

Hoje `InstaladorChecklist` e `ExecutarVistoriaCompleta` assumem que `servico.profissional_id === profile.id` (a tela é renderizada a partir das "minhas tarefas" do técnico). Para o Coordenador:

- **Não vamos** atribuir o serviço ao Coordenador (poluiria histórico e métricas de produtividade dos técnicos).
- Vamos passar um **flag de contexto** `modoInterno: true` (via React Context `ExecucaoServicoContext` ou prop) que diz à tela:
  - Bypass na checagem `servico.profissional_id === profile.id`.
  - O campo "executado_por" gravado nas mutations de conclusão usa o `profile.id` do Coordenador, com `executado_modo='monitoramento_interno'` para auditoria.
  - O label "Técnico responsável" exibido na tela troca para "Coordenador (vistoria interna)".

Todo o resto (uploads para `vistoria_fotos`, vídeo 360°, leitura/atribuição de rastreador, fechamento de `servicos` + `instalacoes`, trigger `trg_sync_agendamento_base_on_servico_terminal`, guards Cadastro→R/F, fila de Aprovação de Associados) **permanece intocado** — é o mesmo caminho do técnico.

## Auditoria

Em cada mutation de conclusão chamada por essa rota, gravar em `auditoria_acoes` (tabela já existente) com:
- `acao = 'vistoria_interna_coordenador'`
- `usuario_id = profile.id` do coordenador
- `entidade = 'servicos'`, `entidade_id = servico.id`
- payload com `tipo_servico`, `placa`, `associado_id`

Isso garante rastreabilidade sem misturar com produtividade do técnico.

## Pontos que NÃO mudam (importantes para não regredir)

- Edges `concluir-instalacao-prestador`, `concluir-vistoria-prestador`, `concluir-retirada` — sem alteração.
- Triggers DB de pós-conclusão (`trg_guard_*`, religamento de cobertura, fila de aprovação) — sem alteração.
- Memórias `[vistoria_entrada ≡ instalacao]`, `[Cadastro escopo canônico]`, `[Vistoria nunca órfã]`, `[Atribuição prestador status sync]`, `[Um serviço canônico por origem]` continuam valendo.
- Conclusão pelo Coordenador **NÃO** pula a fila de Aprovação de Associados — segue para o Monitoramento normal (mesmo que quem executou tenha sido o próprio Monitoramento; a aprovação final continua sendo um passo separado e auditável).

## Arquivos a tocar (resumo)

```text
NOVO  src/components/auth/CoordenadorMonitoramentoGuard.tsx
NOVO  src/pages/monitoramento/ExecutarServicoInterno.tsx     ← roteia por tipo
NOVO  src/contexts/ExecucaoServicoContext.tsx                ← flag modoInterno
EDIT  src/App.tsx                                            ← registra /monitoramento/executar/:servicoId
EDIT  src/components/servicos-campo/ServicoDetailModal.tsx   ← botão no header
EDIT  src/components/servicos-campo/ServicosTable.tsx        ← atalho no row/card
EDIT  src/pages/monitoramento/VistoriasInstalacoesMon.tsx (aba Atribuição Manual) ← atalho no card
EDIT  src/pages/instalador/InstaladorChecklist.tsx           ← consome modoInterno do context
EDIT  src/pages/instalador/ExecutarVistoriaCompleta.tsx      ← idem
EDIT  src/pages/instalador/ExecutarRetirada.tsx              ← idem
EDIT  src/pages/instalador/ExecutarManutencao.tsx            ← idem
```

Sem migração de banco. Sem edge function nova. Sem mudança nos triggers.

## QA mínimo antes de fechar

1. Coordenador abre serviço `instalacao` pendente → clica "Realizar Vistoria Interna" → tela do checklist do técnico abre → sobe fotos + vídeo + dados do rastreador → conclui. Resultado esperado: `servicos.status='concluida'`, `instalacoes.status='concluida'`, `vistorias` + `vistoria_fotos` materializados, serviço aparece na fila "Aprovação de Associados", auditoria registrada.
2. Mesmo fluxo para `vistoria_entrada` sem rastreador (sub-FIPE) → checklist 31/15 fotos + vídeo → conclui → cai em `aguardando_aprovacao_monitoramento` (sem ativar cobertura), conforme memória `[Vistoria sem rastreador]`.
3. Usuário com role só de "analista_monitoramento" não vê botão e recebe 403 ao acessar a rota direto.
4. Profissional/técnico atribuído original continua vendo o serviço normalmente (não é alterada a atribuição).
