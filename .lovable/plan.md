

# Fix: App do Associado nao mostra posicao do rastreador ativo

## Causa raiz

A edge function `posicao-veiculo` (linha 310-317) faz um join PostgREST entre `rastreadores` e `rastreadores_config_plataformas`:

```typescript
const { data: rastreador, error: rastError } = await supabaseAdmin
  .from('rastreadores')
  .select(`*, plataforma:rastreadores_config_plataformas(*)`)
  .eq('veiculo_id', veiculo_id)
  .single();
```

Porem, a tabela `rastreadores` **nao possui foreign key** para `rastreadores_config_plataformas`. O campo `plataforma` e apenas um texto ('softruck'). O PostgREST nao consegue resolver o join sem FK, causando erro na query. Como resultado, a funcao retorna erro, o hook `useVeiculoPosicao` recebe `offline: true` como fallback, e o app mostra "Rastreador offline".

O rastreador esta online e funcionando (confirmado no painel de monitoramento: RAT-862667083494305, placa LTB4J74, ultima comunicacao ha 6 minutos).

## Solucao

Separar a query em duas: buscar o rastreador primeiro, depois buscar a configuracao da plataforma separadamente usando o campo texto `plataforma`.

**Arquivo: `supabase/functions/posicao-veiculo/index.ts`**

Substituir o select com join (linhas 310-317):

```typescript
// ANTES (falha por falta de FK):
const { data: rastreador, error: rastError } = await supabaseAdmin
  .from('rastreadores')
  .select(`*, plataforma:rastreadores_config_plataformas(*)`)
  .eq('veiculo_id', veiculo_id)
  .single();

// DEPOIS (duas queries separadas):
const { data: rastreador, error: rastError } = await supabaseAdmin
  .from('rastreadores')
  .select('*')
  .eq('veiculo_id', veiculo_id)
  .single();

// Buscar config da plataforma separadamente
let plataformaConfig = null;
if (rastreador?.plataforma) {
  const { data: config } = await supabaseAdmin
    .from('rastreadores_config_plataformas')
    .select('*')
    .eq('plataforma', rastreador.plataforma)
    .maybeSingle();
  plataformaConfig = config;
}
```

Depois, atualizar as referencias no restante da funcao:
- `rastreador.plataforma` (o join overlay) vira `plataformaConfig`
- `plataformaCodigo` usa `rastreador.plataforma` diretamente (ja e o texto 'softruck')

## Detalhes das mudancas no restante do arquivo

Linha 339-340: atualizar para usar a variavel separada:
```typescript
// ANTES:
const plataforma = rastreador.plataforma; // era o objeto do join
const plataformaCodigo = plataforma?.codigo || rastreador.plataforma_id || 'softruck';

// DEPOIS:
const plataforma = plataformaConfig;
const plataformaCodigo = rastreador.plataforma || 'softruck';
```

O resto do codigo ja referencia `plataforma` (agora `plataformaConfig`) para campos como `suporta_posicao_tempo_real`, `api_url_producao`, `ambiente_atual`, etc. Nenhuma outra mudanca necessaria.

## Arquivos alterados

1. `supabase/functions/posicao-veiculo/index.ts` - separar query do rastreador da config da plataforma

## Validacao

Apos deploy, a edge function vai conseguir buscar o rastreador + config corretamente, retornar `offline: false` e `status_rastreador: 'online'`, e o app mostrara o mapa com a posicao em tempo real.
