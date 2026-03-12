

# Migrar envio de boas-vindas para template `cadastro_aprovado_botao`

## Situação atual

O template `cadastro_aprovado_botao` existe no banco com status **APPROVED**, mas nenhum código o referencia. Todos os fluxos de aprovação usam `boas_vindas_associado_v2`.

Quando o analista aprova a proposta, **duas chamadas WhatsApp são feitas**:
1. `ativar-associado` (cria acesso + envia WhatsApp com `boas_vindas_associado_v2`)
2. `notificar-cliente` (notifica com `boas_vindas_associado_v2` via tipo `proposta_aprovada_roubo_furto`)

Isso gera **mensagem duplicada** e usa o template errado.

## Estrutura do template `cadastro_aprovado_botao`

- **Corpo** (5 variáveis): `{{1}}` nome, `{{2}}` placa, `{{3}}` marca+modelo, `{{4}}` cobertura, `{{5}}` próximo passo
- **Botão URL** (1 variável): `https://pratic-connect-21.lovable.app/acompanhar/{{1}}`
- Total flat: 6 params `[nome, placa, marcaModelo, cobertura, proximoPasso, idParaURL]`

Diferença vs `boas_vindas_associado_v2`: placa e marca/modelo são variáveis **separadas** ({{2}} e {{3}}), enquanto o v2 combinava em uma só.

## Alterações

### 1. `supabase/functions/ativar-associado/index.ts`
- Trocar `template_name` de `boas_vindas_associado_v2` para `cadastro_aprovado_botao`
- Separar `placa` e `marcaModelo` em params distintos
- Remover `linkAcesso` do corpo (este template não tem variável de link no corpo)
- Params: `[primeiroNome, placa, marcaModelo, cobertura, 'Instalação do rastreador', associado.id]`

### 2. `supabase/functions/notificar-cliente/index.ts`
- Atualizar todos os mapeamentos de aprovação no `META_TEMPLATE_MAP`:
  - `cadastro_aprovado` -> `cadastro_aprovado_botao`
  - `proposta_aprovada_roubo_furto` -> `cadastro_aprovado_botao`
  - `proposta_aprovada_cobertura_total` -> `cadastro_aprovado_botao`
  - `cobertura_total_ativada` -> `cadastro_aprovado_botao`
  - `vistoria_aprovada` -> `cadastro_aprovado_botao`
  - `instalacao_concluida` -> `cadastro_aprovado_botao`
- Ajustar `getParams()` de cada um para separar placa/marca+modelo e remover linkAcesso do corpo
- Params: `[nome, placa, marcaModelo, cobertura, proximoPasso, associadoId]`

### 3. Eliminar duplicidade de envio
- O fluxo `useAprovarProposta` chama `ativar-associado` (linha 1571) **e** `notificar-cliente` (linha 1657), ambos enviando WhatsApp de boas-vindas
- Centralizar o envio apenas no `ativar-associado` (que já gera token + link de acesso)
- Remover a chamada a `notificar-cliente` com tipos `proposta_aprovada_roubo_furto` / `proposta_aprovada_cobertura_total` de dentro do `useAprovarProposta` para evitar mensagem duplicada

### 4. Deploy das duas Edge Functions alteradas

## Resultado
- Template correto (`cadastro_aprovado_botao`, já APPROVED) enviado na aprovação
- Uma única mensagem por aprovação (sem duplicidade)
- Botão "Criar Conta no APP" funcional com URL dinâmica

