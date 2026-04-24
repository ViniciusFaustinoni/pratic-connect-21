
## Diagnóstico

Revisei a implementação atual contra a documentação que você passou e contra o modal do backfill (imagem):

### O que JÁ está correto ✅
- **Cliente Hinova (`hinova-client.ts`)**: `listarBoletosVeiculoJanela` envia o body **exatamente** como a doc exige — `codigo_associado`, `codigo_veiculo`, `data_vencimento_inicial/_final`, `data_inicial/_final` (compat) e `link_boleto: true`. Respeita o limite de **90 dias** por chamada.
- **Função iteradora `listarBoletosVeiculo`**: itera em janelas de 90d cobrindo até 3 anos para trás, deduplicando por `nosso_numero`.
- **Função de teste `sga-testar-boletos-veiculo`** (read-only, sem efeito no banco): usa a assinatura nova corretamente. UI já existe na aba "Teste Boletos" em `/configuracoes/integracoes-sga-hinova`.

### O bug que explica os "0 cobranças importadas" da imagem ❌
O **`sga-sync-financeiro-veiculo`** (a função que o **modal de backfill** dispara para cada veículo) ainda usa o código antigo:

```ts
const janela = janela5Meses();   // retorna { dataInicial: "23/05/2024", dataFinal: "23/04/2025" } (strings)
boletos = await listarBoletosVeiculo(session, codigoAssociado, codigoVeiculo, janela);
```

Mas a **nova assinatura** de `listarBoletosVeiculo` é:
```ts
opts?: { anosTras?: number; diasJanela?: number; linkBoleto?: boolean }
```

→ As strings `dataInicial`/`dataFinal` são **silenciosamente ignoradas** (TypeScript estrutural não cobre isso em runtime), e a função cai nos defaults — o que ainda funcionaria, MAS:

1. Sem `linkBoleto: true` explícito (pega o default `true`, ok).
2. **A janela de 5 meses pretendida virou 3 anos** (12 chamadas/veículo). Isso explica também a lentidão e o estouro de janela horária visível na sua imagem ("Hinova autenticação falhou (200): Usuário com restri\... — 260").
3. Pior: como nenhuma versão antiga compatível existe mais, dependendo de combinações de retry, o request pode ser disparado com payload incompleto e levar a 406.

Resultado prático na sua tela: **205.878 jobs pendentes, 10 concluídos, 0 cobranças importadas** — o sync está rodando mas não retornando nada útil.

## Correções propostas

### 1. `supabase/functions/sga-sync-financeiro-veiculo/index.ts`
- Remover a função morta `janela5Meses()`.
- Substituir as **2 chamadas** de `listarBoletosVeiculo(...)` para usar a nova assinatura:
  ```ts
  const opcoesBoletos = { anosTras: 3, diasJanela: 90, linkBoleto: true };
  boletos = await listarBoletosVeiculo(session, codigoAssociado, codigoVeiculo, opcoesBoletos);
  ```
- Manter idempotência por `nosso_numero` (já existe no upsert).

### 2. Verificar se há outros consumidores desatualizados
Vou checar `sga-backfill-financeiro`, `sga-backfill-massa-orquestrador`, `cron-sga-sync-financeiro-diario`, `disparar-boletos-lote` e `emitir-boleto-individual` — se algum chamar `listarBoletosVeiculo` com a assinatura antiga, aplico a mesma correção.

### 3. Reagendar a fila atual
Não precisa migration nem nova tabela. Após o deploy, a UI do modal de backfill já tem o botão **"Reagendar erros (janela horária / 401)"** e **"Forçar sync agora (drenar fila)"** — basta clicar para começar a drenar com a função corrigida. A função é idempotente por `nosso_numero`, então re-rodar é seguro.

## Validação (passo a passo após o deploy)

1. **Teste isolado primeiro** (já implementado): `/configuracoes/integracoes-sga-hinova → aba "Teste Boletos"` → digitar uma placa real → janela 90 dias → conferir que a tela mostra request enviado, resposta crua e tabela com pelo menos 1 boleto. ➜ **Sem isso passar, não tocamos no backfill.**
2. **Dry-run em 1 veículo**: na fila do backfill, marcar 1 veículo como pendente e clicar em "Forçar sync agora". Conferir nos logs (`sga_sync_logs`) que `action=listar_boletos_financeiro` retornou `quantidade > 0` e que a tabela `cobrancas` ganhou a linha (filtrar por `origem='sga_hinova'`).
3. **Rodar backfill completo** apenas após (1) e (2) confirmados.

## Arquivos afetados

- `supabase/functions/sga-sync-financeiro-veiculo/index.ts` — corrige assinatura.
- (possivelmente) `supabase/functions/sga-backfill-financeiro/index.ts`, `sga-backfill-massa-orquestrador/index.ts`, `cron-sga-sync-financeiro-diario/index.ts`, `disparar-boletos-lote/index.ts`, `emitir-boleto-individual/index.ts` — se alguma usar a assinatura antiga, mesma correção.

Sem novas tabelas, sem novos secrets, sem mudança de UI. É uma correção cirúrgica num único ponto que destrava o backfill da imagem.
