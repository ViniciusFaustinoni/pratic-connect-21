
# Rota Veiculo-Destino no Mapa de Chamados Guincho

## Resumo

Quando um chamado de guincho e criado (via painel, IA, app ou telefone), o mapa deve mostrar a rota entre a posicao atual do veiculo (rastreador) e o endereco de destino informado no chamado. Para isso, sao necessarias 3 mudancas:

---

## 1. NovoChamadoModal - Botao "Usar localizacao atual do veiculo" na origem

**Arquivo: `src/components/assistencia/NovoChamadoModal.tsx`**

Quando um veiculo e selecionado (modo normal), adicionar um botao "Usar localizacao do rastreador" ao lado do campo "Endereco de Origem". Ao clicar:
- Chamar a edge function `posicao-veiculo` com o `veiculo_id` selecionado
- Preencher `origem_endereco` com o endereco retornado pelo rastreador
- Armazenar `origem_lat` e `origem_lng` no state para salvar no chamado

**State adicional no formData:**
```typescript
const [formData, setFormData] = useState({
  tipo_servico: '',
  descricao: '',
  origem_endereco: '',
  destino_endereco: '',
  origem_lat: null as number | null,
  origem_lng: null as number | null,
});
```

## 2. NovoChamadoModal - Destino obrigatorio para guincho + mapa preview

**Arquivo: `src/components/assistencia/NovoChamadoModal.tsx`**

- Quando `tipo_servico === 'reboque'`, tornar "Endereco de Destino" obrigatorio (remover "(opcional)" do label e incluir na validacao `isFormValid`)
- Geocodificar o endereco de destino usando a edge function `geocode-endereco` (ja existente) para obter `destino_lat` e `destino_lng`
- Salvar `destino_lat`, `destino_lng` junto com `destino_endereco` no insert do chamado
- Apos preencher origem e destino (quando guincho), exibir um mini-mapa (`MapaChamado`) mostrando a rota prevista

**Validacao atualizada:**
```typescript
const isFormValid = () => {
  const baseValid = formData.tipo_servico && formData.origem_endereco.trim().length > 0;
  const destinoValid = formData.tipo_servico !== 'reboque' || formData.destino_endereco.trim().length > 0;
  // ...resto da validacao
  return baseValid && destinoValid && ...;
};
```

## 3. MapaChamado + ChamadoDetalhe - Rota rastreador-destino para todos os chamados guincho

**Arquivo: `src/components/assistencia/MapaChamado.tsx`**

Adicionar props para destino generico (alem da oficina):
```typescript
interface MapaChamadoProps {
  // ...props existentes...
  destinoLat?: number | null;
  destinoLng?: number | null;
  destinoEndereco?: string;
}
```

Logica de prioridade para marcador de destino e rota:
1. Se tem `oficinaLat/oficinaLng` -> mostrar marcador oficina + rota (ja implementado)
2. Senao, se tem `destinoLat/destinoLng` -> mostrar marcador destino + rota (novo)

Adicionar marcador de destino (icone azul) e `RotaPolyline` entre rastreador e destino.

**Arquivo: `src/pages/assistencia/ChamadoDetalhe.tsx`**

Passar `destino_lat`, `destino_lng` e `destino_endereco` do chamado para o `MapaChamado`:
```typescript
<MapaChamado
  // ...props existentes...
  destinoLat={chamado.destino_lat}
  destinoLng={chamado.destino_lng}
  destinoEndereco={chamado.destino_logradouro || chamado.destino_endereco}
/>
```

---

## Detalhes tecnicos

### Fluxo do botao "Usar localizacao do veiculo"

```text
Usuario seleciona veiculo
  -> Clica "Usar localizacao do veiculo"
  -> Chama edge function posicao-veiculo({ veiculo_id })
  -> Retorna lat, lng, endereco
  -> Preenche origem_endereco, origem_lat, origem_lng
  -> Salva no insert do chamado
```

### Geocodificacao do destino

```text
Usuario preenche destino_endereco
  -> Debounce de 1s apos parar de digitar
  -> Chama geocode-endereco (Nominatim)
  -> Retorna lat, lng
  -> Armazena destino_lat, destino_lng
  -> MapaChamado preview renderiza rota
```

### Mapa preview no modal (apenas guincho)

Exibido abaixo dos campos de endereco quando:
- `tipo_servico === 'reboque'`
- Tem coordenadas de origem (rastreador ou geocodificada)
- Tem coordenadas de destino

Usa o componente `MapaChamado` existente com `height="h-48"` e `showControls={false}`.

### Insert do chamado atualizado

```typescript
await supabase.from('chamados_assistencia').insert({
  // ...campos existentes...
  origem_lat: formData.origem_lat,
  origem_lng: formData.origem_lng,
  destino_endereco: formData.destino_endereco || null,
  destino_lat: formData.destino_lat,
  destino_lng: formData.destino_lng,
});
```

## Arquivos alterados

1. **`src/components/assistencia/NovoChamadoModal.tsx`** - botao rastreador, destino obrigatorio para guincho, geocodificacao, mapa preview
2. **`src/components/assistencia/MapaChamado.tsx`** - props destino generico + marcador + rota
3. **`src/pages/assistencia/ChamadoDetalhe.tsx`** - passar destino_lat/lng do chamado ao mapa

## Observacoes sobre outros canais (IA, App)

- **WhatsApp/Assistente IA**: Ja coletam endereco de destino via `criar_solicitacao_assistencia`. Basta garantir que a tool salve `destino_lat`/`destino_lng` (geocodificando o endereco de destino antes do insert) - verificar e ajustar as edge functions se necessario.
- **App do Associado**: Ja tem campo `destino_endereco` no fluxo. Mesma logica de geocodificacao.
