
# Plano: Corrigir Query de Rastreador na Listagem de Veículos

## Problema Identificado

O botão "Abrir no Mapa" mostra **"Nenhum veículo com rastreador instalado"** mesmo quando existe um rastreador instalado com posição válida no banco de dados.

### Causa Raiz

A relação entre `veiculos` e `rastreadores` no Supabase tem `isOneToOne: false`, o que significa que:
- A query `rastreador:rastreadores(...)` retorna um **ARRAY** `[ {...} ]`
- Mas o código TypeScript espera um **OBJETO** `{ ... }`

### Evidência no Banco

```sql
-- Existe rastreador com posição válida:
codigo: RAT-862667083494305
status: instalado
ultima_posicao_lat: -22.79677300
ultima_posicao_lng: -43.29465800
```

---

## Solução

Modificar a query para retornar corretamente o primeiro rastreador de cada veículo.

### Arquivo: `src/hooks/useAssociados.ts`

**Alteração na query (linha 317):**

```typescript
// DE:
rastreador:rastreadores(
  id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status,
  ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao
)

// PARA (com hint da foreign key):
rastreador:rastreadores!rastreadores_veiculo_id_fkey(
  id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status,
  ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao
)
```

**Alteração no retorno (linha 323):**

Transformar o array em objeto único pegando o primeiro elemento:

```typescript
// Após buscar os dados:
const veiculosTransformados = (data || []).map(v => ({
  ...v,
  rastreador: Array.isArray(v.rastreador) && v.rastreador.length > 0 
    ? v.rastreador[0] 
    : v.rastreador
})) as VeiculoComRelacoes[];

return veiculosTransformados;
```

---

## Implementação Completa

### Arquivo: `src/hooks/useAssociados.ts` (linhas 307-327)

```typescript
export function useVeiculosDoAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculos-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) throw new Error('ID do associado não informado');

      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          *,
          rastreador:rastreadores!rastreadores_veiculo_id_fkey(
            id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status,
            ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao
          )
        `)
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transformar array em objeto único (pegar primeiro rastreador de cada veículo)
      const veiculosTransformados = (data || []).map(v => ({
        ...v,
        rastreador: Array.isArray(v.rastreador) && v.rastreador.length > 0 
          ? v.rastreador[0] 
          : (v.rastreador || null)
      }));
      
      return veiculosTransformados as VeiculoComRelacoes[];
    },
    enabled: !!associadoId,
  });
}
```

---

## Por que isso acontece?

| Configuração | Comportamento |
|--------------|---------------|
| `isOneToOne: true` | Retorna objeto único `{ ... }` |
| `isOneToOne: false` | Retorna array `[ { ... } ]` |

No Supabase, a FK `rastreadores_veiculo_id_fkey` tem `isOneToOne: false` porque tecnicamente um veículo **pode** ter múltiplos rastreadores (histórico, substituições, etc.), mesmo que na prática só tenha um ativo.

---

## Resultado Esperado

Após a correção:
1. O código `v.rastreador?.status === 'instalado'` irá funcionar corretamente
2. O botão "Abrir no Mapa" irá encontrar o rastreador e mostrar a posição
3. O mapa exibirá: **LTB4J74** em **-22.79677, -43.29465** (última posição conhecida)

---

## Arquivos a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/hooks/useAssociados.ts` | 313-326 | Adicionar hint da FK + transformar array em objeto |
