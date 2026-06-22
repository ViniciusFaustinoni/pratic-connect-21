# CLAUDE.md — Briefing permanente do projeto **Foco Ads**

> Este arquivo é o briefing de referência para qualquer trabalho de IA neste
> repositório relacionado ao **Foco Ads**. Leia-o antes de planejar ou implementar
> qualquer coisa. Ele consolida a visão, as regras de segurança, os guardrails de
> negócio e o roteiro por ondas.

---

## 1. Visão e direção

O **Foco Ads** evolui de um painel de leitura para uma **plataforma de gestão de
tráfego pago (Meta Ads + Google Ads) com IA**. Objetivo final: um **copiloto** que:

1. **PUXA** dados das plataformas de anúncios;
2. **ANALISA e CRITICA** o desempenho;
3. **SUGERE** melhorias; e
4. **EXECUTA** edições nas campanhas — **sempre sob aprovação humana**.

Este repositório (`ViniciusFaustinoni/pratic-connect-21`) é um sistema maduro de
gestão (proteção veicular) em **Vite + React + TypeScript + shadcn-ui + Tailwind**,
com backend em **Supabase** (Postgres + Edge Functions Deno) e IA via **Lovable AI
Gateway**. O Foco Ads é um **novo módulo** dentro desta base, e deve **reaproveitar**
a infraestrutura existente sempre que possível (ver seção 6).

---

## 2. Arquitetura em 4 camadas

| Camada | Papel | O que faz |
|---|---|---|
| **1. Ingestão** | Puxa dados | Coleta métricas de Meta e Google Ads (edge functions). |
| **2. Inteligência (IA)** | Analisa e critica | Detecta problemas, gera críticas e sugestões via Lovable AI Gateway. |
| **3. Recomendação** | Propõe | Apresenta cada sugestão como uma **"ação proposta"** que o usuário aprova ou rejeita. |
| **4. Execução** | Aplica | Aplica a mudança na plataforma (Meta/Google) **somente após aprovação**. |

---

## 3. ⚠️ Regra de Ouro (inegociável)

- **Nenhuma ação que gaste dinheiro ou altere campanhas ativas pode ser executada
  sem aprovação explícita do usuário.**
- Padrão fixo e único: **IA sugere → usuário aprova (1 clique) → sistema executa.**
- **Toda execução deve ser registrada em log de auditoria**: quem aprovou, o quê,
  quando, qual o resultado, e como desfazer (quando possível).
- Automações que agem sozinhas (ex.: pausar anúncio que estourou custo) **só
  existirão no futuro (Onda 5)**, com **flag explícita** e **sempre notificando** o
  usuário.

---

## 4. Regras de segurança

- **NUNCA** colocar tokens/secrets em código ou arquivos versionados. Ler sempre
  via ambiente (`Deno.env.get`) ou da tabela de integrações **criptografada**.
- O **token Meta tem permissão `ads_management`** (pode **ESCREVER / GASTAR**) —
  tratar como **credencial crítica**.
- **Frontend é público**: nada sensível nele (nenhum token, nenhuma service role key).
- **LGPD**: trabalhar **somente com métricas agregadas**. Não armazenar dados
  pessoais de leads.
- **Controle de acesso**: nem todo usuário pode executar ações de escrita. Prever
  **papéis** distintos — quem **só vê** vs. quem **aprova/executa**.

---

## 5. Guardrails de negócio

- Custo por **conversa (WhatsApp)** acima de **R$ 25 em 48h** → **sinalizar**.
- Custo por **lead (formulário)** acima de **R$ 30 em 48h** → **sinalizar**.
- Anúncio com status de erro (**`WITH_ISSUES`**) → **sinalizar**.
- A conta **mistura** conversas de WhatsApp (*messaging*) e leads de formulário —
  são **objetivos diferentes**: **não somar nem comparar cru**. Sempre segmentar por
  objetivo da campanha/conjunto.

---

## 6. Infraestrutura existente reutilizável (mapeamento)

> Antes de criar algo novo, verifique se já existe. O projeto já tem os primitivos
> exatos que o Foco Ads precisa.

| Necessidade | Já existe | Onde |
|---|---|---|
| **Gateway de IA** (Lovable/OpenAI/Anthropic, configurável, com fallback) | ✅ | `supabase/functions/_shared/ai-client.ts` (`callAI`, `getActiveAIConfig`) |
| **Config de modelo de IA** (provider/model global) | ✅ | tabelas `ai_model_config`, `ai_provider_keys`; UI em `src/pages/configuracoes/IntegracaoIA.tsx` |
| **Log de auditoria** (não-bloqueante, com fallback) | ✅ | `logs_auditoria` + `_shared/auditLog.ts` (`insertAuditLog`) |
| **Controle de acesso / papéis** | ✅ | `user_roles`, `app_roles_config`, RPC `has_permission`, `_shared/check-permission.ts` |
| **Credenciais criptografadas** (AES-256-GCM + PBKDF2) | ✅ | `integracoes_credenciais` + `_shared/credenciais-hibridas.ts`; UI em `src/pages/configuracoes/Integracoes.tsx` |
| **Padrão "solicitação IA → aprovação → execução"** | ✅ (análogo) | `solicitacoes_ia` + `supabase/functions/aprovar-solicitacao-ia/`, UI `src/pages/diretoria/SolicitacoesIA.tsx` |
| **Módulo de Marketing** (campanhas internas, canais, UTMs, origens de lead) | ✅ | `src/pages/marketing/*`, rotas em `src/App.tsx` (`/marketing/*`) |
| **Integração Meta (WhatsApp Cloud API)** | ✅ (≠ Ads) | `supabase/functions/whatsapp-meta-*` — **é mensageria, NÃO é Marketing API** |

### ⚠️ Discrepância importante a resolver com o time

O briefing menciona que **já existem** as edge functions `atualizar_metricas` (Meta)
e `atualizar_metricas_google_ads` (Google). **Elas NÃO estão versionadas neste
repositório** e **não há tabelas** de anúncios (`meta_ads`, `ads_account`,
`campanhas_meta`, `insights_meta` etc.). Hipóteses:

1. Existem só no projeto Supabase (criadas via Lovable) e **não sincronizadas ao git**; ou
2. **Ainda não existem** e a Onda 1 precisa criá-las do zero.

**Antes da Onda 2, confirmar qual é o caso.** Se (1), trazer o código para o git
antes de evoluir. Se (2), a Onda 1 (ingestão Meta) é pré-requisito real.

---

## 7. Roteiro por ondas

| Onda | Objetivo | Escreve em campanha? |
|---|---|---|
| **Onda 1** | Ligar **leitura Meta** (token `ads_management` em configuração). | Não (somente leitura) |
| **Onda 2** | **IA analista**: crítica + sugestões, **sem executar**. | Não |
| **Onda 3** | **Execução com aprovação** (pausar, ajustar verba, duplicar) na **Meta**. | Sim, **só após aprovação** |
| **Onda 4** | **Google Ads** no mesmo padrão. | Sim, **só após aprovação** |
| **Onda 5** | **Automações de guarda-corpo** (agem sozinhas, com flag + notificação). | Sim, com flag explícita |

**Foco: Meta primeiro. Google é Onda 4.**

---

## 8. Regras de trabalho (obrigatórias)

- **Confirme antes de qualquer commit.** Não commitar/push sem aprovação explícita.
- **Branch de desenvolvimento**: `claude/foco-ads-project-setup-m82wjs`.
- **Labels de UI em português.**
- **Foco em Meta primeiro** (Google é Onda 4).
- **Nunca exponha secrets** em nenhum arquivo versionado.
- Toda nova edge function de escrita na Meta deve: validar JWT → checar permissão
  (`has_permission`) → exigir registro de aprovação → executar → `insertAuditLog`.
- Métricas **sempre agregadas** (LGPD). Segmentar WhatsApp (messaging) vs. lead
  (formulário) — nunca somar cru.
