## Diagnóstico

**Cotação:** COT-20260608-151148216-914 (RICARDO DA SILVA) — Troca de titularidade, Chevrolet Classic LS placa LQY5543.

**Erro na UI (etapa Pagamento):**
> "Antes de confirmar a adesão isenta, é necessário concluir a autovistoria completa do veículo (roteiro de fotos + vídeo 360°)."

**Causa raiz:** A edge `confirmar-adesao-zerada` (gate D1, linhas 88–149) checa se o veículo é sub-FIPE via `fn_veiculo_precisa_rastreador(veiculo_id)`. O veículo `de304508…` (LQY5543, herdado do titular antigo) tem `veiculos.valor_fipe = 28.908` (snapshot SGA), abaixo do mínimo de R$ 30.000 para carros — então a função retorna `false` e o gate exige autovistoria completa (31 fotos + vídeo 360°).

Mas isto é **Troca de Titularidade**, fluxo no qual **autovistoria nunca é exigida** (canônico — o veículo já é conhecido do sistema; Monitoramento decide vistoria presencial se quiser). Os dois lados confirmam: `cotacoes.tipo_entrada = 'troca_titularidade'` e `cotacoes.origem_troca_titularidade = true`.

O gate D1 foi escrito para o fluxo de nova adesão sub-FIPE e esqueceu de excluir Troca, então trava o pagamento da adesão isenta do novo titular.

## Correção

Adicionar bypass do gate D1 quando a cotação for Troca de Titularidade.

### Arquivo

`supabase/functions/confirmar-adesao-zerada/index.ts`

### Mudança

Antes do bloco `try` do gate D1 (linha 93), ler a cotação e pular o gate se for troca:

```ts
const { data: cotacaoMeta } = await supabase
  .from('cotacoes')
  .select('tipo_entrada, origem_troca_titularidade, dados_extras')
  .eq('id', cotacao_id)
  .maybeSingle();

const isTroca =
  cotacaoMeta?.tipo_entrada === 'troca_titularidade' ||
  cotacaoMeta?.origem_troca_titularidade === true ||
  !!(cotacaoMeta?.dados_extras as any)?.solicitacao_troca_id;

if (!isTroca) {
  // ── D1: Gate sub-FIPE autovistoria completa (apenas nova adesão) ──
  // ...bloco existente intocado...
}
```

## Por que aqui e não em outro lugar

- O gate D1 é uma proteção de **nova adesão sub-FIPE** (memória `sub-fipe-gates-canonicos`). Troca tem fluxo próprio e nunca passa por essa exigência.
- Não mexer em `fn_veiculo_precisa_rastreador` (essa função está correta para nova adesão; o problema é só aplicabilidade do gate no contexto de troca).
- Demais gates da troca (`aprovar-troca-cadastro`, `aprovar-proposta` branch troca) continuam intocados.

## Verificação após build

1. Reabrir o link público da COT-20260608-151148216-914 → clicar "Tentar Novamente" na etapa Pagamento.
2. Esperado: adesão isenta confirmada, etapa Pagamento marcada como concluída, segue para Vistoria/conclusão do link da troca.
3. Logs `[confirmar-adesao-zerada]` não devem mais registrar `bloqueado: autovistoria sub-FIPE incompleta` para esta cotação.
