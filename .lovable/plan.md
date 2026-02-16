

# Adicionar Endereco com Auto-Complete na Etapa 2 (B.O.) do Link do Evento

## O que sera feito

Adicionar campos de endereco do evento na tela do Boletim de Ocorrencia (Etapa 2), com auto-complete de rua usando a API gratuita OpenStreetMap Nominatim. Ao digitar o nome da rua, o sistema mostra sugestoes e preenche automaticamente bairro e cidade. O associado precisa informar apenas o numero e ponto de referencia.

## Fluxo do usuario

1. Associado comeca a digitar o nome da rua (minimo 4 caracteres)
2. Sistema mostra lista de sugestoes de enderecos (Nominatim)
3. Associado seleciona o endereco correto
4. Campos Bairro e Cidade/UF sao preenchidos automaticamente (somente leitura)
5. Associado preenche apenas Numero e Ponto de Referencia
6. Endereco e salvo junto com os dados do B.O.

## Alteracoes

### Arquivo 1: `src/components/evento/EventoEtapa2BO.tsx`

- Adicionar estados: `rua`, `numero`, `pontoReferencia`, `bairro`, `cidadeUf`, `sugestoes`, `buscando`
- Campo de rua com debounce de 500ms: ao digitar >= 4 caracteres, busca no Nominatim (`/search?q=RUA,Brasil&format=json&addressdetails=1&limit=5`)
- Dropdown de sugestoes abaixo do campo de rua
- Ao selecionar uma sugestao: preenche rua, bairro, cidade/UF automaticamente
- Campos Numero e Ponto de Referencia manuais
- Incluir endereco no JSON enviado para `salvar-etapa-evento` (campo `dados`)

### Arquivo 2: `supabase/functions/salvar-etapa-evento/index.ts`

- Ao salvar etapa 2, atualizar `sinistros.local_ocorrencia` e `sinistros.cidade_ocorrencia` / `sinistros.estado_ocorrencia` com os dados de endereco informados pelo associado

## Detalhes tecnicos

### Busca Nominatim (direto do frontend, sem edge function)

A busca sera feita diretamente do componente React usando `fetch` para evitar overhead de edge function. Nominatim e gratuito e nao requer API key.

```
GET https://nominatim.openstreetmap.org/search?
  q={texto digitado}, Brasil
  &format=json
  &addressdetails=1
  &limit=5
  &accept-language=pt-BR
```

### Debounce

Usar `setTimeout` com 500ms de delay para evitar excesso de requisicoes (rate limit do Nominatim: 1 req/segundo).

### Dados enviados no submit

```json
{
  "numero_bo": "123456/2026",
  "resumo_bo": "...",
  "endereco_rua": "Rua das Flores, 123",
  "endereco_bairro": "Centro",
  "endereco_cidade": "Rio de Janeiro",
  "endereco_uf": "RJ",
  "endereco_numero": "456",
  "endereco_ponto_referencia": "Proximo ao mercado"
}
```

### Persistencia no sinistro

Na edge function `salvar-etapa-evento`, ao processar etapa 2, atualizar o sinistro:

```typescript
await supabase.from("sinistros").update({
  local_ocorrencia: `${dados.endereco_rua}, ${dados.endereco_numero}`,
  cidade_ocorrencia: dados.endereco_cidade,
  estado_ocorrencia: dados.endereco_uf,
}).eq("id", link.sinistro_id);
```

| Arquivo | Alteracao |
|---|---|
| `src/components/evento/EventoEtapa2BO.tsx` | Adicionar campos de endereco com auto-complete Nominatim, numero e ponto de referencia |
| `supabase/functions/salvar-etapa-evento/index.ts` | Persistir endereco no sinistro ao salvar etapa 2 |
