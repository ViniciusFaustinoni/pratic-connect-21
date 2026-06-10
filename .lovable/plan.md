# Bug confirmado — Fagner (+55 21 97605-5231) em 10/06

## O que aconteceu (cronologia real, fuso UTC)

| Hora | Direção | Conteúdo |
|---|---|---|
| 13:13:26 | entrada | "Bom dia" |
| 13:13:35 | saída (IA) | Saudação canônica pedindo CPF |
| 13:15:50 | entrada | `12400583730` (CPF) |
| 13:16:12 | DB | `cpf_capturado_em` + `nome_confirmado_em` + `sga_associado_status=ativo` + `nome=FAGNER LUIZ DA SILVA` gravados |
| 13:16:14 | saída (IA) | "Encontrei você, Fagner! Em que posso te ajudar hoje?" |
| 13:16:56 | entrada | "Preciso atualizar o meu app" |
| 13:17:02 | entrada | "Como faço?" |
| 13:17:07 | saída (IA) | Resposta correta sobre o app |
| **13:17:12** | **saída (IA)** | **"Olá! Tudo bem? Sou Atendimento Praticcar… Como ainda não tenho seus dados salvos por aqui, poderia me informar seu *nome completo* ou *CPF*…"** |

A última saída é exatamente o print do operador. **Já havia CPF, nome e status SGA carimbados há 1 minuto** — a IA simplesmente repetiu a abertura de identificação.

## Por que aconteceu

Hoje a defesa contra "ressaudar / repedir identidade" está espalhada e não cobre o caso de mensagem-resposta dentro do mesmo dia:

1. `gate_saudacao_horas` na habilidade `relacionamento` está em **2h** (default). Funciona pra saudação pura, mas não impede a LLM de re-pedir CPF dentro da janela.
2. O bloco `2C — Supressão de saudação cerimoniosa` só atua quando a mensagem é uma saudação pura (`"oi"`, `"bom dia"`…). "Como faço?" não casa o regex, então nenhum bloco anti-ressaudação foi injetado no system prompt dessa rodada.
3. O system prompt do path ASSOCIADO (linha 1595) tem regras de "não cumprimentar pelo primeiro nome", mas **não tem uma trava explícita "não peça nome nem CPF — já confirmados nesta sessão"**. Sem essa trava, a LLM (Gemini) reabriu a apresentação por conta própria.
4. Bônus: o bloco `RECONFIRMAÇÃO LEVE` (linha 765) considera identidade "fresca" se passou <2h OU mesmo dia BRT. Pedido do usuário é alinhar tudo numa janela única de **1 dia**.

## O que vou alterar (raiz, depois saneamento)

### Fase 1 — Raiz (sem mexer no resto do fluxo)

**1.1 Janela canônica de identidade = 24h, configurável por habilidade.**
- Migration: setar `ia_habilidades.gate_saudacao_horas = 24` para slug `relacionamento` (default da coluna permanece 2).
- `gate_saudacao_aplicar_identificados` segue `true`.

**1.2 Nova trava "IDENTIDADE JÁ CONFIRMADA" no system prompt do path ASSOCIADO** (`supabase/functions/agente-consultor-ia/index.ts`, branch `else if (isAssociado)` linha 1593).
- Quando `cpf_capturado_em` OU `nome_confirmado_em` aconteceu nas últimas 24h (ou mesmo dia BRT), injeta bloco:
  ```
  ## IDENTIDADE JÁ CONFIRMADA NESTA SESSÃO
  Este contato JÁ está identificado como {nome} (CPF {…}, status SGA {…}), confirmado em {hh:mm}.
  - PROIBIDO pedir CPF, nome completo, "para localizar seu cadastro" ou qualquer reapresentação.
  - PROIBIDO reabrir com "Olá! Sou Atendimento Praticcar…", "Como ainda não tenho seus dados…".
  - Vá direto ao pedido do cliente.
  ```
- Mesma trava no path LEAD (linha 1797) quando o contato tem `nome_confirmado_em` nas últimas 24h (caso lead já tenha sido identificado por nome) — só para evitar a regressão simétrica, sem alterar o resto do prompt de lead.

**1.3 Ampliar `identidadeFresca` (linha 765) para usar `habCfg.gate_saudacao_horas`** em vez do literal `< 2`.
- Hoje: `horasDesdeReconf < 2 || horasDesdeUltima < 2 || mesmo dia BRT`.
- Depois: `horasDesdeReconf < gate || horasDesdeUltima < gate || mesmo dia BRT`.
- Efeito: reconfirmação leve não dispara dentro da janela canônica configurada.

**1.4 Memory.**
- Atualizar `mem://logic/ia/saudacao-config-driven` (gate = 24h em relacionamento) e criar `mem://logic/ia/identidade-confirmada-trava-prompt` documentando o bloco injetado.

### Fase 2 — Saneamento pontual (após Fase 1 no ar)

- Não há sanitização de dados a fazer no contato do Fagner: identidade está correta no DB. O bug foi só de saída.
- Validação no preview: enviar 2 mensagens seguidas do Fagner (ou mock) → confirmar que IA não ressolicita CPF/nome.

## Fora de escopo (não vou tocar)

- Roteador de habilidades, `loadHabilidadeContent`, prompt da habilidade `vendas`, kill-switch global, regras de transbordo, tools, FAQ.
- Reset de identidade por divergência (linha 673) — segue intacto.
- Habilidade `vendas` (gate continua 2h, está desativada).

## Arquivos previstos

- `supabase/migrations/<novo>.sql` — `UPDATE ia_habilidades SET gate_saudacao_horas = 24 WHERE slug = 'relacionamento'`.
- `supabase/functions/agente-consultor-ia/index.ts` — bloco "IDENTIDADE JÁ CONFIRMADA" + `identidadeFresca` parametrizado.
- `.lovable/memories/logic/ia/saudacao-config-driven.md` (update) e `.lovable/memories/logic/ia/identidade-confirmada-trava-prompt.md` (novo).

## Pergunta antes de implementar

Confirma 24h como janela única? Se preferir outro valor (ex.: 12h, 8h "expediente"), me diz que ajusto a migration — o resto do código fica config-driven.
