---
name: identidade-confirmada-trava-prompt
description: Bloco "IDENTIDADE JÁ CONFIRMADA" injetado no system prompt do agente-consultor-ia para impedir a LLM de re-pedir CPF/nome no mesmo dia. Janela = gate_saudacao_horas da habilidade (Relacionamento=24h).
type: feature
---

# Trava anti-reidentificação no agente-consultor-ia

## Problema canônico
A LLM (Gemini) ocasionalmente reabre a conversa pedindo "nome completo ou CPF" mesmo quando o contato já está identificado (cpf_capturado_em ou nome_confirmado_em preenchido). Os gates do edge funcionam corretamente — quem desobedece é a geração. Caso Fagner LSilva/+5521976055231 em 10/06/26: identificado às 13:16, IA repetiu apresentação às 13:17:12.

## Regra
Em `supabase/functions/agente-consultor-ia/index.ts`, após `suprimirSaudacaoCerimonia`, sempre que:
- `jaIdentificado === true` (cpf OU nome_confirmado_em), e
- não há `contextoAgendamentoPendente`, e
- a última identificação (`max(cpf_capturado_em, nome_confirmado_em)`) está dentro de `habCfg.gate_saudacao_horas` **OU** no mesmo dia BRT,

o edge **anexa ao systemPrompt** o bloco:

```
## IDENTIDADE JÁ CONFIRMADA NESTA SESSÃO
O contato JÁ está identificado como *<primeiroNome>* (CPF <mascarado>), confirmado hoje às HH:MM (janela canônica de Nh).
- PROIBIDO pedir CPF, nome completo, "informe seu nome ou CPF", "para localizar seu cadastro", "como ainda não tenho seus dados salvos por aqui".
- PROIBIDO reabrir a conversa com "Olá! Tudo bem? Sou Atendimento Praticcar…" ou repetir a saudação inicial.
- Vá direto ao pedido do cliente.
```

Log: `[agente-consultor-ia] [trava_identidade] bloco IDENTIDADE_JA_CONFIRMADA injetado (gate=Nh, h_desde_ident=...)`.

## Por que o janelamento canônico = `gate_saudacao_horas`
Mesma configuração que controla "não ressaudar". Para a habilidade `relacionamento`, esse gate foi elevado para **24h** (migration 10/06/26) — atende o pedido "perguntar uma vez por dia".

## Adicionalmente
A função `identidadeFresca` no bloco `RECONFIRMAÇÃO LEVE` (linha ~765) agora usa o mesmo `gate_saudacao_horas` em vez do literal `< 2`, mantendo todas as janelas canônicas alinhadas.

## Não toca
- Roteador de habilidades / loadHabilidadeContent
- Gate de identificação não-identificado (path lead/CPF)
- Tools, FAQ, transbordo, kill-switch
