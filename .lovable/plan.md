

# Plano: Registro Formal de Recusas de Tarefa

## Resumo

Criar tabela dedicada `registros_recusa_tarefa`, modal de recusa no app do vistoriador, alerta automatico para coordenador ao atingir limite, historico de atribuicoes no detalhe do servico, e badge de recusas no card do RH.

---

## PARTE 1 — DB: Tabela + Configuracoes

**Nova tabela `registros_recusa_tarefa`**:
```
id (uuid PK default gen_random_uuid()),
servico_id (uuid FK servicos NOT NULL),
profissional_id (uuid FK profiles NOT NULL),
turno_id (uuid FK turnos_profissionais),
motivo (text NOT NULL),
motivo_livre (text),
created_at (timestamptz default now())
```
RLS: insert/select para authenticated.

**Insert em `configuracoes`**:
- `recusa_exigir_motivo` = `true`
- `recusa_limite_alerta` = `3`

---

## PARTE 2 — Configuracao na Diretoria (`InstalacaoRotasConfig.tsx`)

Adicionar 2 chaves ao `CONFIG_CHAVES`: `recusa_exigir_motivo`, `recusa_limite_alerta`.

Novo bloco 8 após GPS:
- Toggle "Exigir motivo ao recusar tarefa" (`recusa_exigir_motivo`)
- Input numerico "Limite de recusas por turno para alerta" (`recusa_limite_alerta`, default 3)
- Botao "Salvar Recusas"

---

## PARTE 3 — Componente `ModalRecusaTarefa`

**Novo arquivo**: `src/components/vistoriador/ModalRecusaTarefa.tsx`

Dialog com:
- 5 opcoes radio: motivos pre-definidos
- Campo texto livre para "Outro motivo"
- Botoes "Confirmar Recusa" e "Cancelar"

---

## PARTE 4 — Botao de Recusa no `TarefaAtualCard.tsx`

Botao "Recusar Tarefa" visivel quando tarefa esta agendada.
Ao confirmar: registra recusa, desatribui servico, busca proxima tarefa, verifica limite.

---

## PARTE 5 — Verificacao de Limite e Alerta

Apos registrar recusa, conta recusas no turno. Se >= limite, envia notificacao para coordenadores/admins (sem duplicar).

---

## PARTE 6 — Historico de Atribuicoes no `InstalacaoDetailDrawer.tsx`

Secao "Historico de Atribuicoes" com lista cronologica de recusas por servico.

---

## PARTE 7 — Badge de Recusas no `JornadaProfissionalCard.tsx`

Badge discreto com contagem de recusas no turno (amarelo/vermelho conforme limite).

---

## PARTE 8 — Parametros read-only no RH

2 campos adicionais no painel colapsavel: "Exigir motivo recusa" e "Limite recusas/turno".

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration | Tabela `registros_recusa_tarefa` + 2 inserts em `configuracoes` |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | Bloco 8 Recusas |
| `src/components/vistoriador/ModalRecusaTarefa.tsx` | **Novo** |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Botao recusar + logica |
| `src/components/instalacoes/InstalacaoDetailDrawer.tsx` | Secao historico atribuicoes |
| `src/components/rh/JornadaProfissionalCard.tsx` | Badge recusas |
| `src/pages/rh/JornadasProfissionais.tsx` | Query recusas + 2 parametros read-only |
