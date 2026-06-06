---
name: Substituição com débito assumido pelo consultor
description: Substituição não trava mais por débito SGA; consultor assume responsabilidade no StepElegibilidade e abre análise pendente em Relacionamento › Análises (não-bloqueante)
type: feature
---

Antes (06/06/26) o `StepElegibilidade` da Substituição (`/cadastro/associados/:id/substituicao` e `/vendas/...`) travava o botão **Próximo** quando `useVerificarElegibilidade` devolvia `adimplente=false` (associado com cobranças em aberto / débitos SGA). Caso real: substituição da placa `RJN2A96 / PATRICK FARIAS / R$ 218,70`.

## Nova regra canônica

Quando `adimplente=false`, o `StepElegibilidade` mostra um bloco âmbar com:

- Checkbox: *"Estou ciente das cobranças em aberto deste associado e assumo a responsabilidade por prosseguir com esta substituição."*
- Textarea **Justificativa** (obrigatória, ≥ 10 caracteres).

`canProceed = (adimplente || (assumirDebito && justificativaOk)) && rastreador_devolvido && (regras de evento atuais)`.

O payload `{ assumiuDebito, justificativa }` sobe via `onNext(hasEventoProprio, evento?, debitoCtx?)` para `SubstituicaoVeiculoPage`, que guarda em `debitoAssumidoCtx` até a criação real da `substituicoes_veiculo`.

## Ingestão na fila de Análises

Logo após `useIniciarSubstituicao` criar a `substituicoes_veiculo` (status `iniciada`), o front chama:

```ts
supabase.rpc('fn_criar_analise_relacionamento', {
  _tipo: 'substituicao',
  _origem_tabela: 'substituicoes_veiculo',
  _origem_id: result.id,
  _associado_id, _veiculo_id: veiculo_antigo_id,
  _contrato_id: null, _termo_url: null, _termo_assinado_em: null,
  _metadata: {
    motivo: 'debito_sga_assumido',
    assumido_por, assumido_por_nome,
    justificativa,
    placa_antiga,
  },
});
```

- Função é `SECURITY DEFINER`, idempotente por `UNIQUE (origem_tabela, origem_id)`.
- É a **única exceção** ao princípio "nenhum código frontend insere em `analises_relacionamento`" (documentada no header do `useAnalisesRelacionamento.ts`). Os 3 triggers canônicos continuam vigentes para os outros caminhos.
- `observacoes` da `substituicoes_veiculo` recebe `[debito_sga_assumido] <justificativa>` para auditoria local.

## Visualização em /relacionamento/analises

- Filtro de tipo já listava `substituicao`; sem mudança.
- `AnaliseRelacionamentoDrawer` ganhou bloco âmbar **"Débito SGA assumido pelo consultor"** quando `metadata.motivo === 'debito_sga_assumido'`, mostrando quem assumiu, a justificativa e link para `/financeiro/cobrancas?associado=`.
- Ações **Assumir / Resolver / Anexar comprovante** continuam as mesmas — Relacionamento decide entre cobrança ou ciente.

## Fora de escopo (intocado)

- Demais bloqueios do `StepElegibilidade` (`rastreador_devolvido`, `evento_proprio`) seguem travando.
- Caminho canônico da substituição (termo → agendamento → vistoria → Cadastro → Monitoramento → `ativar-associado`) **roda até o fim** mesmo com a análise pendente. Nenhum guard novo foi adicionado.
- Inadimplência ainda barra no **Cadastro** (gate canônico de Cadastro) e na substituição do **mesmo veículo** (regras existentes inalteradas).
