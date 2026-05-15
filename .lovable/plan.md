## Diagnóstico — `vistoria_entrada` vs `instalacao`

Sim, há confusão real e ela afeta a lógica em pontos pontuais. Os dois valores são **dois nomes para o mesmo evento físico** (a primeira ida do técnico ao veículo — que pode ser só vistoria, só instalação, ou ambas), mas o código nem sempre trata os dois juntos.

### O que confirma que são equivalentes

- `src/hooks/useServicos.ts:1428` já tem o helper canônico:
  ```ts
  isInstalacao(tipo) = tipo === 'instalacao' || tipo === 'vistoria_entrada'
  ```
- Filas críticas do Monitoramento usam os dois juntos:
  - `useAprovacaoMonitoramento`, `useAprovacoesMonitoramentoCount`, `aprovar-proposta` → `.in('tipo', ['instalacao', 'vistoria_entrada'])`
- Comentário oficial em `useContratoLink.ts:397` registra o legado: `tipo: 'instalacao' as any, // Instalação (anteriormente "entrada")`.

### Por que existem dois nomes hoje

Trigger `sync_instalacao_to_servicos` (qualquer linha em `instalacoes`) → grava sempre `servicos.tipo = 'instalacao'`.
Trigger `sync_vistoria_to_servicos` → usa `map_vistoria_tipo_to_servico`, cujo **default é `vistoria_entrada`**. Logo, quando o caso nasce pela tabela `vistorias` (autovistoria, fluxo Base via `agendamentos_base`, Sub-FIPE, Troca de titularidade), o mesmo evento aparece como `vistoria_entrada`.

### Onde a dualidade quebra alguma coisa

1. **Filtros que olham só `'instalacao'`** (perdem casos `vistoria_entrada`):
   - `src/pages/monitoramento/Encaixes.tsx` (`encaixe.tipo === 'instalacao'`)
   - `src/components/mapa/MapaVistoriasContent.tsx` (botões e ações condicionais por `'instalacao'`)
   - `src/hooks/useTarefaAtual.ts`, `src/hooks/useEquipe.ts`, `src/hooks/useEncaixesDisponiveis.ts`, `src/hooks/useMovimentacoes.ts`
   - `src/components/monitoramento/CalendarioDiaModal.tsx`, `RotaModal.tsx`, `AtribuicaoManualTab.tsx`
   - `src/pages/public/AcompanhamentoProposta.tsx` (exclui `'instalacao'` de eventos visíveis, mas não exclui `vistoria_entrada`)
2. **Labels de UI inconsistentes**: várias telas usam `tipo === 'instalacao' ? 'Instalação' : 'Vistoria'`, então um `vistoria_entrada` que de fato inclui instalação aparece como genérico "Vistoria" no calendário, rotas, mapa, encaixe, push do instalador.
3. **Notificações WhatsApp/push** com texto errado:
   - `notificar-inicio-rota`, `cron-expirar-confirmacoes`, `confirmar-vistorias-manha-cron`, `atribuir-proxima-tarefa`, `processar-encaixes-automaticos`, `whatsapp-webhook` — todas decidem o substantivo só pelo `=== 'instalacao'`.
4. **`TIPO_SERVICO_LABELS.vistoria_entrada = 'Vistoria de Entrada'`** — label antigo, perpetua a noção de duas coisas distintas.

### O que NÃO está quebrado (já trata os dois juntos)

- Aprovações do Monitoramento (count, listagem, detalhe).
- Guard anti-duplicação em `criar-instalacao-pos-pagamento` e `aprovar-proposta`.
- Reconciliador `reconciliar-contratos-pos-monitoramento`.
- Cron `cron-followup-reagendamento`, `enviar-link-reagendamento` (mapeiam `vistoria_entrada → 'vistoria'`).

---

## Plano de saneamento (Opção A — conservadora, recomendada)

Mantemos os dois valores no enum `tipo_servico` (evita migração de dados arriscada), mas eliminamos os pontos onde o sistema esquece um deles.

### Passo 1 — Helpers unificados (frontend)
Em `src/hooks/useServicos.ts`:
- Manter `isInstalacao(tipo)`.
- Adicionar `labelPrimeiraVisita(tipo)` retornando `'Instalação'` para `'instalacao'` e `'Vistoria de Entrada (Instalação)'` para `'vistoria_entrada'`.
- Atualizar `TIPO_SERVICO_LABELS.vistoria_entrada = 'Vistoria de Entrada (Instalação)'`.

### Passo 2 — Auditoria de filtros `=== 'instalacao'`
Substituir por `isInstalacao(tipo)` (ou pelo conjunto `['instalacao','vistoria_entrada']`) nestes arquivos:
- `src/pages/monitoramento/Encaixes.tsx`
- `src/components/mapa/MapaVistoriasContent.tsx`
- `src/components/monitoramento/{CalendarioDiaModal,RotaModal,AtribuicaoManualTab}.tsx`
- `src/components/mapa/MapaMobileContent.tsx`
- `src/hooks/{useTarefaAtual,useEquipe,useEncaixesDisponiveis,useMovimentacoes,useAlterarEnderecoTipo}.ts`
- `src/components/vistoriador/EncaixeCard.tsx`
- `src/pages/public/AcompanhamentoProposta.tsx` (incluir `vistoria_entrada` na lista de tipos excluídos do timeline público)

### Passo 3 — Texto correto em notificações (edge functions)
Centralizar em uma função `rotuloPrimeiraVisita(tipo, requerInstalacao)` e aplicar em:
- `notificar-inicio-rota`
- `cron-expirar-confirmacoes`
- `confirmar-vistorias-manha-cron`
- `atribuir-proxima-tarefa`
- `processar-encaixes-automaticos`
- `whatsapp-webhook` (linha 2485)

Critério: se o caso tem rastreador a instalar (FIPE ≥ 30k carro / 9k moto / qualquer Diesel) → palavra **"instalação"**; senão → **"vistoria"**.

### Passo 4 — Documentação
Criar memory `mem://logic/operations/vistoria-entrada-equivale-instalacao` registrando:
- Equivalência operacional dos dois valores.
- Default do `map_vistoria_tipo_to_servico`.
- Regra obrigatória: novos filtros sobre "primeira visita" devem usar `isInstalacao()`.

### Passo 5 — Validação
- Login como diretor, abrir Monitoramento › Aprovações, Encaixes, Calendário e Mapa: confirmar que casos Sub-FIPE/Autovistoria/Troca aparecem nos mesmos lugares dos casos com instalação clássica.
- Disparar push/WhatsApp de teste para uma vistoria base (sem rastreador) e uma instalação 30k+ e conferir o substantivo.

### O que NÃO é alterado
- Enum no banco (sem migração).
- Triggers `sync_instalacao_to_servicos` / `sync_vistoria_to_servicos` (continuam gerando os dois tipos).
- Edge functions de aprovação que já usam `.in('tipo', [...])`.

---

## Alternativa rejeitada — Opção B (unificação total)
Migrar todos os `vistoria_entrada` históricos para `instalacao`, deprecar o valor do enum, ajustar 50+ pontos. Risco alto de quebrar relatórios e auditoria histórica — recomendo NÃO seguir agora.