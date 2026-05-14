
## Contexto (caso ANA CAROLINA — `a8adb3eb…`)

A associada tem 2 veículos (Tracker + CG 160). Ao aprovar o **carro** no Monitoramento › Aprovações › Aprovação de Associados, a moto sumiu da fila apesar de ainda estar `em_analise`. E na aba "Veículos" do detalhe do associado, o termo assinado mostrado é o mesmo para os dois veículos (vem de um único `contrato` global do associado).

---

## Problema #1 — Aprovação “contamina” os outros veículos

### Causa raiz
`src/hooks/useAprovacaoMonitoramento.ts` → `useInstalacoesAguardandoAprovacao` filtra a fila assim:

```ts
return v && v.cobertura_total !== true && a?.status !== 'ativo';
```

Quando aprovamos o 1º veículo, `ativar-associado` muda `associados.status` para `'ativo'`. A partir desse momento, **todo serviço pendente do mesmo associado some da fila** porque o segundo termo do filtro casa para todos eles — mesmo que cada `servicos.status` ainda esteja `'concluida'` e o veículo dele continue sem `cobertura_total`.

Confirmado pelo `useAprovacoesMonitoramentoBreakdown` (badge do sidebar) que usa o **mesmo** filtro — por isso o contador também zera junto.

### Correção
Tirar `associado.status` do filtro e manter aprovação 100% por veículo:

1. `useInstalacoesAguardandoAprovacao` — filtrar apenas por:
   - `servicos.status = 'concluida'` (já é)
   - `veiculo.cobertura_total !== true`
   - **remover** `associado.status !== 'ativo'`
2. `useAprovacoesMonitoramentoBreakdown` (`src/hooks/useAprovacoesMonitoramentoCount.ts`, fonte “Aprovação de Associados”) — aplicar exatamente o mesmo filtro para o badge bater com a aba.
3. `useAprovacaoMonitoramentoStats` — idem, para “Aguardando” não diminuir indevidamente.
4. **Não mexer** em `ativar-associado`: a função já é por `(veiculo_id, servico_id)` e só precisa continuar promovendo o associado para `ativo` no 1º veículo (idempotente nos demais). Memória core diz "ativação SEMPRE via `ativar-associado` (lock + CAS + log)" — preservado.
5. Validar manualmente: reabrir o caso da Ana — após o fix a moto (`servicos.status='concluida'`, `veiculos.cobertura_total=false`) volta a aparecer na fila mesmo com a associada já `ativo`.

> Observação: como a associada já está `ativo`, na reaprovação do 2º veículo o `ativar-associado` cairá no caminho idempotente — apenas liga `cobertura_total` no veículo, faz `enqueue` SGA com `force_resync_media=true` e dispara o histórico/notificação. Sem efeitos colaterais no 1º veículo.

---

## Problema #2 — Termo (contrato) por veículo no modal

### Estado atual
- `AssociadoDetalhe.tsx` busca **um único** contrato via `useContratoDoAssociado(id)` e renderiza o botão “Ver Contrato Assinado” no card geral, não no modal por veículo.
- `VeiculoDetalhesModal` recebe `veiculoId` e usa `useVeiculoDetalhes` que **já busca** `contrato` por `veiculo_id` (`src/hooks/useVeiculoDetalhes.ts` linhas 161-168), mas o `select` traz só `numero, status, plano_nome, valor_mensal, data_inicio, data_fim` — **faltam `pdf_assinado_url` e `pdf_url`**, então o modal não tem como exibir o link.
- A aba “Documentos” do modal lista apenas anexos de `contratos_documentos` (CRLV, CNH, etc.), não o PDF do termo.

### Correção
1. `useVeiculoDetalhes.ts` — adicionar `pdf_assinado_url, pdf_url, data_assinatura` ao `.select()` do contrato (linha 164).
2. `VeiculoDetalhesModal.tsx` — na seção “Contrato” (linhas 237-247), quando `contrato.pdf_assinado_url || contrato.pdf_url`:
   - mostrar bloco “Termo de Filiação” com botão **Ver Termo Assinado** (abre o PDF em nova aba) e badge de status (Assinado/Pendente).
   - se houver `data_assinatura`, exibir “Assinado em DD/MM/AAAA”.
3. (Opcional, mesma tela) na aba “Documentos” do modal, injetar uma linha sintética “Proposta/Termo de Filiação” apontando para o mesmo PDF, igual ao padrão usado em `AssociadoDetalhe` (linhas 444-453). Mantém o documento descobrível por quem só olha a lista.
4. Não alterar o card geral do associado — termo continua acessível ali também (UX não regride).

---

## Arquivos tocados

```text
src/hooks/useAprovacaoMonitoramento.ts          (filtro fila + stats)
src/hooks/useAprovacoesMonitoramentoCount.ts    (filtro do badge)
src/hooks/useVeiculoDetalhes.ts                 (select contrato)
src/components/cadastro/VeiculoDetalhesModal.tsx (UI termo por veículo)
```

Sem migração de banco, sem mudança em edge functions.

## Validação

1. Caso Ana Carolina: fila “Aprovação de Associados” deve listar a CG 160 isoladamente; aprovar a moto não deve mexer no Tracker já ativo.
2. Badge do sidebar bate com a aba (mantém memória `mem://hooks/aprovacoes-monitoramento-breakdown`).
3. Modal do Tracker → mostra termo do Tracker; modal da CG 160 → mostra termo da CG 160 (PDFs distintos quando os contratos forem distintos; se compartilharem o mesmo PDF, o link é o mesmo — comportamento correto).
4. Smoke nas demais abas de Aprovações Unificadas (Troca, Liberação, Recusas, Ressalvas, Imprevistos) — não tocadas.
