
# ExcluirAssociadoDialog + Sub-badges + Menu de Acoes

## Resumo

Criar componente ExcluirAssociadoDialog com 3 variantes (inadimplencia, exclusao_diretoria, busca_apreensao), adicionar sub-badges de tipo_saida na lista de associados, e novas opcoes no menu de acoes do AssociadoDetalhe com controle de permissao.

---

## Passo 1 — Novo componente ExcluirAssociadoDialog

**Arquivo:** `src/components/cadastro/ExcluirAssociadoDialog.tsx` (novo)

Componente que recebe `tipoExclusao` e renderiza campos especificos para cada variante:

**Estrutura geral (reutiliza padroes do CancelarAssociadoDialog):**
- Mesma verificacao de `pendencia_rastreador` com Alert destrutivo
- Mesmos progress steps visuais (StepIcon, updateStep)
- Mesmo padrao de chamada a `processar-pos-retirada`

**Campos por variante:**

- **inadimplencia**: Card com dias de inadimplencia (calculado a partir da cobranca OVERDUE mais antiga), total em aberto, Select de acao de cobranca (4 opcoes), checkbox de confirmacao
- **exclusao_diretoria**: Input "Numero da Ata", DatePicker "Data da decisao", Textarea "Motivo" (min 20 chars), Select "Fundamento regulamentar" (14 opcoes do regulamento 3.5/3.6), 2 checkboxes obrigatorios (processo administrativo + notificacao com defesa)
- **busca_apreensao**: Input "Numero do processo" (opcional), Input "Vara/Tribunal" (opcional), Textarea "Motivo" (obrigatorio), Checkbox "Encaminhar para modulo Juridico"

**Fluxo ao confirmar:**
1. Chamar `processar-pos-retirada` com `motivo_retirada = tipoExclusao` — se falhar, parar
2. Para inadimplencia: NAO cancela cobrancas (mantidas para cobranca), salva acao selecionada no metadata do historico
3. Para exclusao_diretoria: salva numero_ata, data_decisao, fundamento no metadata; envia notificacao formal via `disparar-notificacao`
4. Para busca_apreensao: se checkbox juridico marcado, registra em metadata para encaminhamento
5. Em TODOS: notificar via WhatsApp com `disparar-notificacao` (subtipo = tipoExclusao)
6. Toast de sucesso + onSuccess()

---

## Passo 2 — Sub-badges de tipo_saida na lista

**Arquivo:** `src/pages/cadastro/Associados.tsx`

Na coluna de Status da tabela (linha ~590-593), apos o Badge principal de status, adicionar sub-badge condicional quando `status = 'cancelado'` ou `status = 'bloqueado'`:

```text
cancelamento_voluntario -> Badge cinza pequeno "Voluntario"
inadimplencia -> Badge laranja "Inadimplencia"
exclusao_diretoria -> Badge vermelho "Exclusao Diretoria"
busca_apreensao -> Badge vermelho escuro "Busca e Apreensao"
bloqueado (sem tipo_saida) -> Badge cinza escuro "Bloqueado Judicial"
```

O campo `tipo_saida` ja esta disponivel pois o `useAssociados` faz `select('*')`.

---

## Passo 3 — Novas opcoes no menu do AssociadoDetalhe

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

1. Importar `ExcluirAssociadoDialog`
2. Adicionar 3 novos estados:
   - `excluirDialogOpen: boolean`
   - `tipoExclusao: 'inadimplencia' | 'exclusao_diretoria' | 'busca_apreensao' | null`
3. No DropdownMenu existente (linha ~661-678), ADICIONAR apos "Cancelar Associacao":
   - Separador
   - "Excluir por Inadimplencia" (icone DollarSign, cor laranja)
   - "Excluir por Decisao da Diretoria" (icone AlertTriangle, cor vermelha)
   - "Busca e Apreensao" (icone Shield, cor vermelha escura)
4. Estas opcoes so aparecem para perfis com permissao: usar `usePermissions` para verificar `isDiretor || isGerencia || isDesenvolvedor || isAdminMaster`
5. Adicionar o componente `ExcluirAssociadoDialog` no JSX, junto aos outros dialogs existentes

---

## Passo 4 — Templates de notificacao no disparar-notificacao

**Arquivo:** `supabase/functions/disparar-notificacao/index.ts`

Adicionar 3 novos subtipos dentro de `cobranca` (ou criar tipo `exclusao`):
- `inadimplencia`: "Seu cadastro foi encerrado por inadimplencia. Debitos em aberto serao encaminhados para cobranca."
- `exclusao_diretoria`: "Seu cadastro foi encerrado por decisao da diretoria conforme regulamento interno."
- `busca_apreensao`: "Seu cadastro foi bloqueado. Encaminhado ao departamento juridico."

Deploy da edge function apos alteracao.

---

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/cadastro/ExcluirAssociadoDialog.tsx` | Novo |
| `src/pages/cadastro/Associados.tsx` | Adicionar sub-badges |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Adicionar menu + dialog |
| `supabase/functions/disparar-notificacao/index.ts` | Adicionar templates |

## O que NAO sera alterado

- CancelarAssociadoDialog (PR-02) — intacto
- SuspenderAssociadoDialog — intacto
- processar-pos-retirada (PR-01) — intacto
- useAssociados hook — intacto
- Tabelas do banco — nenhuma migration necessaria (colunas ja existem)

## Detalhes tecnicos

### Permissoes
As novas opcoes de exclusao usam `usePermissions()` do hook existente. Condicao: `isDiretor || isGerencia || isDesenvolvedor || isAdminMaster`. Isso cobre diretor, gerente_comercial, supervisor_vendas, desenvolvedor e admin_master.

### DatePicker na exclusao por diretoria
Usar o padrao Shadcn com Popover + Calendar (ja existente no projeto), com `pointer-events-auto` conforme documentado.

### Metadata do historico
O `processar-pos-retirada` ja aceita o campo `motivo_retirada` e registra em `associados_historico`. Os dados adicionais (numero_ata, fundamento, acao_cobranca) serao salvos via update direto no registro de historico apos a chamada, usando o campo `metadata` (jsonb) ja existente.
