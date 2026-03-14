

# Por que SGA Hinova e Softruck aparecem como "Pendente"

## Diagnóstico

### SGA Hinova
O card do SGA tem `statusKey: 'hinova'` mas **não tem** `integracaoTipo: 'hinova'`. A função `resolveStatus` primeiro tenta encontrar credenciais pelo `integracaoTipo` (linha 185), mas como não existe, pula direto para o `switch` na linha 221, que usa `ctx.integracoes.hinova.configurado`. Esse valor vem da edge function `integracoes-verificar-secrets`, que verifica o env var `HINOVA_TOKEN`. Porém, as credenciais do Hinova são armazenadas no **banco de dados** (via `integracoes-credenciais`), não como env var — logo `HINOVA_TOKEN` não existe e retorna `false`.

A prova está nos network requests:
- `integracoes-verificar-secrets` → `hinova: { configurado: false }`
- `integracoes-credenciais` → `hinova: { configurado: true, teste_sucesso: true }`

### Softruck
O status requer `s.configurado && s.testado` (linha 199). Os dados mostram `configurado: false, teste_sucesso: false` na tabela `rastreadores_credenciais`. Isso é um problema de credenciais não configuradas de fato, mas separado do bug de lógica.

## Correção

### 1. Adicionar `integracaoTipo` ao card do SGA Hinova
O card já tem credenciais no banco. Basta adicionar `integracaoTipo: 'hinova'` para que `resolveStatus` encontre as credenciais do banco ANTES de cair no fallback de secrets.

### 2. Ajustar `resolveStatus` para cards com `href` + `statusKey`
Quando um card tem `href` (como SGA Hinova), a credencial do banco deve ter prioridade. Atualmente, a lógica de `cred?.configurado` só roda se `integracaoTipo` existir. Corrigir para também verificar credenciais quando `statusKey` corresponde a uma integração com credenciais no banco.

### 3. Softruck — verificar prioridade banco vs rastreadores
O Softruck usa o path de `plataformaCodigo`, que consulta `rastreadores_credenciais`. Se as credenciais do Softruck também estiverem no banco centralizado (`integracoes_credenciais`), adicionar fallback.

## Alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/configuracoes/Integracoes.tsx` | Adicionar `integracaoTipo: 'hinova'` no card SGA e ajustar `resolveStatus` para priorizar credenciais do banco |

A correção é mínima — essencialmente 1 linha adicionada no card e um ajuste na ordem de checagem do `resolveStatus`.

