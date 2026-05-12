## Problema

Texto atual após aprovar Cadastro sem autovistoria:
> "Aguardando o cliente concluir a autovistoria para liberar a Cobertura Roubo/Furto."

Está errado. Quando o Cadastro é aprovado **sem** autovistoria prévia (caso do MARCUS), a próxima etapa **não é** voltar para o cliente fazer autovistoria — é seguir para o **Monitoramento**, que fará a ativação completa (incluindo R/F) junto com as demais coberturas.

A autovistoria, quando existe, acontece **antes** da aprovação do Cadastro (não depois). Portanto a mensagem nunca deve sugerir que o sistema está aguardando o cliente fazer autovistoria após o Cadastro aprovado.

## Escopo

Apenas texto em `supabase/functions/aprovar-proposta/index.ts` (mensagens `mensagemHistorico` e `mensagemRetorno`). Nenhuma mudança de fluxo, banco, SGA, vistoria ou instalação.

## Mudanças

### `supabase/functions/aprovar-proposta/index.ts`

Reescrever a árvore de mensagens (linhas ~558-564 e ~647-653) com a lógica correta:

- `jaTemInstalacaoConcluida` → mantém: "Instalação já concluída. Proteção 360º ativada."
- `!planoTemRouboFurto` → mantém: "Plano de assistência ativado (sem cobertura de Roubo/Furto)."
- `algumPrecisouRastreador && autovistoriaAprovada` → "Cadastro documental aprovado. Cobertura Roubo/Furto liberada. Enviado para o Monitoramento agendar a instalação."
- `algumPrecisouRastreador && !autovistoriaAprovada` → **"Cadastro documental aprovado. Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento."**
- `!algumPrecisouRastreador` → "Cadastro documental aprovado. Enviado para o Monitoramento para ativação."

A flag `autovistoriaAprovada` (já implementada na rodada anterior) continua sendo usada apenas para diferenciar quando R/F já foi liberado antecipadamente.

## Validação

- MARCUS (sem autovistoria, com rastreador) → toast: "Cadastro documental aprovado. Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento."
- Caso com autovistoria já aprovada antes do Cadastro → toast: "Cadastro documental aprovado. Cobertura Roubo/Furto liberada. Enviado para o Monitoramento agendar a instalação."
- `associados_historico` registra o mesmo texto.
