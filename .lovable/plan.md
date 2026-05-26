## Substituir `d5_ultimo_dia_sem_revistoria_v1` por `_v2`

Mesma mecânica já aplicada em `emissao_boleto_gerado_v3`, `d_6_lembrete_desconto_v2` e `d1_a_d4_boleto_vencido_v2`.

### ⚠️ Ponto que precisa de confirmação

O texto enviado começa com **"SHOJE SERÁ O ÚLTIMO DIA..."** — parece typo de **"HOJE"** (o "S" sobrou da quebra de linha anterior). Vou assumir **"HOJE SERÁ O ÚLTIMO DIA..."** no template. Se for pra manter literal "SHOJE", me avisa antes de aprovar.

### 1. Novo template Meta

`d5_ultimo_dia_sem_revistoria_v2` — `UTILITY` / `pt_BR`, sem header/footer/botões.

Corpo (1 variável `{{1}}=vencimento`, mesma assinatura da v1):

```
HOJE SERÁ O ÚLTIMO DIA PARA EFETUAR O PAGAMENTO SEM A REVISTORIA! ⚠️

🚨🚗🛵

Corra e efetue o PAGAMENTO ATÉ HOJE SEM A REALIZAÇÃO DA REVISTORIA!!!

😱😨

(Lembrando que o seu vencimento foi {{1}}.)

Seu veículo permanece desprotegido, corra e efetue o pagamento hoje mesmo! ✅

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.

SEGUE O CÓDIGO DE BARRAS ATUALIZADO ❗
```

A linha digitável **não** entra no template (igual à v1) — segue sendo enviada por outro template/fluxo. Nenhuma `{{2}}` introduzida.

### 2. Migração SQL

- `INSERT` em `whatsapp_meta_templates` com `nome='d5_ultimo_dia_sem_revistoria_v2'`, `status='PENDING'`, `disparo_habilitado=true`, `variaveis_exemplo={"1":"20/03/2026"}`.
- `UPDATE whatsapp_meta_templates SET disparo_habilitado=false WHERE nome='d5_ultimo_dia_sem_revistoria_v1'` (gate canônico — não muda status Meta, preserva histórico).

### 3. Submissão Meta

Chamar `whatsapp-submit-template` com `template_name='d5_ultimo_dia_sem_revistoria_v2'` e `force_recreate: true`.

### 4. Callers a atualizar (apontar v1 → v2)

- `src/lib/cobranca/templateParams.ts:37` — renomear chave para `d5_ultimo_dia_sem_revistoria_v2: ['vencimento']`
- `supabase/functions/executar-regua-cobranca/index.ts` — mesma troca de chave no map inline
- `src/pages/cobranca/ReguaCobranca.tsx` — trocar preset D+5 de `_v1` para `_v2`
- `src/lib/whatsapp/template-catalog.ts` — marcar `_v1` como `deprecated: 'Use d5_ultimo_dia_sem_revistoria_v2.'` e adicionar entry `_v2`

### 5. Garantias

- Enquanto v2 está PENDING, gate `disparo_habilitado=false` em v1 bloqueia envio do conteúdo antigo; quando Meta aprovar v2, os callers já apontam pra ela.
- Rollback temporário: reativar `disparo_habilitado=true` na v1 em Configurações › Integrações › WhatsApp.
- Mensagens já enviadas com v1 permanecem íntegras.
