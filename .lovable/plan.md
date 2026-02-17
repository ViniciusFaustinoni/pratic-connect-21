
# Correcao da mensagem de aprovacao quando instalacao ja concluida

## Problema

Quando o analista de cadastro aprova um associado que ja passou pela vistoria de instalacao (rastreador ja ativado), as mensagens exibidas ainda dizem "Aguardando ativacao do rastreador", o que e incorreto -- o rastreador ja foi ativado pelo vistoriador.

## Alteracao

**Arquivo: `src/hooks/usePropostasPendentes.ts`**

Corrigir 2 mensagens (linhas 1570 e 1691) para refletir que, quando a instalacao ja foi concluida, a cobertura total esta ativa:

**Mensagem de historico (linha 1570):**
- De: "Proposta aprovada pelo analista de cadastro. Instalacao ja concluida. Aguardando ativacao do rastreador para cobertura total."
- Para: "Proposta aprovada pelo analista de cadastro. Instalacao ja concluida. Cobertura total ativada."

**Mensagem de retorno/toast (linha 1691):**
- De: "Proposta aprovada! Instalacao ja concluida. Aguardando ativacao do rastreador."
- Para: "Proposta aprovada! Instalacao ja concluida. Cobertura total ativada."

Nenhuma outra alteracao necessaria -- apenas correcao de texto.
