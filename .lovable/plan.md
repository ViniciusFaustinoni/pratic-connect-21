## Diagnóstico

Verifiquei o template `TERMO_CANCELAMENTO_V1` no banco e a edge function `enviar-termo-cancelamento-troca`. O template usa estas variáveis (entre outras já cobertas):

- `{{plano.nome}}`
- `{{contrato.data_inicio}}`
- `{{os.observacoes}}` (motivo do cancelamento)
- `{{associado.uf}}`
- `{{regras.multa_rastreador}}`

Mas o `Record<string,string>` montado em `enviar-termo-cancelamento-troca/index.ts` (linhas ~133–160) só registra **`contrato.plano`**, **`cancelamento.motivo`**, **`associado.estado`** — sem `regras.*` e sem `plano.*`. Como `substituirVariaveisEvento` (em `_shared/template-utils.ts`) só substitui chaves presentes no map, todas as variáveis ausentes ficam **literalmente** no documento, exatamente como no print do KOU6D37.

## Correção (somente edge function — sem mudar template nem schema)

Editar `supabase/functions/enviar-termo-cancelamento-troca/index.ts`:

1. **Buscar plano do contrato**: estender o `select` do contrato para `plano_id` e fazer um `.from('planos').select('nome').eq('id', plano_id)` para obter `planoNome`.
2. **Buscar regra `multa_rastreador`**: ler `configuracoes` (`chave='multa_rastreador'`) — mesmo padrão já usado em `notificar-retirada-whatsapp/index.ts`. Formatar como número brasileiro (ex.: `400,00`).
3. **Adicionar as chaves canônicas no `variaveis`** (mantendo as antigas como alias para retrocompatibilidade):
   - `plano.nome` ← nome do plano (ou `—`)
   - `contrato.data_inicio` ← `formatDate(contrato.data_inicio || contrato.created_at)`
   - `os.observacoes` ← mesmo valor de `cancelamento.motivo` (texto da troca de titularidade)
   - `associado.uf` ← `associadoAntigo.uf`
   - `regras.multa_rastreador` ← valor formatado da configuração
4. Pequena defesa: se `multa_rastreador` não existir em `configuracoes`, cair em `'400,00'` (valor já citado no fallback HTML embutido) para não voltar `—`.

Sem mudanças em outras funções, no template TipTap ou no front. Após o ajuste, qualquer reenvio (`force_resend=true`) já gera o documento com as variáveis renderizadas corretamente — vou testar reenviando para a solicitação do KRN/KOU se você quiser.