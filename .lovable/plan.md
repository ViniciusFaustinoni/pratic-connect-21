## Problema

Ao aprovar o Cadastro do MARCUS, o toast/histórico mostrou:

> "Proposta aprovada! Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º."

A mensagem está errada. A aprovação do Cadastro é **apenas documental**. A cobertura de Roubo/Furto só é concedida quando:

1. O cliente conclui a **autovistoria**, **e**
2. O Cadastro aprova a documentação.

Hoje o código de `aprovar-proposta` **já não ativa** R/F (`cobertura_roubo_furto: false`, linha 231) — quem ativa é `processar-vistoria` ao aprovar a vistoria. Apenas o texto exibido ao analista é incorreto.

## Escopo

Corrigir os textos de retorno e de histórico em `supabase/functions/aprovar-proposta/index.ts`, refletindo se a autovistoria já foi concluída/aprovada no momento da aprovação do Cadastro. Nenhuma mudança no fluxo de agendamento, vistoria ou instalação.

## Mudanças

### `supabase/functions/aprovar-proposta/index.ts`

1. **Detectar se autovistoria já foi aprovada** antes de montar a mensagem:
   - Consultar `vistorias` por `cotacao_id` (ou `veiculo_id`) com `status in ('aprovada', 'aprovada_ressalvas')` e `tipo_vistoria` correspondente à autovistoria.
   - Flag `autovistoriaAprovada: boolean`.

2. **Reescrever `mensagemHistorico` e `mensagemRetorno`** (linhas ~538-544 e ~625-631) com a seguinte lógica:

   - `jaTemInstalacaoConcluida` → mantém: "Instalação já concluída. Proteção 360º ativada."
   - `!planoTemRouboFurto` → mantém: "Plano de assistência ativado (sem cobertura de Roubo/Furto)."
   - `algumPrecisouRastreador && autovistoriaAprovada` → "Análise documental aprovada. Cobertura Roubo/Furto liberada. Aguardando agendamento da instalação para Proteção 360º."
   - `algumPrecisouRastreador && !autovistoriaAprovada` → "Análise documental aprovada. Aguardando o cliente concluir a autovistoria para liberar a Cobertura Roubo/Furto."
   - `!algumPrecisouRastreador` → mantém: "Proteção 360° ativada (sem necessidade de rastreador)."

3. Não altera nenhuma escrita em `veiculos`, `contratos`, `associados`, fila SGA ou criação de instalação. O fluxo de agendamento de vistoria/instalação permanece intacto.

## Validação

- Reabrir a proposta do MARCUS (sem autovistoria aprovada) → toast deve dizer "Aguardando o cliente concluir a autovistoria...".
- Caso de teste com autovistoria já aprovada antes do Cadastro → toast deve dizer "Cobertura Roubo/Furto liberada. Aguardando agendamento da instalação...".
- Conferir `associados_historico` reflete o mesmo texto.
