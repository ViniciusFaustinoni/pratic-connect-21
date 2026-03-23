

# Plano: Corrigir Variáveis e Renomear Templates com Dias

## Problema 1 — Variável no fim do corpo

Apenas `boleto_gerado_v1` ainda termina com `{{6}}`. O `lembrete_desconto_v1` já foi corrigido (já tem o rodapé).

## Problema 2 — Nomes sem indicação de dia

Os nomes atuais não mostram em que dia da régua cada template é usado, dificultando a visualização.

---

## Correções

### 1. Fix corpo do `boleto_gerado_v1`

Adicionar após `{{6}}`:
```
{{6}}

ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!
```

### 2. Renomear todos os 14 templates

| Nome atual | Novo nome |
|---|---|
| `boleto_gerado_v1` | `emissao_boleto_gerado_v1` |
| `lembrete_desconto_v1` | `d_6_lembrete_desconto_v1` |
| `boleto_vence_hoje_v1` | `d0_boleto_vence_hoje_v1` |
| `boleto_vencido_urgente_v1` | `d1_a_d4_boleto_vencido_v1` |
| `ultimo_dia_sem_revistoria_v1` | `d5_ultimo_dia_sem_revistoria_v1` |
| `impedimento_pagamento_v1` | `d6_impedimento_pagamento_v1` |
| `reforco_contato_v1` | `d7_reforco_contato_v1` |
| `urgencia_revistoria_v1` | `d8_urgencia_revistoria_v1` |
| `alerta_retirada_v1` | `d9_alerta_retirada_v1` |
| `ultima_tentativa_v1` | `d10_ultima_tentativa_v1` |
| `aviso_negativacao_v1` | `d11_aviso_negativacao_v1` |
| `debito_com_multa_v1` | `d12_debito_com_multa_v1` |
| `regularize_cadastro_v1` | `d13_regularize_cadastro_v1` |
| `reativacao_protecao_v1` | `d14_d61_reativacao_protecao_v1` |

Convenção: `d` + número do dia + `_` + nome descritivo. Para D-6 usa `d_6` (underline no lugar do menos). Para emissão (sem dia fixo na régua), usa `emissao_`.

### 3. Atualizar `ReguaCobranca.tsx`

Atualizar os nomes dos templates no array `etapasPadrao` para refletir os novos nomes.

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| DB (UPDATE) | Renomear 14 templates + fix corpo do `boleto_gerado_v1` |
| `src/pages/cobranca/ReguaCobranca.tsx` | Atualizar nomes em `etapasPadrao` |

