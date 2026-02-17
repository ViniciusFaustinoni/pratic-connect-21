
# Geocodificacao de Oficinas e Rota Veiculo-Oficina no Chamado de Assistencia

## Resumo

Adicionar coordenadas geograficas (latitude/longitude) a todas as oficinas para:
1. Mostrar no mapa do chamado de assistencia (guincho) a rota do veiculo ate a oficina de destino
2. Alertar oficinas sem endereco completo cadastrado

## Alteracoes

### 1. Migração de banco - adicionar colunas lat/lng na tabela `oficinas`

```sql
ALTER TABLE oficinas ADD COLUMN latitude numeric;
ALTER TABLE oficinas ADD COLUMN longitude numeric;
```

### 2. Geocodificar oficinas existentes ao salvar/editar

**Arquivo: `src/components/oficinas/OficinaFormDialog.tsx`**

No `onSubmit`, apos salvar a oficina com sucesso, disparar `geocodificarEmBackground` (do `geocodingService.ts`) usando os dados de endereco do formulario. Se for criacao, usar o ID retornado; se for edicao, usar `oficina.id`.

Adicionar uma nova funcao `atualizarCoordenadasOficina` no `geocodingService.ts` que faz update em `oficinas.latitude` / `oficinas.longitude`.

### 3. Geocodificar oficinas existentes (batch)

**Arquivo: `src/components/oficinas/ImportarOficinasDialog.tsx`**

Apos importar oficinas, disparar geocodificacao em background para cada oficina importada.

**Acao manual complementar:** Executar um script SQL ou edge function para geocodificar as 16 oficinas existentes. Alternativa mais simples: ao abrir a tela de oficinas, verificar quais oficinas nao tem lat/lng e geocodificar em background (lazy geocoding).

### 4. Badge "Cadastrar Endereco" nas oficinas sem endereco

**Arquivo: `src/pages/oficinas/Oficinas.tsx`**

No card de cada oficina, verificar se `logradouro` esta vazio/null. Se sim, exibir um Badge vermelho "Cadastrar Endereco" ao lado do status.

### 5. Mapa com rota veiculo-oficina no chamado de assistencia (guincho)

**Arquivo: `src/pages/assistencia/ChamadoDetalhe.tsx`**

Quando o chamado for do tipo `reboque` e tiver um sinistro vinculado com `oficina_id`:
- Buscar as coordenadas da oficina (`latitude`, `longitude`)
- Exibir no `MapaChamado` um marcador adicional da oficina
- Usar o componente `RotaPolyline` (ja existente) para desenhar a rota real entre a posicao do veiculo (rastreador) e a oficina
- Mostrar a distancia em km calculada pela rota

**Arquivo: `src/components/assistencia/MapaChamado.tsx`**

Adicionar props opcionais para destino oficina (`oficinaLat`, `oficinaLng`, `oficinaNome`). Quando presentes:
- Renderizar marcador da oficina com icone de predio/oficina
- Renderizar `RotaPolyline` entre posicao do rastreador e oficina
- Exibir badge com distancia em km

### 6. Novo service helper

**Arquivo: `src/services/geocodingService.ts`**

Adicionar funcao:
```typescript
export async function atualizarCoordenadasOficina(
  oficinaId: string,
  endereco: EnderecoParaGeocodificar
): Promise<{ latitude: number | null; longitude: number | null; success: boolean }>
```

---

## Detalhes tecnicos

### Fluxo de geocodificacao na criacao/edicao de oficina

```
OficinaFormDialog.onSubmit()
  -> Salva oficina no Supabase
  -> Dispara em background: atualizarCoordenadasOficina(id, { logradouro, numero, bairro, cidade, uf, cep })
  -> Edge function geocode-endereco (Nominatim) retorna lat/lng
  -> Atualiza oficinas.latitude / oficinas.longitude
```

### Fluxo do mapa no chamado de assistencia

```
ChamadoDetalhe
  -> Busca sinistro vinculado (ja existente)
  -> Se sinistro tem oficina_id, busca oficina com lat/lng
  -> Passa coordenadas da oficina para MapaChamado
  -> MapaChamado renderiza marcador + RotaPolyline(rastreador -> oficina)
  -> Distancia calculada via OSRM (useRotaReal, ja existente)
```

### Badge de alerta no card da oficina

```tsx
{!oficina.logradouro && (
  <Badge className="bg-red-100 text-red-700 text-xs">
    Cadastrar Endereco
  </Badge>
)}
```

### Lazy geocoding para oficinas existentes

No hook `useOficinas`, apos carregar as oficinas, verificar quais tem `logradouro` preenchido mas `latitude` nulo, e disparar geocodificacao em background (limite de 2-3 por vez para respeitar rate limit do Nominatim de 1req/s).

## Arquivos alterados

1. **Migracao SQL** - adicionar `latitude` e `longitude` na tabela `oficinas`
2. **`src/services/geocodingService.ts`** - nova funcao `atualizarCoordenadasOficina`
3. **`src/components/oficinas/OficinaFormDialog.tsx`** - geocodificar ao salvar
4. **`src/pages/oficinas/Oficinas.tsx`** - badge "Cadastrar Endereco"
5. **`src/components/assistencia/MapaChamado.tsx`** - props de oficina + marcador + rota
6. **`src/pages/assistencia/ChamadoDetalhe.tsx`** - buscar oficina do sinistro e passar ao mapa
7. **`src/hooks/useOficinas.ts`** - lazy geocoding das existentes sem coordenadas
