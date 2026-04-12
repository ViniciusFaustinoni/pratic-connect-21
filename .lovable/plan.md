

## Plano: Garantir geração do laudo ao finalizar instalação (sem exigir assinatura)

### Problema encontrado
Há **dois bugs** na geração do laudo:

1. **`useAprovarVeiculoServico`** (useServicos.ts, linha 1133): chama `gerar-laudo-vistoria` passando apenas `{ servicoId }`, mas a Edge Function espera `{ vistoriaId, associadoId, veiculoId }`. Resultado: **erro 400 silencioso** — o laudo nunca é gerado nesse fluxo.

2. **`concluir-vistoria-prestador`** (Edge Function): não chama `gerar-laudo-vistoria` em momento algum. Quando um prestador externo finaliza, o laudo não é gerado.

3. **`useAssinatura.ts`**: é o único lugar que chama corretamente com todos os parâmetros, mas depende de assinatura — que já não é mais obrigatória.

### Solução

**1. Corrigir `useAprovarVeiculoServico`** (`src/hooks/useServicos.ts` ~linha 1130-1144)
- Antes de chamar `gerar-laudo-vistoria`, buscar a vistoria vinculada ao serviço (via `contrato_id`)
- Passar `{ vistoriaId, associadoId, veiculoId, contratoId, placa }` corretamente

**2. Adicionar geração de laudo em `concluir-vistoria-prestador`** (Edge Function)
- Após concluir a vistoria do prestador, buscar a vistoria vinculada à instalação
- Chamar `gerar-laudo-vistoria` internamente (fetch para a própria Edge Function ou invocar `supabase.functions.invoke`)

**3. Alternativa: aceitar `servicoId` na Edge Function** (`gerar-laudo-vistoria/index.ts`)
- Adicionar lógica no início: se receber `servicoId` em vez de `vistoriaId`, buscar o serviço no banco e resolver `vistoriaId`, `associadoId`, `veiculoId` automaticamente
- Isso torna a Edge Function mais resiliente a diferentes chamadores

### Abordagem recomendada
Combinar opções 1 e 3: corrigir o caller E tornar a Edge Function mais resiliente.

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/gerar-laudo-vistoria/index.ts` | Aceitar `servicoId` como parâmetro alternativo; resolver vistoria/associado/veículo automaticamente |
| `src/hooks/useServicos.ts` | Passar parâmetros corretos (`vistoriaId`, `associadoId`, `veiculoId`, `contratoId`, `placa`) |
| `supabase/functions/concluir-vistoria-prestador/index.ts` | Adicionar chamada a `gerar-laudo-vistoria` após conclusão |

### Escopo
- 3 arquivos modificados
- Redeploy de 2 Edge Functions (`gerar-laudo-vistoria`, `concluir-vistoria-prestador`)
- Sem migração SQL

