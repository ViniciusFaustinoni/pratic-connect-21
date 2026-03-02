
# Corrigir propagacao de dados para o SGA Hinova

## Diagnostico (baseado nos logs reais do banco)

Analisei os logs de sincronizacao e identifiquei **3 problemas na raiz** que impedem a propagacao correta:

### Problema 1: Tipo de veiculo errado para motos
O ultimo sync (01/03) enviou `codigo_tipo_veiculo: 1` (automovel) para uma **Honda NXR160 Bros** (moto). A funcao `inferirTipoVeiculo` no edge function so olha `contrato.veiculo_categoria` -- que nao contem "moto" para muitos contratos. Precisa usar `marca` e `modelo` do veiculo como fallback, igual ao que ja foi feito no frontend (`detectarTipoVeiculo`).

### Problema 2: Recuperacao de placa duplicada falha
Quando o Hinova retorna "Ja existe um veiculo com a placa LMS3B44", as 4 estrategias de fallback nao encontram o codigo:
- Estrategia 1 (GET /veiculo/consultar/placa/): endpoint pode nao existir na API v2
- Estrategia 2 (POST /veiculo/consultar): idem
- Estrategia 3 (logs anteriores): busca generica sem filtrar pelo veiculo_id/placa especifico
- Estrategia 4 (banco local): so funciona se o veiculo ja foi sincronizado antes

O resultado: a sync para no passo do veiculo e nunca completa. O associado fica cadastrado no Hinova mas sem veiculo vinculado.

### Problema 3: Edge functions desatualizadas
As correcoes feitas anteriormente nos arquivos de edge functions (notificar-cliente, whatsapp-webhook) precisam ser reimplantadas para surtirem efeito.

## Correcoes Propostas

### 1. `supabase/functions/sga-hinova-sync/index.ts` -- Deteccao inteligente de tipo de veiculo

Substituir a funcao `inferirTipoVeiculo` para aceitar `marca` e `modelo` alem da categoria:

```typescript
const inferirTipoVeiculo = (categoria, marca, modelo): number => {
  // Prioridade 1: categoria explicita
  if (categoria?.toUpperCase().includes('MOTO')) return 2;
  
  // Prioridade 2: modelo com keywords de moto
  const MOTO_KEYWORDS = ['nxr', 'bros', 'cg', 'cb', 'cbr', 'pcx', 'biz', 'pop', 
    'titan', 'fan', 'xre', 'lander', 'tenere', 'crosser', 'fazer', 'ybr', 'neo',
    'burgman', 'intruder', 'factor', 'scooter'];
  if (modelo && MOTO_KEYWORDS.some(kw => modelo.toLowerCase().includes(kw))) return 2;
  
  // Prioridade 3: marca exclusiva de moto
  const MARCAS_MOTO = ['YAMAHA', 'SUZUKI', 'KAWASAKI', 'HARLEY', 'TRIUMPH', 
    'DUCATI', 'KTM', 'DAFRA', 'SHINERAY', 'KASINSKI'];
  if (marca && MARCAS_MOTO.some(m => marca.toUpperCase().includes(m))) return 2;
  
  // Demais categorias (caminhao, van, etc.)
  // ... manter logica existente
  return 1;
};
```

Passar `veiculo.marca` e `veiculo.modelo` para a funcao (linha 843).

### 2. `supabase/functions/sga-hinova-sync/index.ts` -- Corrigir recuperacao de placa duplicada

Na **Estrategia 3** (busca em logs): filtrar pelo `veiculo_id` especifico em vez de buscar qualquer log generico:

```typescript
// ANTES: busca generica em todos os logs
const { data: logAnterior } = await supabase
  .from('sga_sync_logs')
  .select('response_payload')
  .eq('action', 'cadastrar_veiculo')
  .eq('status', 'success')
  .order('created_at', { ascending: false })
  .limit(50);

// DEPOIS: filtrar por veiculo_id
const { data: logAnterior } = await supabase
  .from('sga_sync_logs')
  .select('response_payload')
  .eq('veiculo_id', veiculo_id)
  .eq('action', 'cadastrar_veiculo')
  .eq('status', 'success')
  .order('created_at', { ascending: false })
  .limit(5);
```

Tambem adicionar uma **Estrategia 5**: tentar associar o veiculo existente ao associado recem-criado usando outro endpoint Hinova, ou pelo menos salvar o estado parcial:

```typescript
// Se nenhuma estrategia encontrou o codigo,
// marcar sync como parcial (associado OK, veiculo pendente)
// e salvar o codigo_associado para nao perder progresso
await supabase.from('associados')
  .update({ codigo_hinova: codigoAssociadoHinova })
  .eq('id', associado_id);
```

### 3. Reimplantar edge functions

Apos as alteracoes, reimplantar:
- `sga-hinova-sync` (correcoes de tipo e recuperacao)
- `notificar-cliente` (ja corrigido para "Protecao 360")
- `whatsapp-webhook` (ja corrigido para "Protecao 360")

## Resultado Esperado

- Motos serao enviadas como `codigo_tipo_veiculo: 2` no SGA
- Recuperacao de placa duplicada sera mais precisa (filtra por veiculo_id)
- Mesmo quando o veiculo ja existe no Hinova, o `codigo_associado` sera preservado
- Mensagens do WhatsApp mostrarao "Protecao 360" corretamente
- 1 arquivo editado + 3 edge functions reimplantadas
