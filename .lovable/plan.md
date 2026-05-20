## Resumo

Dois sintomas no link público da Troca de Titularidade, **mesma raiz**: a derivação de `etapaAtual` em `src/pages/public/CotacaoContratacao.tsx` quebra a monotonicidade do stepper e empurra o associado para a frente do fluxo sem ter passado pelas etapas anteriores.

1. **Abrir o link cai na última etapa visível** (Pagamento, índice 4) em vez de Plano (0).
2. **COT‑20260520-151115073-803 ficou em limbo** — stepper marca tudo concluído e o conteúdo renderiza `Verificando status da sua proposta...` infinito.

## Diagnóstico

### Bug A — abre na última etapa

`etapaDoStatus` (linhas 308‑351) percorre `for (let i = 5; i >= 0; i--)` e usa o primeiro `isEtapaConcluida(i)` true como âncora, assumindo monotonicidade. Mas `isEtapaConcluida(3)` (linha 290) tem um curto‑circuito:

```ts
case 3:
  return dispensaVistoriaTroca || !!cotacao.tipo_vistoria || statusConcluidos.vistoria.includes(status);
```

Em qualquer Troca **dentro da janela mesmo‑dia** `dispensaVistoriaTroca = true` **desde o primeiro acesso**. Resultado no loop: i=5 falso → i=4 falso → **i=3 true** → `etapaPorSinais = 4` → cai direto em Pagamento, pulando Plano/Docs/Contrato.

### Bug B — limbo da COT‑20260520-151115073-803

Estado da cotação consultado no banco:
- `tipo_entrada = 'troca_titularidade'`
- `status_contratacao = 'pagamento_ok'`
- `plano_escolhido_id` preenchido
- `tipo_vistoria = null`
- Solicitação de troca: `status = 'cotacao_em_andamento'` (não está em `STATUS_TROCA_EM_ANALISE`, então `trocaEmAnalise = false` → stepper normal).

`isEtapaConcluida(4) = true` (status `pagamento_ok`). No loop, i=5 (não é autovistoria) falso → **i=4 true** → `etapaPorSinais = Math.min(4+1, 5) = 5`. `etapaAtual = 5`.

Na renderização (linha 1118+), `etapaAtual === 5` é a etapa "Conclusão/Instalação", que para **Troca de Titularidade não existe** (STEPS_BASE só tem instalação quando `tipo_vistoria === 'autovistoria'`). Cai no fallback final (linha 1597‑1605): **"Verificando status da sua proposta..."** eterno.

Em outras palavras: a cotação fez Pagamento, deveria ir para `TelaAnaliseTrocaTitularidade` quando a solicitação migrar para `aguardando_cadastro`, mas hoje vai para uma etapa fantasma que não tem tela.

## Correção

Editar apenas `src/pages/public/CotacaoContratacao.tsx` (presentation/navegação — sem mudanças de DB ou edge function).

### 1. Restaurar monotonicidade do loop `etapaDoStatus`

Remover `dispensaVistoriaTroca` de `isEtapaConcluida` (case 3, linha 290):

```ts
case 3:
  return !!cotacao.tipo_vistoria || statusConcluidos.vistoria.includes(status);
```

`dispensaVistoriaTroca` deixa de ser sinal de "vistoria concluída" — passa a ser apenas **skip de navegação** quando o usuário chega ali. O efeito da linha 390 (`if (etapa === 3 && dispensaVistoriaTroca) etapa = 4`) continua válido e só dispara depois que Plano/Docs/Contrato existem de fato.

### 2. Mapear `etapaAtual === 5` em Troca → tela de análise

A Troca de Titularidade não tem etapa de "Instalação"; após `pagamento_ok` o destino é a tela de acompanhamento (`TelaAnaliseTrocaTitularidade`). Hoje o bloco `etapaAtual === 5` (linha 1118+) só trata `cotacao.status_contratacao === 'ativo'` e, na ausência, cai no fallback genérico.

Adicionar branch antes do fallback:

```ts
{isTrocaTitularidade ? (
  <TelaAnaliseTrocaTitularidade
    status={(solicitacaoTroca?.status as any) || 'aguardando_cadastro'}
    motivoReprovacao={solicitacaoTroca?.motivo_reprovacao}
    termoAssinadoEm={solicitacaoTroca?.termo_cancelamento_assinado_em}
    aprovadoCadastroEm={solicitacaoTroca?.aprovado_cadastro_em}
    aprovadoMonitoramentoEm={solicitacaoTroca?.aprovado_monitoramento_em}
    tipoVistoriaTroca={(solicitacaoTroca as any)?.tipo_vistoria_troca}
    expiradaEm={(solicitacaoTroca as any)?.expirada_em}
  />
) : ...
```

Isso elimina o limbo: enquanto a solicitação ainda está em `cotacao_em_andamento` pós‑pagamento, a tela mostra "Aguardando avaliação do cadastro" em vez de loader infinito; quando a trigger `trg_troca_promove_cadastro_via_cotacao` migra para `aguardando_cadastro`, `trocaEmAnalise` vira true e o mesmo componente continua válido.

### 3. Garantir avanço pós‑pagamento da Troca para tela de análise

Forçar `etapaDoStatus = 5` quando `isTrocaTitularidade && status_contratacao === 'pagamento_ok'` para que a sincronização (linha 386‑395) leve o usuário direto para o painel de acompanhamento — não há próxima ação dele neste fluxo.

### 4. (Opcional, profilático) Navegação manual pular vistoria na Troca

Em `navOrder` filtrar o índice `3` quando `dispensaVistoriaTroca` for true, para que o botão "Próximo" do Contrato vá direto a Pagamento.

## Backfill da COT‑20260520-151115073-803

Não exige migration — a própria correção #2 já desbloqueia a tela. A solicitação `da35dfbd-…` segue em `cotacao_em_andamento` aguardando a trigger promover para `aguardando_cadastro` quando a cotação atingir `aguardando_aprovacao_cadastro` (caminho normal pós‑pagamento). Nenhum dado precisa ser corrigido.

## Validação

1. Abrir link público de troca recém‑criada (sem plano) → cai em **Etapa 0 (Plano)**.
2. Escolher plano → Documentos → Contrato → janela mesmo‑dia pula Vistoria → Pagamento.
3. Após `pagamento_ok` → renderiza `TelaAnaliseTrocaTitularidade` com badge "Aguardando avaliação do cadastro" (não mais o loader fantasma).
4. Reabrir a COT‑20260520-151115073-803 → mesma tela de acompanhamento, sem limbo.
5. Cotação comum (nova adesão) → comportamento inalterado.

## Arquivos afetados

- `src/pages/public/CotacaoContratacao.tsx` (apenas presentation).

## Memória a atualizar

- `mem://logic/operations/troca-titularidade-janela-mesmo-dia` — registrar que `dispensaVistoriaTroca` é **skip de navegação**, nunca sinal de "etapa concluída".
- Nova entrada em `mem://logic/operations/` documentando que na Troca a etapa 5 do stepper interno renderiza `TelaAnaliseTrocaTitularidade` (não "Instalação").
