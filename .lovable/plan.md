## Objetivo

Remover o campo **CPF do novo titular** do modal de Troca de Titularidade. A solicitação nasce só com **nome + e-mail + telefone** do novo titular. O CPF é capturado automaticamente quando o novo titular acessa o link público e envia a CNH (mesmo padrão do fluxo **Inclusão automática por CNH**).

Não há mudança no banco — `novo_titular_dados.cpf` já é um JSON livre e os consumidores downstream já têm caminhos para CPF ausente (apenas precisam ser ajustados para não bloquear).

---

## Alterações

### 1. Frontend — `src/components/associados/TrocaTitularidadeDialog.tsx`
- Remover o estado `cpf`, o `<Label>` e o `<CpfInput>` (linhas 39, 346-348).
- Remover o `cpf` da validação do `handleSubmit` (linha 219): exigir apenas nome + veículo.
- No payload de `criar.mutateAsync` (linha 233): enviar `cpf: ''` (string vazia) — o backend tornará isso aceitável.
- Remover o import `CpfInput` se não for mais usado.

### 2. Frontend — `src/hooks/useSolicitacoesTroca.ts`
- Linha 159: tipar `novo_titular: { nome: string; cpf?: string; ... }` (cpf opcional).

### 3. Backend — `supabase/functions/criar-solicitacao-troca-titularidade/index.ts`
- Linha 56: remover `|| !novo_titular?.cpf` da validação de obrigatoriedade. Manter apenas `nome` como obrigatório.
- Normalizar `novo_titular.cpf` para `null`/`""` antes de gravar (não bloquear).

### 4. Backend — `supabase/functions/enviar-termo-cancelamento-troca/index.ts`
- Linha 161: quando CPF do novo titular estiver vazio, gerar texto sem o trecho "(CPF xxx)" — algo como `Troca de titularidade para FULANO.` em vez de `Troca de titularidade para FULANO (CPF ___).`.

### 5. Backend — `supabase/functions/analisar-novo-titular-troca/index.ts`
- Já trata CPF ausente graciosamente (linhas 80-82). **Sem alteração.** A análise prévia rodará vazia inicialmente e será reaproveitada/re-executada quando o link público preencher o CPF via CNH.

### 6. UI de detalhes — `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- Linha 214: o template `CPF: ${formatCPF(...)}` já lida com vazio (mostra traço). Apenas verificar visualmente que fica aceitável; sem mudança de código necessária.

---

## Não-objetivos

- Não mudar schema do banco (`novo_titular_dados` continua jsonb livre).
- Não alterar `efetivar-troca-titularidade` — ele já resolve o CPF a partir do `novo_associado_id` criado pelo link público (CNH → associado), não depende de `novo_titular_dados.cpf` para essa etapa.
- Não mexer na lógica de bloqueio anti-sequestro (comparação por nome continua valendo).

---

## Validação manual depois

1. Abrir Troca de Titularidade pelo modal → o campo CPF não aparece mais.
2. Criar solicitação só com nome + telefone → cotação criada com sucesso.
3. Termo de cancelamento WhatsApp/Autentique chega no titular antigo sem "(CPF ___)" feio.
4. Fluxo Cadastro → Monitoramento → link público OCR CNH preenche CPF e segue normalmente até efetivar.
