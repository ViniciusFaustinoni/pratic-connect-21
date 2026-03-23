

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

Novo bloco ao final do Bloco 5 (Jornada) ou como Bloco 8:
- Toggle "Exigir motivo ao recusar tarefa" (`recusa_exigir_motivo`)
- Input numerico "Limite de recusas por turno para alerta" (`recusa_limite_alerta`, default 3)
- Salvar junto no botao existente ou botao proprio

---

## PARTE 3 — Componente `ModalRecusaTarefa`

**Novo arquivo**: `src/components/vistoriador/ModalRecusaTarefa.tsx`

Dialog com:
- 5 opcoes radio: "Estou no transito", "Veiculo com problema", "Muito longe da minha localizacao", "Tarefa fora da minha capacidade tecnica", "Outro motivo"
- Campo texto livre visivel quando "Outro motivo" selecionado
- Botoes "Confirmar Recusa" e "Cancelar"
- Props: `open`, `onOpenChange`, `onConfirm(motivo, motivoLivre?)`, `isPending`

---

## PARTE 4 — Botao de Recusa no `TarefaAtualCard.tsx`

Atualmente o card mostra "Iniciar Tarefa" quando `isAgendada`. Adicionar botao secundario "Recusar" ao lado (ou abaixo) do botao principal, visivel apenas quando a tarefa esta em status `agendada` (antes de iniciar rota).

Ao clicar:
1. Ler `recusa_exigir_motivo` da config
2. Se ligado: abrir `ModalRecusaTarefa`
3. Se desligado: recusar diretamente sem modal

Ao confirmar recusa:
1. Inserir registro em `registros_recusa_tarefa` (servico_id, profissional_id, turno_id, motivo, motivo_livre)
2. Desatribuir o servico (set `profissional_id = null`, `status = 'pendente'`) para que o sistema reatribua
3. Chamar `atribuir-proxima-tarefa` para buscar proxima tarefa para o vistoriador
4. Verificar limite de recusas no turno (PARTE 5)

---

## PARTE 5 — Verificacao de Limite e Alerta

Apos inserir a recusa, contar registros em `registros_recusa_tarefa` para o `turno_id` atual. Se >= `recusa_limite_alerta`:
- Verificar se ja existe notificacao com `referencia_id = turno_id` e subtipo `recusa_limite_atingido`
- Se nao existe: inserir notificacao para coordenadores/admins com titulo e mensagem descritivos

---

## PARTE 6 — Historico de Atribuicoes no `InstalacaoDetailDrawer.tsx`

Adicionar secao "Historico de Atribuicoes" (condicional — so quando ha registros):
- Query `registros_recusa_tarefa` por `servico_id`
- Exibir lista cronologica: nome do profissional, status "Recusado", motivo, data/hora
- Futuramente pode incluir "Aceito" (quem esta atribuido atualmente)

---

## PARTE 7 — Badge de Recusas no `JornadaProfissionalCard.tsx`

Receber prop opcional `recusasNoTurno: number` (calculado pelo pai).
Exibir Badge discreto ao lado do status:
- Cinza se 0
- Amarelo se 1 ate (limite - 1)
- Vermelho se >= limite

No `JornadasProfissionais.tsx`: buscar contagem de recusas por turno via query e passar ao card.

---

## PARTE 8 — Parametros read-only no RH

Adicionar ao painel colapsavel de parametros:
- "Exigir motivo recusa": Sim/Nao
- "Limite recusas/turno": X

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration | Tabela `registros_recusa_tarefa` |
| DB insert | 2 registros em `configuracoes` |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | 2 campos novos |
| `src/components/vistoriador/ModalRecusaTarefa.tsx` | **Novo** |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Botao recusar + logica |
| `src/components/instalacoes/InstalacaoDetailDrawer.tsx` | Secao historico atribuicoes |
| `src/components/rh/JornadaProfissionalCard.tsx` | Badge recusas |
| `src/pages/rh/JornadasProfissionais.tsx` | Query recusas + 2 parametros read-only |

