

# IA perguntar sobre assistencia 24h apos comunicacao de sinistro

## Problema

Quando o associado comunica um sinistro via WhatsApp, a IA registra a solicitacao mas nao pergunta proativamente se o usuario precisa de reboque ou outro servico de assistencia 24h. O associado pode estar parado na rua precisando de guincho, por exemplo.

## Solucao

Atualizar o **system prompt do WhatsApp** (`WHATSAPP_SYSTEM_PROMPT`) para instruir a IA a:

1. Apos criar com sucesso uma solicitacao de sinistro (tool `criar_solicitacao_sinistro`), perguntar ao associado se ele precisa de algum servico de assistencia 24h (guincho, chaveiro, troca de pneu, etc.)
2. Se o associado responder que sim, coletar os dados necessarios (localizacao, tipo de servico) e chamar a tool `criar_solicitacao_assistencia` normalmente

Nenhuma nova tool ou tabela precisa ser criada -- a IA ja possui ambas as tools. Basta orientar o comportamento no prompt.

## Alteracao

| Arquivo | Descricao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar instrucao no WHATSAPP_SYSTEM_PROMPT para oferecer assistencia 24h apos sinistro |

### Detalhes tecnicos

No `WHATSAPP_SYSTEM_PROMPT` (linha 258), adicionar uma nova secao entre "Coleta de Dados para SINISTRO" e "Coleta de Dados para ASSISTENCIA 24H":

```
## POS-SINISTRO: OFERECER ASSISTENCIA 24H (OBRIGATORIO!)
Apos registrar um sinistro com sucesso (tool criar_solicitacao_sinistro retornou sucesso):
1. Confirme o registro do sinistro
2. SEMPRE pergunte: "Voce precisa de alguma assistencia agora? Guincho, reboque, chaveiro?"
3. Se o associado responder SIM:
   - Colete localizacao e tipo de servico
   - Use a tool criar_solicitacao_assistencia para abrir o chamado
4. Se responder NAO, encerre normalmente

IMPORTANTE: So ofereca assistencia se o veiculo tiver cobertura_total = true.
Se nao tiver, nao mencione assistencia 24h.
```

A IA ja sabe interpretar respostas do usuario e chamar tools automaticamente, entao nenhuma logica adicional de codigo e necessaria alem da instrucao no prompt.
