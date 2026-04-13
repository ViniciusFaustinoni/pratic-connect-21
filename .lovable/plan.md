

## Plano: Corrigir bloqueio de cotação quando dupla aprovação está desativada

### Problema
A `EtapaAssinaturaContrato` verifica `fipe_diretoria_aprovado === false` para bloquear a assinatura, mas **não consulta a configuração** `dupla_aprovacao_fipe_diretoria_ativa`. Resultado: se uma cotação foi criada com o campo `false` enquanto a regra estava ativa, desativar a regra depois não desbloqueia a cotação.

Além disso, o banco mostra `dupla_aprovacao_fipe_diretoria_ativa = 'true'` mesmo que o screenshot do usuário mostre o toggle desligado — indicando que o save pode não ter sido acionado, ou que o valor não foi persistido.

### Correção

**1. `EtapaAssinaturaContrato.tsx` — Verificar config antes de bloquear**
- Buscar também a chave `dupla_aprovacao_fipe_diretoria_ativa` da tabela `configuracoes` no mesmo useEffect
- Só bloquear se **ambos** forem verdadeiros: config ativa **E** `fipe_diretoria_aprovado === false`
- Se a config estiver desativada, ignorar o campo `fipe_diretoria_aprovado` e deixar a cotação prosseguir

```typescript
// Lógica corrigida:
const configAtiva = configData?.valor === 'true';
const pendente = cotacaoData?.fipe_diretoria_aprovado === false;
setAguardandoAprovacaoFipe(configAtiva && pendente);
```

**2. `notificar-diretoria-fipe/index.ts` — Já verifica config (OK)**
- A Edge Function já verifica a config antes de setar `fipe_diretoria_aprovado = false`, então novas cotações não serão bloqueadas se a regra estiver desativada.

### Escopo
- 1 arquivo editado (`EtapaAssinaturaContrato.tsx` — ~5 linhas alteradas no useEffect)

