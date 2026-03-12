

# Corrigir mensagem prematura de "Cobertura Roubo/Furto ativa" após autovistoria

## Problema

Após o envio das fotos da autovistoria, o componente `AgendamentoVistoria.tsx` exibe o banner **"Cobertura contra Roubo/Furto ativa!"** — o que é incorreto, pois a cobertura só é ativada após a aprovação da proposta pelo setor de cadastro.

## Causa

No arquivo `src/components/cotacao-publica/AgendamentoVistoria.tsx` (linha 244), o banner no contexto `pos-autovistoria` assume que a cobertura já está ativa logo após o envio das fotos. Não há verificação do status real da proposta.

Também no `CotacaoContratacao.tsx` (linhas 691-816), a tela de conclusão da autovistoria já mostra "Instalação do rastreador agendada" com check verde mesmo quando é uma etapa futura.

## Mudanças

### 1. Corrigir banner em `AgendamentoVistoria.tsx`

Alterar a mensagem do banner `pos-autovistoria` de:
- ❌ "Cobertura contra Roubo/Furto ativa!"
- ✅ "Autovistoria enviada — aguardando aprovação do cadastro"

E o subtexto de:
- ❌ "Agende a vistoria completa para ativar todas as coberturas"
- ✅ "Após aprovação, a cobertura contra Roubo/Furto será ativada. A Proteção 360º será liberada após a instalação do rastreador."

### 2. Corrigir tela de conclusão em `CotacaoContratacao.tsx`

Na tela mostrada após agendamento da instalação (linhas 696-816), ajustar o checklist visual para não marcar como concluídos itens que ainda dependem de aprovação:
- "Autovistoria realizada" → ✅ (ok, já aconteceu)
- "Pagamento de adesão confirmado" → ✅ (ok, se pago)
- "Instalação do rastreador agendada" → ✅ (ok, se agendou)
- ~~"Proteção contra roubo e furto já ativada"~~ → Trocar por item pendente: "Aguardando aprovação cadastral para ativar cobertura"

O aviso amber (linhas 810-816) já está correto ("Após a aprovação do setor de cadastro..."), mas o checklist acima dá a impressão errada.

### 3. Arquivos impactados

- `src/components/cotacao-publica/AgendamentoVistoria.tsx` — corrigir texto do banner
- `src/pages/public/CotacaoContratacao.tsx` — ajustar checklist visual da etapa de conclusão

