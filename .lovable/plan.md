
# Capturar Posicao do Associado na Comunicacao do Evento

## Problema

Quando o associado abre o link do evento (`/evento/:token`), o sistema nao captura a geolocalizacao do dispositivo. Os campos `latitude_informada` e `longitude_informada` na tabela `sinistros` ficam nulos, e o mapa de "Posicao na Hora do Evento" no painel do analista fica vazio.

## Solucao

Capturar automaticamente a geolocalizacao via `navigator.geolocation` assim que o associado abre o link do evento, e salvar no sinistro. O analista ja tem a infraestrutura para visualizar (componente `ComparacaoPosicoes` + mapa Leaflet).

## Alteracoes

### 1. `src/pages/public/EventoColisao.tsx`

Ao carregar a pagina (apos validar o link com sucesso), solicitar `navigator.geolocation.getCurrentPosition()`:

- Se o usuario permitir: enviar as coordenadas para o backend
- Se negar ou falhar: seguir normalmente sem bloquear o fluxo
- Enviar apenas uma vez (controlar com `useRef` para nao repetir)

Apos obter as coordenadas, chamar a edge function `salvar-etapa-evento` com uma acao especial ou criar um endpoint dedicado. A opcao mais simples e salvar diretamente via `validar-link-evento` ou adicionar logica no `salvar-etapa-evento`.

**Abordagem escolhida**: Adicionar um novo campo no FormData do `salvar-etapa-evento` (etapa 1) para incluir latitude/longitude, OU criar uma chamada separada minima.

A abordagem mais limpa: fazer uma chamada direta na edge function `validar-link-evento` para salvar a posicao, ja que e o primeiro contato.

**Decisao final**: Criar uma funcao auxiliar no `EventoColisao.tsx` que chama uma edge function simples para salvar a posicao no sinistro.

### 2. Nova Edge Function `salvar-posicao-comunicacao`

Edge function publica (sem JWT) que:
- Recebe `{ token, latitude, longitude }`
- Valida o token em `sinistro_evento_links`
- Atualiza `sinistros` com `latitude_informada` e `longitude_informada`
- So atualiza se os campos ainda estiverem nulos (nao sobrescreve)
- Retorna sucesso silenciosamente

### 3. `supabase/config.toml`

Registrar a nova edge function com `verify_jwt = false`.

## Fluxo

```text
Associado abre /evento/:token
       |
       v
EventoColisao.tsx carrega e valida token
       |
       v
useEffect solicita navigator.geolocation.getCurrentPosition()
       |
       +-- Sucesso: chama salvar-posicao-comunicacao com lat/lng
       |
       +-- Falha/Negado: nada acontece, fluxo normal
       |
       v
Analista ve no painel: mapa com posicao do associado + rastreador
```

## Detalhes Tecnicos

### EventoColisao.tsx - Codigo adicionado

```typescript
// Apos validar com sucesso, capturar geolocalizacao
const posicaoEnviada = useRef(false);

useEffect(() => {
  if (!data?.valid || !data?.sinistro?.id || posicaoEnviada.current) return;
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (posicaoEnviada.current) return;
      posicaoEnviada.current = true;
      try {
        await publicSupabase.functions.invoke('salvar-posicao-comunicacao', {
          body: {
            token,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        });
      } catch (e) {
        // Silencioso - nao bloqueia o fluxo
        console.warn('Falha ao enviar posicao:', e);
      }
    },
    () => { /* Negado ou erro - ignorar */ },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}, [data?.valid, data?.sinistro?.id, token]);
```

### Edge Function `salvar-posicao-comunicacao`

```typescript
// Recebe { token, latitude, longitude }
// Busca sinistro_evento_links pelo token
// Atualiza sinistros SET latitude_informada, longitude_informada
// WHERE latitude_informada IS NULL (nao sobrescreve)
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/public/EventoColisao.tsx` | Adicionar captura de geolocalizacao via useEffect |
| `supabase/functions/salvar-posicao-comunicacao/index.ts` | Nova edge function para salvar lat/lng no sinistro |
| `supabase/config.toml` | Registrar nova edge function |

## Resultado

O analista vera automaticamente no mapa (ja existente no `EventoAnaliseDetalhe.tsx`) a posicao de onde o associado estava quando abriu o link do evento, comparada com a posicao do rastreador.
