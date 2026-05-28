## Objetivo

Melhorar a percepção de tempo no botão **"Criar Solicitação"** do modal de Troca de Titularidade (`src/components/associados/TrocaTitularidadeDialog.tsx`), substituindo o spinner discreto por um overlay com **barra de progresso animada** que finaliza em 100% antes de navegar para a próxima tela. Mudança puramente visual — nenhuma alteração no fluxo, hooks ou edge functions.

## Como vai funcionar

1. Ao clicar em "Criar Solicitação", abre um overlay dentro do próprio `DialogContent` cobrindo o formulário com:
   - Ícone animado + título **"Criando solicitação de troca…"**
   - Subtítulo dinâmico que evolui conforme o progresso (ex.: *Validando dados → Sincronizando com SGA → Gerando cotação do novo titular → Pronto!*)
   - Barra de progresso (`Progress` do shadcn) que sobe automaticamente de 0% até ~90% num easing suave (incremento por `setInterval`, desacelera perto de 90% para nunca travar em 100% antes da hora).
2. Quando `criar.mutateAsync` resolver com sucesso:
   - Trava a barra em **100%**
   - Troca o texto para **"Solicitação criada com sucesso!"** com check verde
   - Aguarda ~600ms para o usuário ver os 100%
   - Fecha o modal e navega para `/vendas/cotacoes/:id` (mesmo comportamento atual)
3. Em caso de erro: oculta o overlay, mantém o toast atual e devolve o formulário intacto.

## Detalhes técnicos

- Novo estado local: `progress: number`, `progressLabel: string`, `submitting: boolean` (ou reaproveitar `criar.isPending`).
- `useEffect` controla o `setInterval` que avança o progresso enquanto submitting, com curva tipo `next = prev + (90 - prev) * 0.08`, intervalo 200ms.
- Atualiza `progressLabel` por faixas (0–30 / 30–60 / 60–90 / 100).
- Overlay renderizado dentro do `DialogContent` com `absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-10` — não é um Dialog separado, evita conflito de portais.
- Mantém o botão "Cancelar" desabilitado e o `onOpenChange` ignorado durante o submit (já está parcialmente coberto pelo `disabled={criar.isPending}`; adiciono um `onOpenChange` que bloqueia fechamento enquanto submitting).
- Sem novas dependências (usa `Progress` de `@/components/ui/progress` e `CheckCircle2`/`Loader2` do lucide-react já em uso no projeto).

## Arquivos afetados

- `src/components/associados/TrocaTitularidadeDialog.tsx` — único arquivo alterado.

## Fora do escopo

- Nenhuma alteração em `useCriarSolicitacaoTroca`, edge functions, navegação pós-sucesso ou validações.
- Nenhum outro modal/fluxo recebe a animação (só o pedido pelo usuário).