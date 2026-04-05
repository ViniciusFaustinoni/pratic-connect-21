

# Fix: Atribuição Automática Ocorrendo com Modo Manual Ativo

## Problema

A configuração "Atribuição Manual Ativada" desliga corretamente o motor principal (`cron-atribuir-tarefas`), mas existe um **segundo motor de atribuição** — `processar-encaixes-automaticos` — que roda a cada 10 minutos via pg_cron e **não verifica** a flag `atribuicao_manual_rotas`. Esse motor busca instalações/vistorias com `permite_encaixe=true`, encontra profissionais próximos e atribui automaticamente, ignorando completamente o modo manual.

## Solução

Adicionar a verificação da flag `atribuicao_manual_rotas` no início da edge function `processar-encaixes-automaticos`, fazendo-a sair imediatamente quando o modo manual estiver ativo — igual ao que `cron-atribuir-tarefas` já faz.

## Arquivo Alterado

| Arquivo | Ação |
|---------|------|
| `supabase/functions/processar-encaixes-automaticos/index.ts` | Adicionar check de `atribuicao_manual_rotas` logo após criar o client Supabase (~linha 121) |

## Detalhes Técnicos

Após a linha 121 (`console.log("[processar-encaixes-automaticos] Iniciando...")`), inserir:

```typescript
// Verificar se atribuição manual está ativa
const { data: configManual } = await supabase
  .from('configuracoes')
  .select('valor')
  .eq('chave', 'atribuicao_manual_rotas')
  .maybeSingle();

if (configManual?.valor === 'true') {
  console.log("[processar-encaixes-automaticos] Atribuição MANUAL ativa — encaixes automáticos desligados");
  return new Response(
    JSON.stringify({ sucesso: true, mensagem: 'Atribuição manual ativa — encaixes automáticos desligados', processados: 0 }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Isso garante que **nenhum motor de atribuição** funcione quando o modo manual está ligado. A edge function precisa ser re-deployed após a alteração.

