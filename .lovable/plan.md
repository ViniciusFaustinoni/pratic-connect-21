# Linguagem simples no modal de Troca fora da janela

## O que muda
Reescrever apenas o **texto descritivo** do modal de bypass em `src/pages/cadastro/PropostaAnalise.tsx` (linhas 1091–1098) para que qualquer pessoa entenda — sem termos técnicos ou nomes de tabela.

## Antes (técnico)
> Troca fora da janela — escolha como prosseguir
> A janela canônica de mesmo-dia (até 23:59:59 BRT do dia da assinatura do termo de cancelamento) já expirou. Escolha entre aprovar fora da janela (segue para o Monitoramento como Troca normal) ou converter em cotação normal (cancela a troca; o novo titular precisa refazer como nova adesão). A decisão é registrada em logs_auditoria, na fila Relacionamento › Análises e fica visível no Monitoramento.

## Depois (claro)
> Troca fora do prazo — escolha como prosseguir
> O prazo para concluir essa Troca de Titularidade no mesmo dia da assinatura do termo de cancelamento já passou. Você tem duas opções:
> • **Aprovar fora do prazo**: a troca segue normalmente para o Monitoramento.
> • **Converter em cotação normal**: a troca é cancelada e o novo titular precisa começar como uma adesão nova.
>
> Sua decisão fica registrada no histórico da proposta, aparece para o Relacionamento (em Análises) e também para o time do Monitoramento.

## Fora de escopo
- Não mudar regras, fluxos, edges, banco nem nomes de botões.
- Não mexer no `BypassAplicadoBanner` nem em outros modais.
