# Sistema de Notificacoes de Cobranca e Regua Automatica

## Status: IMPLEMENTADO ✅

### O que foi feito:

1. **Edge function `disparar-boletos-lote`** — Disparo em lote de WhatsApp + Email após emissão, processando em lotes de 10 com delay de 1s
2. **Ajuste D-5** — `enviar-lembretes-vencimento` agora usa `[5, 1, 0]` em vez de `[3, 1, 0]`
3. **Tela Notificações de Cobrança** — `/financeiro/notificacoes-cobranca` com painel de resumo, faixas de atraso, lista de inadimplentes, disparo manual e histórico
4. **Botão "Disparar Notificações"** — Adicionado à tela de Emissão de Cobranças
5. **Menu sidebar** — Item "Notificações Cobrança" com ícone Bell no menu Financeiro

### Fluxo completo ativo:

```
Emissão → Disparar Notificações → Régua automática (D-5, D-1, D0, D+1, D+3, D+5) → Suspensão → SPC D+30
```
