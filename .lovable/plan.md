## Contexto

Ontem, no fluxo de **Troca de Titularidade fora da janela**, o Cadastro ganhou um modal de responsabilidade com 3 campos obrigatórios:
1. **Nome de quem autorizou** (≥3 caracteres)
2. **Justificativa** (≥20 caracteres)
3. **Checkbox de responsabilidade** ("Confirmo que tenho responsabilidade por esta decisão e que ela está autorizada por X")

Esse modal vive em `src/pages/cadastro/PropostaAnalise.tsx` (linhas 1098–1198) e grava em `logs_auditoria` + `aprovacoes_bypass_troca`.

Hoje, em **Cadastro › Propostas Pendentes**, quando o associado tem boletos em aberto / situação financeira INADIMPLENTE / verificação inconclusiva no SGA, o bypass usa um modal **mais frouxo**: só um `Textarea` de motivo ≥5 caracteres em `SituacaoFinanceiraGate.tsx` (linhas 106–127). Não exige nome do autorizador nem termo de responsabilidade.

Queremos **alinhar os dois modais**: o bypass financeiro passa a ter o mesmo nível de rigor do bypass de troca.

## Mudanças

### 1. `src/components/cadastro/SituacaoFinanceiraGate.tsx`
Substituir o modal atual (Textarea simples) por uma versão adaptada do modal de responsabilidade:
- **Título** dinâmico permanece (inadimplente / inconclusivo / erro_consulta_sga).
- **Descrição** dinâmica adaptada para o contexto financeiro (mantém o aviso de auditoria SGA).
- **Campos**:
  - Input "Nome de quem autorizou *" (≥3 chars, com contador).
  - Textarea "Justificativa *" (≥20 chars, com contador) — substitui o motivo atual.
  - Checkbox "Confirmo que tenho responsabilidade por esta decisão e que ela está autorizada por **{nome}**" em bloco âmbar.
- **Botão Confirmar** só habilita quando os 3 critérios passam (mesma regra de `bypassFormValido()` da Troca).
- **Estados locais** novos: `bypassNomeAutorizador`, `bypassJustificativa`, `bypassResponsabilidade` — substituem `motivo`.

### 2. `src/hooks/useSituacaoFinanceiraCadastro.ts`
Estender a assinatura de `bypass.mutateAsync` para aceitar objeto:
```
{ motivo: string; nome_autorizador: string }
```
em vez de apenas `string`. Envia ambos no body para a edge.

### 3. `supabase/functions/verificar-situacao-financeira-cadastro/index.ts`
- Aceitar `bypass: { motivo, nome_autorizador }`.
- Validar `nome_autorizador.length >= 3` e `motivo.length >= 20` (alinhado ao bypass de Troca; sobe de 5 → 20).
- Persistir `nome_autorizador` em `sga_situacao_check` (coluna nova `bypass_autorizador` text nullable) **ou**, se preferir não migrar, dentro de `detalhes` jsonb. **Recomendação:** coluna dedicada para facilitar relatórios/auditoria (mini migração).
- `cotacao_avisos_sga.detalhes` ganha `nome_autorizador` no espelho gravado pelo hook.

### 4. `logs_auditoria`
Acrescentar entry no `onSuccess` do bypass com descrição `[CADASTRO_BYPASS_FINANCEIRO] {contrato} - Autorizado por {nome}: {motivo}` (mesmo padrão `[TROCA_BYPASS_JANELA]`). Hoje o gate financeiro só grava em `sga_situacao_check` + `cotacao_avisos_sga`; o log unificado fica mais auditável.

## Fora de escopo

- A regra de **quem** pode acionar o bypass (`isDiretor || isCoordenadorMonitoramento` + permissão `cadastro.bypass_inadimplencia_sga`) **permanece igual**.
- O fluxo de Troca de Titularidade **não muda**.
- Bypass de FIPE, bypass de Inconclusivo e bypass de Erro SGA usam o **mesmo modal** novo (já era o caso) — só ganham os campos extras.

## Arquivos afetados

- `src/components/cadastro/SituacaoFinanceiraGate.tsx` (refactor do dialog)
- `src/hooks/useSituacaoFinanceiraCadastro.ts` (assinatura do mutation)
- `supabase/functions/verificar-situacao-financeira-cadastro/index.ts` (validação + persistência)
- 1 migration curta para `sga_situacao_check.bypass_autorizador text`
- (opcional) atualizar `mem://logic/operations/gate-financeiro-cadastro-inconclusivo` com o novo padrão de bypass
