## Objetivo

Substituir o corpo do template Meta `d_6_lembrete_desconto_v1` pelo novo conteúdo (manchete de urgência + linha digitável). Como o v1 já está APPROVED na Meta, replicamos o padrão usado em `emissao_boleto_gerado_v3`: **criar `d_6_lembrete_desconto_v2`** com o novo corpo e **desativar o v1** via `disparo_habilitado=false` (gate canônico, sem mexer no status Meta — ver `mem://logic/integrations/whatsapp-template-disparo-toggle`).

As variáveis continuam as mesmas (`{{1}}=nome`, `{{2}}=vencimento`, `{{3}}=linha_digitavel`), então nenhum caller precisa mudar a montagem do array de parâmetros — só trocar o nome do template.

## Conteúdo do v2

```
O PRAZO PARA DESCONTO DE 5% É ATÉ AMANHÃ!! NÃO PERCA! 🤩🚨

Bom dia Sr(a) {{1}}, tudo bem? Passando para informar que o seu boleto vence em {{2}} e o(a) Sr(a) consegue efetuar o PAGAMENTO COM 5% DE DESCONTO ATÉ AMANHÃ

Estou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇

{{3}}

Atenciosamente, Praticcar 💙❤️
```

Categoria `UTILITY`, idioma `pt_BR`, sem header/footer/botões (igual ao v1).

## Mudanças

### 1. Migration SQL
- `INSERT` em `whatsapp_meta_templates` com `nome='d_6_lembrete_desconto_v2'`, `status='PENDING'`, `disparo_habilitado=true`, `variaveis_exemplo` com 3 valores de exemplo.
- `UPDATE whatsapp_meta_templates SET disparo_habilitado=false WHERE nome='d_6_lembrete_desconto_v1'`.

### 2. Submissão à Meta
Chamar `whatsapp-submit-template` com `template_name='d_6_lembrete_desconto_v2'` para enviar para aprovação (edge function existente).

### 3. Atualizar os 4 callers de v1 → v2 (mesmas 3 vars)

- `supabase/functions/executar-regua-cobranca/index.ts` (linha 47 — mapa interno duplicado)
- `src/lib/cobranca/templateParams.ts` (linha 34 — `TEMPLATE_PARAMS_MAP`)
- `src/lib/whatsapp/template-catalog.ts` (linha 133 — marcar v1 como `DESCONTINUADO — migrado para v2` e adicionar entrada v2)
- `src/pages/cobranca/ReguaCobranca.tsx` (linha 45 — preset default da régua D-6)

### 4. CSV / outras réguas
Não há outros callers. Templates `cobranca_inadimplencia_pratic` e `emissao_boleto_gerado_v3` não são afetados.

## Garantias

- Enquanto v2 está PENDING, o gate `disparo_habilitado` no `whatsapp-send-text` bloqueia v1, evitando que o conteúdo antigo continue saindo.
- Quando v2 for APPROVED pela Meta, os callers já apontam para ele — não precisa de novo deploy.
- Histórico em `whatsapp_messages` permanece íntegro (v1 não é deletado).
- Se a Meta demorar para aprovar v2 e o time precisar enviar o D-6 nesse intervalo, basta reativar `disparo_habilitado=true` em v1 pela UI temporariamente.
