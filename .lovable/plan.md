## Diagnóstico

Analisei o fluxo da troca KOU6D37 (Marcos Dativo → Marcus Faustinoni):

1. O botão **"Realizar Cotação"** do modal `Detalhes da Troca` (`src/components/troca-titularidade/ModalDetalhesTroca.tsx`, `handleRealizarCotacao`) chama imediatamente a edge function `criar-cotacao-troca-titularidade`.
2. Essa edge function **insere uma `cotacoes` em status `rascunho`** com `valor_cota=0`, sem plano, sem vendedor, marcada como `dados_extras.tipo_entrada='troca_titularidade'`.
3. Em seguida o usuário é levado para `/vendas/cotacoes?abrir=<id>`, que abre o `CotacaoDetalheModal` da cotação recém-criada — que aparece como **"Cotação Avulsa / Rascunho"** com a placa já presa pelo registro.
4. Resultado: cotação fantasma criada antes da escolha de plano, ocupando a placa e poluindo o funil.

## O que mudar

Substituir a criação prematura por **abrir o modal padrão de cotação** (`CotacaoFormDialog`), pré-preenchido com os dados do veículo + novo titular, e só **persistir a cotação quando o usuário escolher um plano e salvar** — exatamente como uma cotação normal.

## Mudanças propostas

### 1. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- Remover a chamada a `criar-cotacao-troca-titularidade` em `handleRealizarCotacao`.
- Substituir por: abrir um `CotacaoFormDialog` (estado local `formCotacaoOpen`) com `cotacaoBase` montado a partir de `solicitacao.veiculo` + `solicitacao.novo_titular_dados` (nome, CPF, telefone, email, marca, modelo, ano, placa, FIPE, código FIPE, cor, combustível).
- Passar uma flag interna nova (`origemTroca={ solicitacaoId, associadoAntigoId, veiculoOrigemId }`) para o `CotacaoFormDialog` repassar ao insert.
- No `onSuccess` do form, chamar uma pequena edge function nova `vincular-cotacao-troca` que faz `UPDATE solicitacoes_troca_titularidade SET cotacao_id=$1 WHERE id=$2`, depois `qc.invalidate` e fechar o modal.

### 2. `src/components/cotacoes/CotacaoFormDialog.tsx`
- Adicionar prop opcional `origemTroca?: { solicitacaoId: string; associadoAntigoId: string; veiculoOrigemId: string }`.
- Quando presente:
  - injetar no `insert` final: `dados_extras.tipo_entrada='troca_titularidade'`, `dados_extras.solicitacao_troca_id`, `dados_extras.associado_antigo_id`, `dados_extras.veiculo_origem_id`;
  - aplicar `ignorarPlacaDuplicadaIds` automaticamente (a placa pertence ao veículo `em_troca_titularidade=true` do antigo titular — não pode ser bloqueada);
  - travar campos de identificação do veículo (placa/marca/modelo/ano/FIPE) como somente-leitura, já que vêm da troca.
- Não mexer em nada que afete cotações normais (apenas branches condicionais sob `origemTroca`).

### 3. `supabase/functions/vincular-cotacao-troca/index.ts` (nova)
- Recebe `{ solicitacao_id, cotacao_id }`.
- Valida que `solicitacao.termo_cancelamento_assinado_em IS NOT NULL`, que `solicitacao.cotacao_id IS NULL` (idempotente: se já igual, retorna ok), e que a cotação pertence ao mesmo `veiculo_id`.
- `UPDATE solicitacoes_troca_titularidade SET cotacao_id=$1, status='cotacao_em_andamento' WHERE id=$2`.
- Retorna `{ success: true }`.

### 4. `supabase/functions/criar-cotacao-troca-titularidade/index.ts`
- **Manter como fallback de retro-compatibilidade**, mas restringir: só rodar quando `sol.cotacao_id` já existir (modo "abrir cotação existente"). Bloquear criação nova com 410 Gone + mensagem `"Use o formulário padrão de cotação"`.
- Alternativa (preferida): deletar a função e remover qualquer referência. Avaliar no momento da implementação se há outros pontos chamando.

### 5. Limpeza para o caso do KOU6D37 (one-shot)
- Migration que remove a cotação rascunho fantasma `#COT-20260513-0014` (id da cotação vinculada à solicitação atual de Marcos→Marcus) e zera `solicitacoes_troca_titularidade.cotacao_id` correspondente, devolvendo a placa para o estado correto. Manter `em_troca_titularidade=true` no veículo até a próxima cotação ser efetivamente criada.

### 6. Memória do projeto
Atualizar `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria` (ou criar nova `mem://logic/sales/troca-titularidade-cotacao-on-demand`):
> Cotação de troca de titularidade NUNCA é criada antes da escolha do plano. Após o termo de cancelamento assinado, o botão "Realizar Cotação" abre o `CotacaoFormDialog` padrão pré-preenchido com `origemTroca`; a `cotacoes` só é inserida ao salvar o formulário e o vínculo na `solicitacoes_troca_titularidade.cotacao_id` é feito pela edge `vincular-cotacao-troca`.

## Detalhes técnicos

- **Bloqueio de placa**: o `useVerificarPlacaDuplicada` valida pela tabela `cotacoes`. Como nenhum rascunho será mais criado antes da escolha do plano, a placa fica naturalmente livre. O veículo do antigo titular continua marcado `em_troca_titularidade=true` (não bloqueia cotação nova porque o trigger só bloqueia outros associados).
- **Idempotência**: se o usuário fechar/reabrir o modal sem salvar, nada é persistido (estado é só do form). Se reabrir após salvar, o card `Cotação vinculada` (já existe, linha 187 do `ModalDetalhesTroca`) mostra a cotação real.
- **Campos pré-preenchidos vindos da solicitação**: nome, CPF, telefone, email do `novo_titular_dados`; marca/modelo/ano/placa/cor/combustível/FIPE/código FIPE do `veiculos`. O enriquecimento via `plate-lookup` + `fipe-lookup` que hoje vive em `criar-cotacao-troca-titularidade` migra para um pré-fetch no `ModalDetalhesTroca` antes de abrir o `CotacaoFormDialog` (ou pode ser disparado pelo próprio form ao detectar campos vazios, que já é o comportamento padrão).
- **Tela de destino**: ao salvar com sucesso, navegar para `/vendas/cotacoes?abrir=<id>` (mesmo path atual) para o usuário continuar o fluxo (envio do link, assinatura, etc.).

## Não muda
- Fluxo de assinatura do termo de cancelamento.
- Aprovação Cadastro / Monitoramento / Vistoria.
- Trigger de promoção `liberada_para_assinatura → aguardando_monitoramento` pós-vistoria.
- Bloqueio anti-sequestro pelo nome.