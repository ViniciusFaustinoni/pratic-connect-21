# Troca de Titularidade — Etapa pós‑termo de filiação

## Comportamento desejado

Após o **novo associado** assinar o **termo de filiação** no link público da troca de titularidade:

1. **Cenário com adesão (`cobra_base` / `cobra_rota` / `valor_adesao > 0`)** → exibir a etapa de **Pagamento** normalmente (comportamento atual).
2. **Cenário sem adesão (`isenta_base` / `isenta_rota` / `valor_adesao = 0`)** → como Cadastro e Monitoramento já aprovaram (e a Vistoria foi concluída ou dispensada), pular a etapa de Pagamento e exibir diretamente o card de **Criação da senha do app** para o novo associado (mesmo card já usado hoje quando `status_contratacao = 'ativo'`, via `EtapaCriacaoSenhaCotacao`).

Critério de "isenta" (aplicar OR):
- `cotacao.cenario_adesao` começa com `'isenta_'`, **ou**
- `cotacao.valor_adesao === 0` (fallback de segurança).

## Mudanças

### 1. `src/pages/public/CotacaoContratacao.tsx` (frontend)

- Adicionar flag `pularEtapaPagamento`:
  ```
  const isCenarioIsento =
    (cotacao.cenario_adesao?.startsWith('isenta_') ?? false) ||
    (cotacao.valor_adesao ?? 0) === 0;
  const pularEtapaPagamento =
    isTrocaTitularidade && trocaLiberada && isCenarioIsento;
  ```
- Atualizar `STEPS` (memo) para também filtrar a etapa `'pagamento'` quando `pularEtapaPagamento`.
- Atualizar `isEtapaConcluida(4)` para retornar `true` quando `pularEtapaPagamento` (etapa pulada conta como concluída, igual ao tratamento da vistoria).
- Atualizar `etapaDoStatus` e o `useEffect` de sincronização: quando `etapa === 4 && pularEtapaPagamento` → avançar para `5` (conclusão).
- Atualizar `handleAvancar` / `handleVoltar` para saltar de `3 → 5` (ou de `2 → 5` se também pulando vistoria) e o caminho inverso.
- Após assinatura do contrato (`onContratoAssinado`):
  - Se `pularEtapaPagamento`, em vez de `setEtapaAtual(3)`, disparar a ativação chamando a edge function `ativar-associado` (passando `cotacao_id`/`contrato_id` da troca) e em seguida `refetch()` da cotação. Quando a cotação retornar com `status_contratacao = 'ativo'`, o early‑return já existente (linhas 432‑442) renderiza automaticamente `EtapaCriacaoSenhaCotacao`.
  - Mostrar estado de loading "Ativando contrato…" enquanto a chamada está em andamento.

### 2. `supabase/functions/ativar-associado/index.ts` (backend — ajuste mínimo)

- Garantir que o caminho aceita ativação de troca de titularidade **sem exigir `pagamento_ok`** quando `cotacao.cenario_adesao` for isenta (ou `valor_adesao = 0`) e o contrato (autentique) já está assinado.
- Reaproveitar a edge `ativar-associado` (regra "ativação centralizada" do projeto) — não criar caminho paralelo.

### 3. Webhook Autentique (verificação)

Confirmar que, quando o termo de filiação da troca é assinado, o webhook autentique chama `ativar-associado` automaticamente; se já chama, a alteração do item 2 cobre o caso isenta sem precisar de ação adicional do frontend (o frontend então apenas faz polling/refetch para detectar `status='ativo'` e renderizar a tela de senha). Se NÃO chama, manter a chamada explícita do frontend descrita no item 1.

## Detalhes técnicos

- A tela de criação de senha já existe (`EtapaCriacaoSenhaCotacao`) e o gating em `CotacaoContratacao.tsx` já a renderiza quando `status_contratacao === 'ativo'`. Não criar componente novo.
- Stepper visual: `STEPS_BASE` mantido; só a versão filtrada (sem vistoria e/ou sem pagamento) é passada para o `Stepper` e para o cálculo de `totalEtapas` na `NavegacaoEtapas`.
- Não tocar em fluxos de cotação normal nem em troca com `cobra_*` — a etapa de Pagamento permanece intacta para esses casos.
- Não alterar `efetivar-troca-titularidade` (responsável por gerar contrato/transferir veículo) — ele já roda a partir do gatilho de aprovação/vistoria; aqui apenas garantimos que a **ativação final** do novo contrato/associado/veículo dispense o passo de pagamento quando isenta.

## Critérios de aceitação

- Troca isenta + monitoramento aprovou sem vistoria → após assinar o termo, link público pula Pagamento e mostra "Criar senha do app".
- Troca isenta + monitoramento solicitou vistoria → após vistoria concluída e termo assinado, mesmo comportamento (pula pagamento).
- Troca cobra_* → fluxo atual preservado: assina termo → Pagamento → Conclusão/Senha.
- Cotação normal (não troca) → nenhum impacto.
