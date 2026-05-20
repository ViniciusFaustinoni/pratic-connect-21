## 🔎 Diagnóstico do caso Eder Lopes (RJX3E41)

Honda ADV 150 — moto, FIPE **R$ 20.653** (> R$ 9.000 ⇒ EXIGE rastreador). Fluxo canônico esperado:

```text
link público → autovistoria enxuta (opcional) → Cadastro aprova
   → libera R/F (servico autovistoria = 'aprovada' terminal, fora da fila)
   → cliente agenda instalação presencial no link
   → instalação cria servico tipo=instalacao → fila Serviços de Campo (Monitoramento)
   → técnico instala → Aprovação de Associados → ativar-associado
```

Estado real no banco:

| Item | Estado | Esperado |
|---|---|---|
| `vistorias` 71eb… autovistoria | `aprovada` | ✅ correto |
| `servicos` autovistoria e7bf… | `aprovada` (terminal) | ✅ correto |
| `servicos` presencial 2a4d… | `cancelada` | ✅ correto |
| `instalacoes` e24a… | `status=concluida`, `dispensa_rastreador=true`, sem rastreador, sem instalador, criada+concluída em 1 s | ❌ deveria ser `agendada` com `dispensa_rastreador=false`, OU nem existir |
| `servicos tipo='instalacao'` para a instalação | inexistente | ❌ deveria existir (`agendada`) para aparecer em Serviços de Campo |
| `veiculos.status` | `instalacao_pendente` | ✅ por enquanto |

Conclusão: alguma rotina criou a `instalacoes` com `dispensa_rastreador=true` (errado para moto > R$ 9k) e em 1 s a marcou `concluida`. Como o guard `fn_guard_instalacao_concluida_exige_rastreador` faz early-return quando `dispensa_rastreador=true`, o caso passou. Por isso o caso “pulou” a fila do Monitoramento de campo e foi parar direto na Aprovação de Associados.

A **duplicação visual** vem de termos 2 `servicos` com o mesmo `vistoria_origem_id` (autovistoria aprovada + presencial cancelada). Hoje a UI dedupa por `origem`, mas o card-fantasma ainda aparece quando algum dos lados não está em status terminal “oculto”.

---

## 🎯 Plano

### 1. Limpeza imediata do caso Eder Lopes (data fix)
Migration data-fix:
- `DELETE` na instalação fantasma `e24a80c4-…` (status=`concluida`, sem rastreador, sem instalador). Trigger `excluir_servicos_ao_deletar_instalacao` limpa servicos vinculados.
- Recolocar `veiculos.status='aguardando_instalacao'` (mantendo `cobertura_roubo_furto=true` já liberada).
- Setar `cotacoes.status_contratacao='aguardando_instalacao'` para o caso reabrir a etapa de agendamento no link público.
- Auditoria em `associados_historico` registrando o saneamento.

### 2. Fechar a raiz: bloquear `dispensa_rastreador=true` indevido
Trigger DB nova `fn_guard_dispensa_rastreador_coerente` BEFORE INSERT/UPDATE em `instalacoes`:
- Lê `valor_fipe`, `combustivel`, marca/modelo do veículo;
- Se moto FIPE ≥ 9.000, carro FIPE ≥ 30.000 ou Diesel ⇒ `RAISE` quando alguém tentar `dispensa_rastreador=true`.
- Isso garante que o guard `fn_guard_instalacao_concluida_exige_rastreador` nunca mais seja contornado por um `dispensa=true` falso.

### 3. Restringir a auto-conclusão de instalação a casos válidos
Revisar `fn_instalacao_autoconcluir_pos_vistoria` e as funções de propagação (`propagar_conclusao_instalacao`, `sync_instalacao_to_servicos`, `cancelar_servicos_ao_cancelar_instalacao`) para garantir:
- Auto-conclusão SÓ se `NEW.rastreador_id IS NOT NULL` **e** existe `vistorias` aprovada com `local_vistoria <> 'cliente'` (vistoria presencial técnica). Autovistoria do cliente nunca conclui instalação (já consta na memória `autovistoria-nao-conclui-instalacao` — falta cobrir esse caminho específico).

### 4. Garantir entrada na fila Serviços de Campo após Cadastro acima-FIPE
Na `aprovar-proposta`, branch acima-FIPE / autovistoria enxuta (linhas 540-617):
- Após marcar `servico autovistoria='aprovada'` (terminal), checar se existe instalação presencial agendada para o veículo. Se **não** existir e o veículo exige rastreador, NÃO criar instalação stub (continua como hoje), mas **garantir** que o link público volte a permitir agendamento — definindo `cotacoes.status_contratacao='aguardando_instalacao'` (hoje fica em `pagamento_ok`, que esconde a etapa).
- Quando o cliente concluir o agendamento, `criar-instalacao-pos-pagamento` materializa a `instalacoes` (`status='agendada'`) e o trigger `sync_instalacao_to_servicos` gera o `servicos tipo='instalacao'` que entra em Serviços de Campo.

### 5. Eliminar duplicação visual da fila
Em `ServicosCampoUnificado` / `useServicosCampoUnificado` (já fazem dedup por `vistoria_origem_id`/`instalacao_origem_id`):
- Garantir que `servicos.status IN ('cancelada','aprovada','reprovada','aprovada_ressalvas','concluida')` seja excluído da fila ativa por padrão. Acrescentar `aprovada` à lista de “terminais ocultos” se ainda faltar (a memória `autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` cobre isso, mas precisa ser auditado).
- Dedup adicional: quando houver `servico tipo='instalacao'` ativo + `servico vistoria_entrada` autovistoria terminal para o mesmo `cotacao_id`, mostrar só o de instalação.

### 6. Testes e validação
- Reproduzir o fluxo Eder Lopes em ambiente:
  1. Criar cotação moto FIPE > R$ 9k;
  2. Concluir autovistoria enxuta (chassi + motor + vídeo);
  3. Aprovar no Cadastro;
  4. Verificar: caso some da fila de Cadastro, **não** aparece em Aprovação de Associados, link público abre etapa “Agendar instalação”, e ao agendar entra em Serviços de Campo;
  5. Após instalação técnica, vai para Aprovação de Associados → `ativar-associado`.
- Cron de saneamento `cron-reconciliar-instalacoes`: rodar uma vez para detectar outros casos com `status='concluida'` + `rastreador_id IS NULL` + `dispensa_rastreador=true` indevido (gerar relatório, sem auto-correção em massa).

### 7. Memória
Atualizar `mem://index.md` (Core) com uma linha:
> Instalação NUNCA pode ser concluída com `rastreador_id IS NULL`; `dispensa_rastreador=true` só é válido para veículos abaixo do mínimo FIPE — guard DB bloqueia.

E criar leaf `mem://logic/operations/dispensa-rastreador-coerente` referenciando o caso Eder Lopes como precedente.

---

## 📁 Arquivos impactados

- `supabase/migrations/<novo>.sql` — guard `fn_guard_dispensa_rastreador_coerente` + data-fix Eder Lopes.
- `supabase/functions/aprovar-proposta/index.ts` — setar `cotacoes.status_contratacao='aguardando_instalacao'` no branch acima-FIPE enxuta quando não há instalação agendada.
- `src/hooks/useServicosCampoUnificado.ts` (ou equivalente) — auditar filtro de status terminais.
- `mem://index.md` + leaf nova.

## ⚠️ Riscos
- O guard novo pode rejeitar fluxos antigos. Antes de aplicar, rodar `SELECT` de auditoria para mapear quantas instalações existentes infringem a regra e tratar caso a caso.
- Alterar `status_contratacao` afeta o link público — validar que o componente da etapa de agendamento reabre corretamente para este estado.
