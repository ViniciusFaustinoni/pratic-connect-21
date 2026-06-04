## Objetivo

Deixar **uma única IA** ativa no sistema — a IA de FAQ/Atendimento — sem nome próprio ("Atendimento Pratic"), atendendo **todas as audiências** (lead, associado, diretor). Vinicius/Vendas fica desligado mas preservado em código para reativação futura. Toda a configuração passa a viver em **/relacionamento/config-ia**.

---

## 1. Banco — desligar Vendas e neutralizar Relacionamento

Migration de UPDATE em `ia_habilidades`:

- `slug='vendas'` → `ativa=false` (NÃO deletar; preserva persona/conhecimento p/ futuro)
- `slug='relacionamento'`:
  - `nome_exibicao` = "Atendimento Pratic"
  - `nome_agente` = "Atendimento Pratic"
  - `audiencias_elegiveis` = `['lead','associado','diretor']` (passa a cobrir lead também)
  - `persona`/`saudacao_inicial`/`regras_absolutas` → varredura e substituição de "Maya" por "Atendimento Pratic" (ou remover menção ao nome quando ficar redundante)
  - `horario_atendimento` = null (24/7, igual hoje p/ associado/diretor) — leads também sem gate de horário, como pedido ("agir como IA de suporte")

Sem mexer em `maya_ia_*` / `agente_ia_config` (já marcadas deprecated).

## 2. Roteador (`supabase/functions/agente-consultor-ia/lib/roteador.ts`)

Já é audiência→habilidade ativa. Com `relacionamento` cobrindo as 3 audiências e `vendas` desativada, lead cai automaticamente em "relacionamento". **Sem alteração de código** — só validar com log `[habilidade_selecionada=relacionamento]` para mensagens de lead.

## 3. Gate fora-horário Vinicius

Hoje há gate "Seg–Sex 08–18 BRT aplica APENAS a LEAD/Vinicius" no agente. Como Vinicius está off e Atendimento Pratic atende lead 24/7, esse gate deve ser **neutralizado** (remover branch específica de lead/vinicius no `agente-consultor-ia/index.ts`). Memória core será atualizada.

## 4. Rota e UI — `/relacionamento/config-ia`

Reescrever `src/pages/relacionamento/MayaIA.tsx` → renomear arquivo para `ConfigIA.tsx` (e atualizar import em `App.tsx`). A nova página é **um editor único** para a habilidade `relacionamento`, reaproveitando os hooks `useIAHabilidades`/`useIAConhecimento`/`useIAExemplos` (novos, canônicos).

Estrutura:

- Header "Configuração da IA de Atendimento" + toggle global (liga/desliga habilidade)
- Tabs: **Identidade & Regras** | **Conhecimento (FAQ)** | **Exemplos** | **Ferramentas**
- Sem qualquer string "Maya" / "Vinicius" / "Vendas" na tela
- Sem seletor de audiência (a habilidade já cobre todas)

Layout aproveita o que já existe em `src/pages/configuracoes/IAHabilidades.tsx` (formulário + listas), simplificado para 1 habilidade fixa (slug='relacionamento').

## 5. Remover atalho em Configurações › Integrações › IA

Em `src/pages/configuracoes/IntegracaoIA.tsx`, **remover** o `<Card>` "Habilidades da IA" que linkava para `/configuracoes/integracoes/ia/habilidades`. Manter apenas AIModelConfigCard + OcrEngineConfigCard + Alert.

A rota `/configuracoes/integracoes/ia/habilidades` e o arquivo `src/pages/configuracoes/IAHabilidades.tsx` ficam **removidos do App.tsx** (rota deletada) — config IA vive só no Relacionamento.

## 6. Limpeza de menções "Maya" na UI

Varredura de strings visíveis ao usuário:

- `src/components/eventos/chat-ia/ContatoDetalheDrawer.tsx` → texto "IA pausada" sem mencionar Maya (já está OK; só validar)
- Qualquer label/título visível que diga "Maya" em telas de chat/eventos → "Atendimento Pratic" ou "IA"
- Mensagens de pausa/encerramento mantidas (não citam Maya)

Logs internos (`[maya_config]`, `[maya_mensagem_pausada]`, tipos de notificação) **não mudam** nesta fase — são chaves técnicas, troca posterior se quiser.

## 7. Memórias

- Atualizar core (memória de habilidades) refletindo: 1 habilidade ativa (`relacionamento` = "Atendimento Pratic", cobre lead+associado+diretor 24/7); Vendas desativada; gate fora-horário removido; UI canônica em `/relacionamento/config-ia`
- Marcar `mem://logic/operations/maya-saudacao-e-identificacao-canonica` como vigente com nome novo
- Atualizar `mem://logic/ia/habilidades-canonicas` com nova UI canônica

---

## Arquivos tocados (resumo técnico)

```text
migration       UPDATE ia_habilidades (vendas ativa=false; relacionamento renomeado + audiências)
edited          supabase/functions/agente-consultor-ia/index.ts  (remover gate fora-horário lead/Vinicius)
renamed         src/pages/relacionamento/MayaIA.tsx → ConfigIA.tsx (reescrito com hooks ia_habilidades)
edited          src/App.tsx  (import novo nome, remove rota /configuracoes/integracoes/ia/habilidades)
edited          src/pages/configuracoes/IntegracaoIA.tsx  (remove card Habilidades)
deleted         src/pages/configuracoes/IAHabilidades.tsx
varredura       strings "Maya" visíveis ao usuário → "Atendimento Pratic"
memórias        index.md (core) + habilidades-canonicas + saudacao-canonica
```

## O que NÃO faço

- Não apago tabelas `maya_ia_*` nem `ia_habilidades` row de vendas (preservadas para reativação)
- Não mudo chaves técnicas internas (`maya_config`, `whatsapp_ia_pausas.motivo`, tipos de notificação)
- Não toco no fluxo de cotação/sub-FIPE (assunto não relacionado)
