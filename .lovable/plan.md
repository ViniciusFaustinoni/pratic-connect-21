## Contexto e estado atual

A infraestrutura do link público já existe (tabela `vistoria_links`, página `/vistoria/:token`, edge functions de iniciar/concluir etapas, componente `VistoriaLinkBlock` na cotação). Mas **três peças estão faltando** para o fluxo descrito:

1. **Geração automática do link** ao concluir o agendamento (hoje só existe um botão manual "Gerar link" no card da cotação).
2. **Etapa de aprovação das fotos pelo monitoramento** entre Fotos → Instalação (hoje as duas etapas ficam liberadas em paralelo).
3. **Auto-atribuição do técnico ao logar** pelo botão "Realizar Instalação" + bloqueio com aviso quando já houver técnico atribuído.

---

## O que será feito

### 1. Geração automática do link no agendamento

- Em `agendar-vistoria-completa` e `agendar-vistoria-presencial` (edge functions), após criar a `instalacao`, chamar internamente a lógica de `gerar-link-vistoria-publica` (idempotente — já é seguro chamar de novo).
- Vale para os dois caminhos: **com auto-vistoria** (associado fez fotos sozinho) e **sem auto-vistoria** (vai precisar de técnico).
- O `VistoriaLinkBlock` já aparece automaticamente no `CotacaoDetalhesModal` assim que o link existe — nenhuma mudança de UI necessária aqui.

### 2. Aprovação de fotos no monitoramento (gating Fotos → Instalação)

**Banco** — adicionar à `vistoria_links`:
- `fotos_aprovadas_em` (timestamp, null)
- `fotos_aprovadas_por` (uuid, null) — profile do analista
- `fotos_reprovadas_em` (timestamp, null)
- `fotos_reprovadas_por` (uuid, null)
- `fotos_reprovacao_motivo` (text, null)

**Tela pública `/vistoria/:token`** — nova lógica de visibilidade dos botões:
- Botão "Realizar Fotos" visível enquanto `fotos_etapa_status != 'concluida'`.
- Após `concluida` → mostra estado "Fotos enviadas — aguardando aprovação do monitoramento" (sem botão de instalação).
- Após `fotos_aprovadas_em` definido → botão "Realizar Fotos" some, **botão "Realizar Instalação" acende**.
- Se `fotos_reprovadas_em` definido → reabre o botão de fotos com aviso do motivo.

**Tela do monitoramento** (`/monitoramento/vistorias` — `VistoriasInstalacoesMon.tsx`):
- Nova fila/aba "Fotos aguardando aprovação" listando vistoria_links com `fotos_etapa_status='concluida' AND fotos_aprovadas_em IS NULL`.
- Modal de revisão das fotos com botões **Aprovar** / **Reprovar (com motivo)**.
- Edge functions novas: `aprovar-fotos-vistoria-link` e `reprovar-fotos-vistoria-link`.

### 3. Botão "Realizar Instalação" — login + auto-atribuição + bloqueio

**Tela pública `/vistoria/:token`** — comportamento do botão:
- **Caso A — sem técnico atribuído** (`tecnico_atribuido_id IS NULL`): clique → redireciona para `/auth?redirect=/vistoria/{token}/assumir-instalacao`. Após login, rota intermediária chama uma edge function `assumir-instalacao-vistoria-link` que:
  - Valida que o usuário logado tem perfil de técnico/instalador.
  - Faz `update vistoria_links set tecnico_atribuido_id = auth.uid()` (com guarda de concorrência: só atualiza se ainda for null).
  - Vincula a instalação ao técnico (mesmo efeito do `AtribuirInstaladorDialog` atual).
  - Redireciona para a tela existente `/instalador/vistoria/:id` (que já é o fluxo de execução da instalação).
- **Caso B — já atribuído** (`tecnico_atribuido_id IS NOT NULL`): clique → exibe alerta com nome do técnico já atribuído, sem redirecionar para login. Mensagem: "Esta instalação já foi atribuída a {nome}. Procure o monitoramento se for necessário trocar."

### 4. Pós-instalação — fluxo SGA inalterado

Não muda nada aqui — o fluxo que já existe permanece:
- **Com auto-vistoria** (associado já passou pelo analista de cadastro): conclusão da instalação → ativa veículo → envia ao SGA automaticamente.
- **Sem auto-vistoria**: conclusão da instalação → cai na fila do analista de cadastro para aprovação → depois SGA.

A função `aplicar-conclusao-vistoria` (que dispara quando ambas etapas concluem) já cuida disso. Apenas confirmamos que ela continua sendo chamada corretamente após a etapa de instalação concluída pelo técnico logado.

---

## Detalhes técnicos

**Migration:**
```sql
ALTER TABLE vistoria_links
  ADD COLUMN fotos_aprovadas_em timestamptz,
  ADD COLUMN fotos_aprovadas_por uuid REFERENCES profiles(id),
  ADD COLUMN fotos_reprovadas_em timestamptz,
  ADD COLUMN fotos_reprovadas_por uuid REFERENCES profiles(id),
  ADD COLUMN fotos_reprovacao_motivo text;
```

**Edge functions novas:**
- `aprovar-fotos-vistoria-link` (auth obrigatória, valida role monitoramento/cadastro)
- `reprovar-fotos-vistoria-link` (idem, exige motivo)
- `assumir-instalacao-vistoria-link` (auth obrigatória, valida role técnico/instalador, update condicional para evitar race)

**Edge functions modificadas:**
- `agendar-vistoria-completa`: chamar lógica de geração de link após criar instalação.
- `agendar-vistoria-presencial`: idem.

**Frontend modificado:**
- `src/pages/public/VistoriaPublica.tsx` — `HomeEtapas`: nova lógica de visibilidade dos botões e handler do botão Instalação.
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` — nova aba/fila de aprovação de fotos + modal.
- `src/hooks/useVistoriaLinkPublica.ts` — novos hooks `useAprovarFotosVistoria`, `useReprovarFotosVistoria`, `useAssumirInstalacaoVistoria` + tipos atualizados.
- Nova rota `/vistoria/:token/assumir-instalacao` (página fina que chama a edge function e redireciona).

**Sem impacto em:** `AtribuirInstaladorDialog` (continua existindo para atribuição manual pelo monitoramento), fluxo SGA, fluxo do analista de cadastro.

---

## Pontos para você confirmar

- **Quem aprova as fotos no monitoramento?** Vou liberar para os papéis `monitoramento`, `coordenador_monitoramento` e `analista_cadastro`. Ok?
- **Reprovação:** ao reprovar, devo apagar as fotos antigas do storage ou manter histórico para auditoria? (sugestão: manter, apenas resetar `fotos_etapa_status='pendente'` para o link aceitar novo envio).