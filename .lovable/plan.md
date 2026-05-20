## Decisão

Unificar a aprovação documental da Troca de Titularidade na fila **Cadastro › Propostas Pendentes**, com **badge roxo grande "TROCA DE TITULARIDADE"** no topo do card. Após o Cadastro aprovar pela Propostas Pendentes, a solicitação vai **direto para o Monitoramento** (sem reentrar na aba Processos). A aba **Processos › Troca de Titularidade** vira **read-only para o Cadastro** (acompanhamento, sem botões Aprovar/Reprovar) e segue intacta para Monitoramento.

## Fluxo canônico revisado

```text
Termo de cancelamento assinado (titular antigo)
        │
        ▼
Link público do novo titular
   → documentos
   → termo de filiação assinado
   → pagamento (quando houver — adesão)
        │
        ▼   (trigger trg_troca_promove_cadastro_via_cotacao já existe)
Cadastro › Propostas Pendentes  ← AGORA mostra trocas (com badge roxo)
        │  Analista clica "Aprovar proposta"
        │  → aprovar-proposta detecta tipo_entrada='troca_titularidade'
        │     e delega para aprovar-troca-cadastro
        ▼
Monitoramento › Aprovações Troca (fluxo existente, sem mudança)
        │
        ▼
efetivar-troca-titularidade → SGA → Ativo
```

A solicitação **nunca mais volta** para nenhuma fila do Cadastro depois de aprovada — nem na Propostas Pendentes (filtro `cadastro_aprovado=false` quebra), nem na Processos (que agora é só leitura para o Cadastro).

## Mudanças

### 1. Roteamento dentro de `aprovar-proposta` (edge)

**Arquivo:** `supabase/functions/aprovar-proposta/index.ts`

Depois de carregar o contrato, detectar `tipo_entrada === 'troca_titularidade'` e:

- Buscar `solicitacoes_troca_titularidade` por `cotacao_id`.
- Reusar o miolo do `aprovar-troca-cadastro` (refatorar para `_shared/aprovar-troca-cadastro-core.ts`) com todos os gates herdados: termo de cancelamento assinado, situação financeira SGA ≤ 24h liberadora, autovistoria concluída OU janela mesmo-dia.
- Marcar `contratos.cadastro_aprovado = true` e `aprovado_por = aprovador_profile_id` **só depois** que a solicitação avançar para `aguardando_monitoramento` (na mesma transação lógica), o que tira a troca da fila Propostas Pendentes.
- **NÃO executar** "criar instalação", "promover serviço de vistoria" nem "ativar associado" — troca tem caminho próprio de efetivação via `efetivar-troca-titularidade`.
- Devolver o mesmo formato `{ success, mensagem }` que o frontend já consome. Erros estruturados (`link_publico_incompleto`, `inadimplencia_sga_pendente`, `JANELA_TROCA_EXPIRADA`) viram toast no `useAprovarProposta`.

### 2. UI da Propostas Pendentes — badge roxo de Troca

**Arquivo:** `src/pages/cadastro/PropostasPendentes.tsx` (+ sub-card identificado na implementação).

Para cada card com `proposta.tipo_entrada === 'troca_titularidade'`:

- Badge fixo no topo: fundo `bg-purple-600`, texto branco, mesmo tamanho do "INCLUSÃO DE VEÍCULO" já usado.
- Texto: "TROCA DE TITULARIDADE — Titular anterior: {nome do associado antigo}".
- Link discreto "Ver histórico" abre a aba Processos (read-only) com termo de cancelamento, SGA e timeline.

Filtro "Troca de titularidade" no `tipoEntradaOptions` (linha 70) já existe — não mexer.

### 3. Hook `usePropostasPendentes` — enriquecer dados da troca

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

A query base (`status='assinado'`) já captura trocas. Acrescentar lookup em `solicitacoes_troca_titularidade` por `cotacao_id IN ...` quando houver contratos com `tipo_entrada='troca_titularidade'`, expondo:

- `troca_solicitacao_id: string | null`
- `troca_associado_antigo_nome: string | null`
- `troca_termo_assinado_em: string | null`

### 4. Aba Processos › Troca de Titularidade — read-only para Cadastro

**Arquivos:** `src/pages/cadastro/ProcessosOperacionais.tsx`, `src/components/troca-titularidade/ModalDetalhesTroca.tsx`

Quando `modoUsuario === 'cadastro'`:

- Esconder botões "Aprovar" / "Reprovar" do Cadastro.
- Manter: timeline, dados do antigo titular, dados do novo titular, situação SGA, documentos do termo, autovistoria, status do pagamento.
- Banner azul: "A aprovação documental desta troca é feita em **Cadastro › Propostas Pendentes**."

Monitoramento (`modoUsuario='monitoramento'`) e a tela `/monitoramento/aprovacoes-troca` permanecem inalterados.

### 5. Reprovação

A reprovação da Troca pelo Cadastro também migra para a Propostas Pendentes. Quando `tipo_entrada='troca_titularidade'`, o `aprovar-proposta` (lado reprovação, dentro do `ReprovarPropostaDialog`) chama `reprovar-troca-titularidade` (já existe) em vez do caminho padrão.

### 6. Saneamento pontual da troca atual (COT-20260520-163938040-598)

A solicitação `2ee5c642-...` já tem `aprovado_cadastro_em` e `aprovado_monitoramento_em` mas está presa em `aguardando_monitoramento`. Marcar `contratos.cadastro_aprovado=true` para tirar do badge enquanto a efetivação SGA é investigada à parte (fora do escopo).

## Arquivos a editar/criar

- `supabase/functions/aprovar-proposta/index.ts` — desvio para troca
- `supabase/functions/_shared/aprovar-troca-cadastro-core.ts` (novo) — extrai miolo do `aprovar-troca-cadastro`
- `supabase/functions/aprovar-troca-cadastro/index.ts` — passa a delegar para o core
- `src/hooks/usePropostasPendentes.ts` — enriquecer dados de troca
- `src/pages/cadastro/PropostasPendentes.tsx` (+ card) — badge roxo "TROCA DE TITULARIDADE"
- `src/pages/cadastro/PropostaAnalise.tsx` — banner com link para histórico da troca
- `src/pages/cadastro/ProcessosOperacionais.tsx` — `TrocaTitularidadeTab` em modo `readonly_cadastro`
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` — suportar `modo='readonly_cadastro'`
- Atualizar memória `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e` refletindo o novo ponto de aprovação documental

## Como validar

1. Criar uma troca de ponta a ponta: termo de cancelamento → link público novo titular (docs + termo de filiação + pagamento, quando houver).
2. Confirmar que aparece em **Cadastro › Propostas Pendentes** com badge roxo "TROCA DE TITULARIDADE".
3. Conferir que **Cadastro › Processos › Troca** mostra o mesmo registro em modo read-only com banner explicativo.
4. Clicar "Aprovar proposta" → toast de sucesso → o card some da fila → aparece em **Monitoramento › Aprovações Troca** como `aguardando_monitoramento`.
5. Confirmar `contratos.cadastro_aprovado=true` e `solicitacoes_troca_titularidade.aprovado_cadastro_em IS NOT NULL`.
6. Após aprovação do Monitoramento, `efetivar-troca-titularidade` segue inalterado.