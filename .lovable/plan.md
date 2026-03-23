

# Plano: Templates Meta para Regua de Cobranca e Relacionamento

## Resumo

Cadastrar 14 templates de WhatsApp Meta na tabela `whatsapp_meta_templates` correspondentes a cada etapa da regua de relacionamento, atualizar a pagina ReguaCobranca para vincular templates Meta reais em vez de opcoes hardcoded, e configurar as etapas padrao da regua com os novos templates.

---

## PARTE 1 — Cadastro dos 14 Templates na tabela `whatsapp_meta_templates`

Inserir via migration os 14 templates com status `DRAFT`, categoria `UTILITY`, e variaveis de exemplo. Nomes seguindo convencao Meta (snake_case, sem acentos):

| Nome | Dias | Descricao curta |
|---|---|---|
| `boleto_gerado_v1` | Emissao | Boleto disponivel com PDF |
| `lembrete_desconto_v1` | D-6 | Desconto 5% ate amanha |
| `boleto_vence_hoje_v1` | D+0 | Vence hoje, veiculo desprotegido |
| `boleto_vencido_urgente_v1` | D+1 a D+4 | Boleto vencido, pague hoje |
| `ultimo_dia_sem_revistoria_v1` | D+5 | Ultimo dia sem revistoria |
| `impedimento_pagamento_v1` | D+6 | Revistoria necessaria |
| `reforco_contato_v1` | D+7 | Revistoria por fotos ou presencial |
| `urgencia_revistoria_v1` | D+8 | Solicitar retorno urgente |
| `alerta_retirada_v1` | D+9 | Possivel retirada rastreador |
| `ultima_tentativa_v1` | D+10 | Retirada se nao agendar |
| `aviso_negativacao_v1` | D+11 | Alerta SPC/Serasa em 5 dias |
| `debito_com_multa_v1` | D+12 | Multa R$400 + negativacao |
| `regularize_cadastro_v1` | D+13 | Ultimo aviso antes negativacao |
| `reativacao_protecao_v1` | D+14 e D+61 | Convite reativacao com opcoes |

Cada template tera:
- `corpo`: texto exato fornecido pela Julia, com variaveis no formato Meta `{{1}}`, `{{2}}`, etc.
- `variaveis_exemplo`: mapeamento `{"1": "João", "2": "Toyota Corolla", ...}`
- `rodape`: "ESSA MENSAGEM E AUTOMATICA. FAVOR NAO RESPONDER!" (quando aplicavel)
- `header_tipo`: `none` ou `text` conforme necessidade

**Nota sobre variaveis**: A Meta exige formato `{{1}}`, `{{2}}`. Os templates serao convertidos de `{nome}`, `{veiculos}` etc para `{{1}}`, `{{2}}`, `{{3}}` com mapeamento documentado em `variaveis_exemplo`.

---

## PARTE 2 — Atualizar ReguaCobranca.tsx

### 2a. Substituir lista hardcoded de templates

Remover o array `templates` estatico (linhas 34-41) e usar query dinamica na tabela `whatsapp_meta_templates` para popular o seletor de templates. Exibir nome + status (APPROVED/PENDING/DRAFT) como badge ao lado.

### 2b. Atualizar etapas padrao

Substituir `etapasPadrao` (linhas 43-52) por etapas alinhadas com a regua fornecida:

```text
D-6  → whatsapp → lembrete_desconto_v1
D+0  → whatsapp → boleto_vence_hoje_v1
D+1  → whatsapp → boleto_vencido_urgente_v1
D+2  → whatsapp → boleto_vencido_urgente_v1
D+3  → whatsapp → boleto_vencido_urgente_v1
D+4  → whatsapp → boleto_vencido_urgente_v1
D+5  → whatsapp → ultimo_dia_sem_revistoria_v1
D+6  → whatsapp → impedimento_pagamento_v1
D+7  → whatsapp → reforco_contato_v1
D+8  → whatsapp → urgencia_revistoria_v1
D+9  → whatsapp → alerta_retirada_v1
D+10 → whatsapp → ultima_tentativa_v1
D+11 → whatsapp → aviso_negativacao_v1
D+12 → whatsapp → debito_com_multa_v1
D+13 → whatsapp → regularize_cadastro_v1
D+14 → whatsapp → reativacao_protecao_v1
D+61 → whatsapp → reativacao_protecao_v1
```

### 2c. Badge de status do template

No seletor de template de cada etapa, exibir badge com o status Meta do template selecionado (verde=APPROVED, amarelo=PENDING, cinza=DRAFT, vermelho=REJECTED). Isso permite ao coordenador saber quais templates ja estao aprovados.

---

## PARTE 3 — Template do boleto gerado (envio com PDF)

O template `boleto_gerado_v1` e especial — e enviado no momento da geracao do boleto (fechamento mensal), nao pela regua. Registrar na tabela para que possa ser enviado para aprovacao da Meta e usado pelo `asaas-webhook` ou `FechamentoMensal`.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration (insert) | 14 registros em `whatsapp_meta_templates` |
| `src/pages/cobranca/ReguaCobranca.tsx` | Query templates Meta + etapas padrao atualizadas + badge status |

---

## Proximos passos apos aprovacao

Apos implementar, os templates ficam com status DRAFT. O operador devera:
1. Ir em Integracoes > WhatsApp > Templates Meta
2. Enviar cada template para aprovacao da Meta
3. Sincronizar para verificar status
4. Apos APPROVED, a regua pode executar automaticamente

