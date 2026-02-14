

# Correcoes: Link 2, Pagamento, ASAAS, Autentique e Gatilho Duplo

## 5 Correcoes a Implementar

### Correcao 1 — Exibir data do evento e mensagem "aprovado" na pagina de pagamento

**Arquivo:** `src/pages/public/EventoPosAprovacao.tsx`

Adicionar entre o header e o card de informacoes:
- Texto "Seu evento foi aprovado!" com icone CheckCircle2 verde
- No card de informacoes, nova linha exibindo `sinistro.data_ocorrencia` formatada

### Correcao 2 — Parcelas com valores reais do ASAAS

**Nenhuma correcao necessaria.** O frontend ja exibe disclaimer "Valores aproximados". O ASAAS aplica os juros reais no momento do pagamento. Manter como esta.

### Correcao 3 — Adicionar `pagamento_confirmado` e `reprovado` ao statusConfig

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Adicionar ao objeto `statusConfig` (linha 62):

```text
pagamento_confirmado: { label: 'Pag. Confirmado', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800 border-red-300' },
```

### Correcao 4 — Card de status do pagamento e termo na area administrativa

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Na secao de acoes (coluna direita, apos o bloco `pronto_para_oficina` e antes do bloco `em_analise || aprovado`), adicionar tratamento para `pagamento_confirmado`:

- Exibir card verde "Pagamento confirmado -- aguardando assinatura do termo"
- Exibir data/hora do pagamento (`sinistro.cota_paga_em`)
- Exibir valor pago (do campo `cota`)

### Correcao 5 — Mensagem WhatsApp na aprovacao corrigida

**Arquivo:** `supabase/functions/analisar-evento/index.ts`

Linha 177: alterar mensagem de "assinar o Termo de Entrada" para "efetuar o pagamento da cota de coparticipacao e assinar o Termo de Entrada".

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/pages/public/EventoPosAprovacao.tsx` -- mensagem aprovado + data do evento |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` -- statusConfig + card pagamento_confirmado |
| Modificar | `supabase/functions/analisar-evento/index.ts` -- texto WhatsApp corrigido |

