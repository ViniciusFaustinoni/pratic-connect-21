

# Correcao: Deteccao moto/carro na instalacao

## Diagnostico

Analisei toda a cadeia de dados e logica de deteccao. Os 3 arquivos foram corrigidos corretamente no ultimo commit:

1. `detectarTipoVeiculo` agora aceita `modelo` e `marca`
2. `InstaladorChecklist.tsx` passa `servico?.veiculos?.modelo` e `servico?.veiculos?.marca`
3. `ExecutarVistoriaCompleta.tsx` faz o mesmo

O veiculo em andamento no banco e: **Honda nxr160 Bros Esdd** -- as keywords `nxr` e `bros` existem na lista e a funcao deveria retornar `'moto'`.

**Porem, identifiquei um problema potencial de timing/dependencia**: o `useMemo` depende de `[servico?.veiculos]`, mas quando o `servico` carrega, a referencia do objeto `veiculos` pode nao mudar se o React comparar por referencia. Alem disso, nao ha nenhum log de debug para confirmar que a deteccao esta sendo executada.

## Correcoes

### 1. `src/pages/instalador/InstaladorChecklist.tsx` - Melhorar dependencia do useMemo

Trocar a dependencia de `[servico?.veiculos]` para campos primitivos `[servico?.veiculos?.modelo, servico?.veiculos?.marca]` que garantem re-avaliacao quando os dados carregam. Adicionar `console.log` temporario para debug.

```typescript
const tipoVeiculo: TipoVeiculo = useMemo(() => {
  const veiculoData = servico?.veiculos as { ... } | undefined;
  const resultado = detectarTipoVeiculo(veiculoData?.tipo_veiculo, veiculoData?.modelo, veiculoData?.marca);
  console.log('[InstaladorChecklist] Deteccao tipo veiculo:', {
    modelo: veiculoData?.modelo,
    marca: veiculoData?.marca,
    resultado
  });
  return resultado;
}, [servico?.veiculos?.modelo, servico?.veiculos?.marca]);
```

### 2. `src/pages/instalador/ExecutarVistoriaCompleta.tsx` - Mesma correcao

Trocar dependencia de `[veiculo]` para `[(veiculo as any)?.modelo, (veiculo as any)?.marca]`.

### 3. `src/data/vistoriaConfigCompleta.ts` - Tornar deteccao HONDA mais robusta

Adicionar `console.log` na funcao de deteccao para rastrear o fluxo. Tambem adicionar keyword `'honda'` com tratamento especial: se marca for HONDA **e** modelo conter qualquer keyword de moto, detectar como moto (redundante mas defensivo).

## Resultado

- Dependencias do `useMemo` usando valores primitivos garantem re-render correto
- Logs de debug permitem confirmar a deteccao no console do navegador
- Mesma logica, mais robusta contra edge cases de referencia React
- 3 arquivos editados, sem migration
