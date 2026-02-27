
# Etapa 2A: Conectar Edge Functions a Tabela de Configuracoes

## Resumo

Modificar a funcao `exigeRastreador` nos dois arquivos de edge functions para aceitar thresholds como parametro, e buscar esses valores da tabela `configuracoes` nos pontos de entrada (callers).

## Estrategia

A funcao `exigeRastreador` e sincrona e chamada dentro de uma cadeia de funcoes sincronas (`generateSecaoRastreador` -> `generateTermoAfiliacao`). Para evitar refatorar toda a cadeia para async, a abordagem sera:

1. **Parametrizar** `exigeRastreador` para receber thresholds opcionais
2. **Buscar** os valores da tabela `configuracoes` nos callers (edge functions principais)
3. **Passar** os valores pela cadeia de dados existente (`TermoAfiliacaoData`)

## Arquivos a modificar

### 1. `supabase/functions/_shared/termo-afiliacao-utils.ts`
- Adicionar campo opcional `configRastreador` na interface `TermoAfiliacaoData`:
```typescript
configRastreador?: {
  fipeMinCarro: number;
  fipeMinMoto: number;
};
```

### 2. `supabase/functions/_shared/termo-afiliacao-template.ts`
- Modificar `exigeRastreador` (L862) para aceitar config opcional:
```typescript
const exigeRastreador = (
  veiculo: any, 
  config?: { fipeMinCarro: number; fipeMinMoto: number }
): { exige: boolean; motivo: string | null } => {
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veiculo a diesel' };
  }
  
  const valorFipe = veiculo.valor_fipe || 0;
  const categoria = (veiculo.categoria || '').toLowerCase();
  const isMoto = categoria.includes('moto') || categoria.includes('ciclomotor');
  
  const thresholdMoto = config?.fipeMinMoto ?? 9000;
  const thresholdCarro = config?.fipeMinCarro ?? 30000;
  
  if (isMoto && valorFipe > thresholdMoto) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdMoto.toLocaleString('pt-BR')}` };
  }
  
  if (!isMoto && valorFipe > thresholdCarro) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdCarro.toLocaleString('pt-BR')}` };
  }
  
  return { exige: false, motivo: null };
};
```
- Modificar `generateSecaoRastreador` (L885) para passar o config:
```typescript
const generateSecaoRastreador = (data: TermoAfiliacaoData): string => {
  const rastreador = exigeRastreador(data.veiculo, data.configRastreador);
  // ... resto inalterado
};
```

### 3. `supabase/functions/_shared/template-utils.ts`
- Mesma alteracao na funcao `exigeRastreador` exportada (L689): aceitar config opcional com fallback identico

### 4. `supabase/functions/autentique-create/index.ts`
- Adicionar funcao utilitaria para buscar configuracoes:
```typescript
async function buscarConfigRastreador(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'operacional_fipe_minimo_rastreador',
        'operacional_fipe_minimo_rastreador_moto'
      ]);
    
    if (error) throw error;
    
    const config: Record<string, string> = {};
    for (const row of (data || [])) {
      config[row.chave] = row.valor;
    }
    
    return {
      fipeMinCarro: Number(config['operacional_fipe_minimo_rastreador']) || 30000,
      fipeMinMoto: Number(config['operacional_fipe_minimo_rastreador_moto']) || 9000,
    };
  } catch (err) {
    console.warn('[autentique-create] Fallback: erro ao buscar config rastreador:', err);
    return { fipeMinCarro: 30000, fipeMinMoto: 9000 };
  }
}
```
- Chamar essa funcao antes de montar `templateData` e incluir o resultado em `configRastreador`

### 5. `supabase/functions/autentique-create-by-token/index.ts`
- Mesma funcao `buscarConfigRastreador` e mesmo uso no fluxo

## O que NAO sera alterado
- Logica de diesel (continua sempre exigindo)
- Formato de retorno de `exigeRastreador` (`{ exige, motivo }`)
- Nenhum arquivo frontend
- `src/types/termo-filiacao.ts`
- Estrutura da tabela `configuracoes`
- Hooks existentes

## Riscos e mitigacoes
- **Fallback seguro**: se a query falhar, usa R$ 30.000 (carro) e R$ 9.000 (moto) com log de aviso
- **Retrocompatibilidade**: o parametro config e opcional, entao qualquer chamada existente sem parametro continua funcionando com os fallbacks
- **Performance**: uma query simples a mais por geracao de termo (impacto negligivel)
