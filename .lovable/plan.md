## Objetivo

Substituir o conteúdo do template Meta `emissao_boleto_gerado_v2` pelo novo texto (sem citar o modelo do veículo, mantendo só a placa). Como o template já está APPROVED na Meta e em uso por 5 callers, a forma segura é **criar `emissao_boleto_gerado_v3`** e **desativar o v2** (sem deletá-lo, preservando histórico).

## Nota sobre variáveis

O texto enviado pelo usuário usa `{{1}}`, `{{3}}`, `{{4}}`, `{{5}}`, `{{6}}` (pulando `{{2}}`, que era o modelo). A Meta **não aprova templates com variáveis não-sequenciais** — exige `{{1}}..{{N}}` contínuos. Vou renumerar no template registrado para `{{1}}..{{5}}` mantendo a mesma ordem semântica:

- `{{1}}` = nome
- `{{2}}` = placa
- `{{3}}` = vencimento
- `{{4}}` = valor
- `{{5}}` = linha digitável

Conteúdo exato gravado:

```
Olá {{1}}, aqui é da PRATIC CAR, tudo bem? 😊

Estamos enviando o boleto QUE JÁ ESTÁ disponível, referente a proteção do veículo:
Placa: {{2}}

Com vencimento em: {{3}}

No valor de: {{4}}.

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.

Estou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇

{{5}}
```

Categoria `UTILITY`, idioma `pt_BR`, sem header, sem footer, sem botões (igual ao v2). Rodapé "ESSA MENSAGEM É AUTOMÁTICA..." removido conforme texto novo.

## Mudanças

### 1. Migration SQL
- `INSERT` em `whatsapp_meta_templates` com `nome='emissao_boleto_gerado_v3'`, `status='PENDING'`, `disparo_habilitado=true`, `variaveis_exemplo` com os 5 valores de exemplo.
- `UPDATE whatsapp_meta_templates SET disparo_habilitado=false WHERE nome='emissao_boleto_gerado_v2'` — respeita o gate canônico `disparo_habilitado` (mem://logic/integrations/whatsapp-template-disparo-toggle) sem mexer no status Meta.

### 2. Submissão à Meta
Após a migration, chamar `whatsapp-submit-template` com `template_name='emissao_boleto_gerado_v3'` para registrar/aprovar na Meta. (Edge function já existente, sem alteração.)

### 3. Atualizar os 5 callers de v2 → v3 (5 vars em vez de 6)

Remover o `modelo` do array `variables` em:

- `src/pages/financeiro/CobrancasList.tsx` (envio em massa manual)
- `supabase/functions/disparar-boletos-lote/index.ts`
- `supabase/functions/enviar-lembretes-vencimento/index.ts`
- `supabase/functions/gerar-cobrancas-mensais/index.ts`
- `supabase/functions/gerar-faturas-mensais/index.ts`

Atualizar `template_name` para `emissao_boleto_gerado_v3` e ajustar comentários de docs (`vars: [nome, placa, vencimento, valor, linha_digitavel]`).

### 4. Catálogo
`src/lib/whatsapp/template-catalog.ts`: marcar `emissao_boleto_gerado_v2` como `DESCONTINUADO — migrado para emissao_boleto_gerado_v3` e adicionar entrada para `emissao_boleto_gerado_v3`.

### 5. CSV de cobrança (separado)
`disparar-cobranca-csv-meta` usa template `cobranca_inadimplencia_pratic` (não é o v2) — **não tocar**.

## Garantias

- Nenhum disparo em produção quebra: enquanto v3 está PENDING, o gate `disparo_habilitado` no `whatsapp-send-text` impede que v2 dispare; quando v3 for aprovado pela Meta, callers já apontam para ele.
- Caso o usuário queira liberar v2 temporariamente até v3 aprovar, basta reativar `disparo_habilitado=true` em v2 pela UI.
- Histórico de envios anteriores em `whatsapp_messages` permanece íntegro (v2 não é deletado).
