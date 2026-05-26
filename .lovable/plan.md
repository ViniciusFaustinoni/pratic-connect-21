# Substituir `d1_a_d4_boleto_vencido_v1` por `_v2`

Mesma mecânica usada em `emissao_boleto_gerado_v3` e `d_6_lembrete_desconto_v2`:
cria nova versão PENDING, desativa v1 via flag canônica e aponta callers.

## 1. Novo template Meta

`d1_a_d4_boleto_vencido_v2` — `UTILITY` / `pt_BR`, sem header / footer / botões.

Corpo (variáveis `{{1}}=nome`, `{{2}}=vencimento`):

```
SEU BOLETO ESTÁ VENCIDO!! 🚨🚨🚨

Bom dia Sr(a) {{1}}, tudo bem?

Seu boleto venceu em {{2}}.

Corra e efetue o pagamento ainda hoje, para que não seja necessário a realização da revistoria!

LEMBRANDO QUE O SEU VEÍCULO JÁ SE ENCONTRA DESPROTEGIDO! 🗣️😞

SEGUE O CÓDIGO DE BARRAS ATUALIZADO!

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.
```

Observação: a frase final do brief ("SEGUE O CÓDIGO DE BARRAS ATUALIZADO!") é mantida como texto fixo — o template **não** carrega linha digitável (mesma forma da v1). A linha digitável continua sendo enviada na sequência por outro template/fluxo, como já é hoje. Nenhuma `{{3}}` é introduzida.

## 2. Migração SQL

- `INSERT` em `whatsapp_meta_templates` com `nome='d1_a_d4_boleto_vencido_v2'`, `status='PENDING'`, `disparo_habilitado=true`, `variaveis_exemplo={"1":"João","2":"20/03/2026"}`.
- `UPDATE whatsapp_meta_templates SET disparo_habilitado=false WHERE nome='d1_a_d4_boleto_vencido_v1'` (gate canônico — não muda status Meta, preserva histórico).

## 3. Submissão Meta

Chamar `whatsapp-submit-template` para `d1_a_d4_boleto_vencido_v2`.

## 4. Callers a atualizar

Apontar de `_v1` para `_v2` e **corrigir bug existente**: hoje os dois callers passam apenas `['nome']`, mas o corpo tem `{{2}}=vencimento`. Atualizar para `['nome','vencimento']`.

- `src/lib/cobranca/templateParams.ts:36` — `d1_a_d4_boleto_vencido_v2: ['nome','vencimento']`
- `supabase/functions/executar-regua-cobranca/index.ts:49` — idem
- `src/pages/cobranca/ReguaCobranca.tsx:47-50` — trocar `template: 'd1_a_d4_boleto_vencido_v1'` por `_v2` nos 4 presets D+1..D+4
- `src/lib/whatsapp/template-catalog.ts` — marcar v1 como `deprecated: 'Use d1_a_d4_boleto_vencido_v2.'` e adicionar entry `_v2` (mesmos campos, sem deprecated)

## 5. Garantias

- Enquanto v2 está PENDING, gate `disparo_habilitado=false` em v1 bloqueia o envio antigo; quando Meta aprovar v2, os callers já apontam para ela e o disparo retoma com o conteúdo novo.
- Se Meta atrasar e for preciso voltar temporariamente para v1, basta reativar `disparo_habilitado=true` na v1 via tela `Configurações › Integrações › WhatsApp`.
- Mensagens já enviadas com v1 permanecem íntegras.
