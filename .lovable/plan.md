## Objetivo

Permitir que o **Cadastro** edite **todos** os campos do associado em `Associados > lista > Editar dados`, exigindo uma tela de confirmação com **motivo obrigatório**, e gravando cada alteração em `associados_historico` com data, hora, autor, dados antes/depois e motivo.

## Diagnóstico do que já existe

- Dialog `AssociadoEditDialog.tsx` já edita um subconjunto de campos (pessoais, contato, endereço, plano, dia de vencimento).
- Hook `useUpdateAssociado` (em `src/hooks/useAssociados.ts`) faz UPDATE direto em `associados` e sincroniza com Rede Veículos — **não registra histórico**.
- Tabela `associados_historico` já existe com colunas perfeitas para o caso: `tipo`, `acao`, `descricao`, `dados_anteriores`, `dados_novos`, `motivo`, `executado_por` (e `usuario_id`), `created_at`, `metadata`.
- Timeline do associado (`AssociadoTimeline.tsx` + `useAssociadoHistoricoCompleto`) já consome `associados_historico` — qualquer registro novo aparecerá automaticamente.

## Mudanças

### 1. Ampliar campos editáveis no `AssociadoEditDialog`

Acrescentar ao schema/form e à UI todos os campos hoje persistidos em `associados` que façam sentido editar manualmente — divididos em seções já existentes mais novas:

- **Dados pessoais (novos):** `nome_mae`, `nome_pai`, `naturalidade`, `nacionalidade`, `escolaridade`, `renda_mensal`.
- **Documentos:** `rg_orgao_emissor`, `rg_uf`, `cnh`, `cnh_categoria`, `cnh_validade`.
- **Contato:** já cobre tudo.
- **Endereço:** já cobre tudo (manter como está).
- **Associação / financeiro:** `plano_id`, `dia_vencimento`, `vendedor_id`, `agencia_id`, `forma_pagamento_preferida`, `observacoes_internas`.
- Os campos exatos serão validados contra `information_schema.columns` na hora da implementação (apenas campos da tabela `associados`, **sem mexer** em status, CPF formatado pelo SGA, ou flags operacionais como `em_troca_titularidade`).

Manter validação Zod e máscaras.

### 2. Tela de confirmação com motivo (etapa antes de salvar)

Ao clicar **Salvar** no dialog atual:

1. Calcular `diff` entre valores originais (snapshot guardado no `useEffect` do reset) e valores atuais do form. Se vazio → toast “Nenhuma alteração” e fecha.
2. Abrir um segundo dialog `AssociadoEditConfirmDialog` mostrando:
   - Lista de campos alterados em formato `Campo: antes → depois` (labels amigáveis).
   - `Textarea` **Motivo da alteração*** (obrigatório, mínimo 5 caracteres).
   - Botões **Voltar** e **Confirmar alterações** (loading state).
3. Só ao confirmar com motivo válido é que o UPDATE acontece.

### 3. Persistência + histórico (no hook)

Refatorar `useUpdateAssociado` para receber `{ id, updates, motivo, dadosAnteriores }` e fazer numa única transação lógica:

1. `UPDATE associados SET ...updates WHERE id = :id RETURNING *`.
2. `INSERT INTO associados_historico` com:
   - `associado_id = id`
   - `tipo = 'edicao_dados'`
   - `acao = 'editar_dados_associado'`
   - `descricao = 'Edição manual de cadastro: <n campos> alterados (<lista curta>)'`
   - `dados_anteriores = jsonb(somente campos alterados, valores antigos)`
   - `dados_novos = jsonb(somente campos alterados, valores novos)`
   - `motivo = <texto digitado>`
   - `usuario_id = auth.uid()` e `executado_por = auth.uid()`
   - `metadata = { origem: 'cadastro_editar_dados', user_agent, campos: [...] }`
3. Manter a sync com Rede Veículos só quando os campos alterados são relevantes (nome, telefone, email, endereço) — sem mudança de comportamento existente.

Para garantir atomicidade real, criar uma **edge function `atualizar-associado-com-historico`** (Service Role) que faz UPDATE + INSERT no histórico e dispara a sync com Rede Veículos como hoje. O hook passa a chamar essa função em vez de UPDATE direto. Em caso de falha no INSERT do histórico, a função reverte o UPDATE.

### 4. Permissões

- Garantir que o perfil **Cadastro** já tem permissão `associados.edit` em `app_roles_config`. Confirmar com SELECT na config e ajustar via migration apenas se faltar.
- O botão **Editar dados** no menu de ações da lista de associados já está visível; manter visibilidade controlada por `permissions.associado.edit` (sem regredir restrições atuais).

### 5. Visibilidade no histórico

Nenhuma mudança de UI necessária: `AssociadoTimeline` já lê `associados_historico` ordenado por `created_at desc`. Adicionar apenas um ícone/label específico para `tipo='edicao_dados'` (Pencil, cor neutra) para diferenciar das outras entradas.

## Técnico (resumo)

```text
UI flow
 ├─ AssociadoEditDialog (form ampliado)
 │    └─ Salvar → calcula diff (vs snapshot)
 │         └─ Abre AssociadoEditConfirmDialog
 │              ├─ Lista campo: antes → depois
 │              ├─ Textarea Motivo* (min 5 chars)
 │              └─ Confirmar
 │                   └─ useUpdateAssociado.mutate({ id, updates, motivo, dadosAnteriores })
 │                        └─ supabase.functions.invoke('atualizar-associado-com-historico')
 │                             ├─ UPDATE associados
 │                             ├─ INSERT associados_historico (tipo=edicao_dados, motivo, diff, executado_por)
 │                             └─ (opcional) sync Rede Veículos
 └─ AssociadoTimeline renderiza entrada nova automaticamente
```

Arquivos previstos:
- `src/components/associados/AssociadoEditDialog.tsx` — ampliar form + integrar fluxo de confirmação.
- `src/components/associados/AssociadoEditConfirmDialog.tsx` *(novo)* — diff + motivo.
- `src/hooks/useAssociados.ts` — refatorar `useUpdateAssociado` para usar edge function e propagar motivo/diff.
- `supabase/functions/atualizar-associado-com-historico/index.ts` *(novo)* — UPDATE + histórico atômico.
- `src/components/associados/AssociadoTimeline.tsx` — ícone/label para `edicao_dados` (ajuste pequeno).
- Migration eventual só se faltar permissão `associados.edit` para o perfil Cadastro.

## Fora de escopo

- Edição em massa.
- Edição de status, CPF (já é chave), flags operacionais (`em_troca_titularidade`, `aguardando_placa_definitiva`, etc.) e relacionamentos automáticos (vínculo de veículo, contratos).
- Aprovação multi-nível (a confirmação com motivo é suficiente — sem workflow extra de aprovação).
