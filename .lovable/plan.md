## Situação atual

Na cotação pública (`src/components/cotacao-publica/EtapaVistoria.tsx`) o primeiro nível mostra **2 cards**:

1. Autovistoria
2. Agendar Vistoria Presencial → abre tela intermediária `EscolhaLocalVistoria` com:
   - Quero que o técnico venha até mim (rota) → `AgendamentoCotacao`
   - Quero levar meu veículo à Base (base) → `EscolhaBase` → `AgendamentoBase`

A 3ª opção (Base) **já está implementada e funcional** — só está aninhada dentro de "Agendar". O ajuste é UX/nomenclatura: promover para o primeiro nível e renomear Autovistoria.

## Mudanças

### 1. `EtapaVistoria.tsx` — 3 cards no primeiro nível

Substituir os 2 botões atuais por 3 cards diretos, respeitando o filtro `tipoInstalacao` (definido pelo consultor na cotação):

- **Card 1 — "Autovistoria - Roubo & Furto"** (badge "Recomendado", ícone Camera)
  - Ação: `setModo('autovistoria')`
  - Texto: "Tire fotos do veículo agora pelo celular. Disponível para planos com cobertura de Roubo & Furto."
- **Card 2 — "Quero que o técnico venha até mim"** (ícone Home)
  - Ação direta: `setModo('agendada')` (sem passar pela tela intermediária)
  - Texto: "Um técnico vai até seu endereço realizar a vistoria/instalação."
  - Oculto se `tipoInstalacao === 'base'`.
- **Card 3 — "Quero levar meu veículo à Base"** (ícone Building2) — NOVO no nível 1
  - Ação direta: `setModo('escolha-base')`
  - Mostra mini-resumo (endereço/horário) reutilizando `useConfiguracaoBase` (mesma fonte usada hoje em `EscolhaLocalVistoria`).
  - Oculto se `tipoInstalacao === 'rota'`.

A tela intermediária `EscolhaLocalVistoria` deixa de ser acionada (modo `escolha-local` vira código morto; pode ser removido com segurança, ou mantido caso queiramos reaproveitar). Plano: **remover** o branch `escolha-local` de `EtapaVistoria.tsx` e excluir o componente `EscolhaLocalVistoria.tsx` se não houver outro consumidor (validar com `rg`).

### 2. Nomenclatura (apenas labels — sem alterar enum no banco)

`tipo_vistoria` continua salvo como `autovistoria | agendada | agendada_base`. Atualizar somente os textos exibidos:

- `EtapaVistoria.tsx` (resumo read-only): "Autovistoria realizada" → "Autovistoria - Roubo & Furto realizada".
- `src/components/associado/EscolhaVistoria.tsx` (linha 94): "Autovistoria" → "Autovistoria - Roubo & Furto".
- `src/components/associado/ConfirmacaoVistoria.tsx` (linha 273): "Autovistoria Enviada" → "Autovistoria - Roubo & Furto Enviada".
- `src/components/associado/AgendamentoInstalacaoContrato.tsx` (linha 238): "Autovistoria Aprovada" → "Autovistoria - Roubo & Furto Aprovada".
- `src/pages/vendas/ContratoDetalhe.tsx` (linhas 151 e 703): "Autovistoria" → "Autovistoria - Roubo & Furto".

### 3. Validação funcional (após implementar)

Login como diretor (`admin@teste.com`) e percorrer no preview:

1. Cotação com plano com Roubo & Furto, sem `tipo_instalacao` definido → 3 cards aparecem.
2. Clicar **Card 1** → fluxo `AutovistoriaCotacao` conclui, `cotacoes.tipo_vistoria = 'autovistoria'`.
3. Clicar **Card 2** → `AgendamentoCotacao` agenda, `tipo_vistoria = 'agendada'`, instalação criada via edge `agendar-vistoria-presencial`.
4. Clicar **Card 3** → `EscolhaBase` lista bases, `AgendamentoBase` confirma, `tipo_vistoria = 'agendada_base'`.
5. Cotação com `tipo_instalacao = 'rota'` → Card 3 some.
6. Cotação com `tipo_instalacao = 'base'` → Card 2 some.
7. Reabrir a cotação após concluída → resumo read-only correto para os 3 tipos.
8. Conferir telas de proposta (`PropostaApprovalStepper`, `ContratoDetalhe`) exibindo a nova nomenclatura.

Sem migração de banco. Sem alterações em edge functions, hooks de mutation ou triggers.

## Arquivos afetados

- `src/components/cotacao-publica/EtapaVistoria.tsx` (principal — 3 cards + remoção do branch `escolha-local`)
- `src/components/cotacao-publica/EscolhaLocalVistoria.tsx` (remover se sem outros consumidores)
- `src/components/associado/EscolhaVistoria.tsx` (label)
- `src/components/associado/ConfirmacaoVistoria.tsx` (label)
- `src/components/associado/AgendamentoInstalacaoContrato.tsx` (label)
- `src/pages/vendas/ContratoDetalhe.tsx` (label)
