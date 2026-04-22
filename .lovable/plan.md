

## Importação financeira SGA: confirmar separação do Asaas e ativar exibição para o associado

### Confirmação técnica (resposta direta à pergunta)

Sim, é totalmente possível e **a arquitetura já foi construída exatamente assim**. Asaas e SGA estão isolados no código:

| Origem | Tabela | Função | Uso |
|---|---|---|---|
| **Asaas** | `asaas_cobrancas` | `buscar-boletos-associado`, `asaas-cobrancas`, `asaas-webhook` | Apenas adesão hoje (e cobrança nova quando ativada) |
| **SGA Hinova** | `cobrancas` (com `origem='sga_hinova'`) | `sga-sync-financeiro-veiculo`, `sga-backfill-financeiro`, `cron-sga-sync-financeiro-diario` | Mensalidades históricas e futuras dos associados da base antiga |

A API Hinova SGA v2 oferece tudo que você listou e o cliente compartilhado (`_shared/hinova-client.ts`) já consome:

- `GET /buscar/situacao-financeira-veiculo/{codigo}` → ADIMPLENTE/INADIMPLENTE
- `POST /listar/boleto-associado-veiculo` → array de boletos com:
  - `nosso_numero`, `valor_boleto`, `valor_boleto_multa_mora`, `valor_multa`, `valor_mora`
  - `data_emissao`, `data_vencimento`, `data_vencimento_original`, `data_pagamento`
  - `linha_digitavel`, `codigo_barras`, `url_boleto`
  - `situacao_boleto` (pago/aberto/vencido/cancelado), `tipo_boleto`, `mes_referente`

Esses campos já são gravados em `cobrancas` pelo `sga-sync-financeiro-veiculo` (linhas 121–146) com `origem='sga_hinova'`. Nenhum byte passa pelo Asaas.

### O que falta (o problema real)

Verifiquei o banco: **0 cobranças com `origem='sga_hinova'`** importadas até agora. O pipeline está pronto mas não rodou em escala porque:

1. **Mapeamento `codigo_hinova` por veículo** ainda incompleto (corrigido no commit anterior — header `Authorization`). Sem `codigo_hinova` no veículo, o sync de boletos não roda.
2. **Backfill financeiro nunca processou os 9.618 veículos** — depende do mapeamento.
3. **App do associado (`useMyBoletos`)** lê SOMENTE `asaas_cobrancas`. Mesmo quando o SGA importar os boletos, o associado da base antiga não vai vê-los — vai abrir o app e achar que está vazio.

### Plano

**1. Concluir o mapeamento dos 9.618 veículos**

Já corrigido o header de auth e logging amostral. Falta apenas rodar `sga-mapear-codigos-veiculos` em lotes de 100 até `restantes ≈ 0`. Eu disparo e monitoro `veiculos.codigo_hinova IS NOT NULL`.

**2. Disparar o backfill financeiro completo**

`sga-backfill-financeiro` cria 1 job por veículo mapeado e os workers chamam `sga-sync-financeiro-veiculo`, que já grava em `cobrancas`. Métrica de sucesso: `SELECT COUNT(*) FROM cobrancas WHERE origem='sga_hinova'` > 0 e crescendo.

**3. Unificar a visão do associado (`useMyBoletos`)**

Adicionar a leitura de `cobrancas WHERE associado_id = X AND origem='sga_hinova'` ao lado do retorno do Asaas, mapeando para o mesmo tipo `Boleto`. Resultado final = união ordenada por vencimento. Sem mudar nenhum componente de UI — o que é renderizado hoje continua, só passa a incluir os boletos SGA com seus `codigoBarras`, `linhaDigitavel` e `urlBoleto` reais da Hinova.

**4. Garantir totais financeiros do associado consideram SGA**

Hoje `FinanceiroDashboard.tsx` e `RecuperacaoKPIs.tsx` calculam só sobre `asaas_cobrancas`. Adicionar leitura paralela de `cobrancas (origem='sga_hinova')` e somar nos cards. Sem nova UI — apenas a query muda.

**5. Sanidade: confirmar nenhum ponto cria boleto Asaas para mensalidade SGA**

Auditar `gerar-cobrancas-mensais`, `gerar-faturas-mensais`, `disparar-boletos-lote`, `executar-regua-cobranca` para confirmar que nenhum gera Asaas para associados que têm `origem='sga_hinova'` — se gerar, adicionar guarda `WHERE NOT EXISTS (cobrança SGA do mesmo período)`.

### Critérios de aceitação

1. Após o mapeamento + backfill, `SELECT COUNT(*) FROM cobrancas WHERE origem='sga_hinova'` retorna milhares de registros, com `codigo_barras`, `linha_digitavel`, `boleto_url`, `valor`, `data_vencimento`, `data_pagamento` (quando pago) preenchidos.
2. Aba **Financeiro SGA** no modal do veículo (já existente) lista os boletos passados e futuros, com botões "copiar linha digitável" e "abrir 2ª via" funcionando.
3. App do associado (`/app/boletos`) mostra boletos do Asaas (adesão) **+** boletos SGA (mensalidades) na mesma lista, ordenados por vencimento, sem duplicidade.
4. Nenhum novo boleto Asaas é gerado para associado que tem mensalidade vinda do SGA.
5. Asaas continua intacto para taxa de adesão (sem regressão).

### Fora de escopo

- Migrar pagamentos antigos do Asaas → SGA (não há sobreposição: Asaas só tem adesão).
- Implementar geração de boleto SGA pelo nosso lado (boletos vêm prontos da Hinova).
- Mudar a régua de cobrança ou notificações WhatsApp (próximo passo, depois de validarmos os dados).

### Arquivos envolvidos

- `supabase/functions/sga-mapear-codigos-veiculos/index.ts` (rodar)
- `supabase/functions/sga-backfill-financeiro/index.ts` (rodar)
- `src/hooks/useMyData.ts` (unificar `useMyBoletos`)
- `src/pages/financeiro/FinanceiroDashboard.tsx` e `src/components/cobranca/RecuperacaoKPIs.tsx` (somar SGA nos KPIs)
- Auditoria leve em `gerar-cobrancas-mensais`, `gerar-faturas-mensais`, `disparar-boletos-lote`

