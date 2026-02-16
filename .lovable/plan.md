
# Geocodificar Local na IA + Pre-preencher Link do Evento

## Problema Atual

1. Quando a IA (WhatsApp ou App) cria um sinistro, o campo `local` e salvo apenas como texto em `sinistros.local_ocorrencia` -- sem geocodificacao (sem lat/lng)
2. Quando o link do evento e gerado para o associado, o campo "Rua" e "Numero" na Etapa 3 vem vazio, mesmo que o associado ja tenha informado o local na conversa com a IA
3. O mapa de evidencia so mostra o pino do local informado se `latitude_informada` e `longitude_informada` existirem no sinistro

## Solucao

### 1. Geocodificar o local ao criar sinistro via IA

**Arquivos:** `supabase/functions/whatsapp-webhook/index.ts` e `supabase/functions/assistente-chat/index.ts`

Apos o INSERT do sinistro (onde `local_ocorrencia: args.local`), adicionar geocodificacao via Nominatim:

```typescript
// Apos criar sinistro com sucesso
if (args.local) {
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.local + ', Brasil')}&limit=1`;
    const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'PraticConnect/1.0' } });
    const geoData = await geoRes.json();
    if (geoData.length > 0) {
      await supabase.from('sinistros').update({
        latitude_informada: parseFloat(geoData[0].lat),
        longitude_informada: parseFloat(geoData[0].lon),
      }).eq('id', sinistroNovo.id);
    }
  } catch (e) { console.error('Geo error:', e); }
}
```

Isso garante que sinistros criados via IA ja tenham coordenadas para o mapa de evidencia.

### 2. Incluir `local_ocorrencia` na resposta do `validar-link-evento`

**Arquivo:** `supabase/functions/validar-link-evento/index.ts`

Adicionar `local_ocorrencia` no SELECT do sinistro para que o frontend tenha acesso ao endereco ja informado:

```typescript
// Linha 68: adicionar local_ocorrencia ao select
.select(`
  id, protocolo, tipo, data_ocorrencia, descricao, local_ocorrencia,
  associado:associados(id, nome, telefone, whatsapp, email),
  veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor, valor_fipe)
`)
```

E incluir na resposta:

```typescript
sinistro: sinistro ? {
  ...
  local_ocorrencia: sinistro.local_ocorrencia,
} : null,
```

### 3. Pre-preencher Rua/Numero na Etapa 3 do link

**Arquivo:** `src/pages/public/EventoColisao.tsx`

Passar `sinistro.local_ocorrencia` para o componente `EventoEtapa3Relato`:

```typescript
<EventoEtapa3Relato 
  token={token!} 
  onComplete={handleStepComplete}
  localPadrao={sinistro?.local_ocorrencia}
/>
```

**Arquivo:** `src/components/evento/EventoEtapa3Relato.tsx`

Aceitar a prop `localPadrao` e usar como valor inicial do campo "Rua":

```typescript
interface Props {
  token: string;
  onComplete: () => void;
  localPadrao?: string;
}

// No componente:
const [rua, setRua] = useState(localPadrao || '');
```

## Fluxo Resultante

```text
Associado informa local na IA (WhatsApp/App)
    |
    v
IA cria sinistro com local_ocorrencia + geocodifica (lat/lng)
    |
    v
Link do evento e gerado e enviado ao associado
    |
    v
Etapa 3 do link abre com campo "Rua" ja preenchido
    |
    v
Associado pode corrigir ou confirmar e enviar
    |
    v
Mapa de evidencia mostra pino do local informado (azul) + rastreador (verde)
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Geocodificar `args.local` apos criar sinistro |
| `supabase/functions/assistente-chat/index.ts` | Geocodificar `args.local` apos criar sinistro |
| `supabase/functions/validar-link-evento/index.ts` | Incluir `local_ocorrencia` no retorno |
| `src/pages/public/EventoColisao.tsx` | Passar `local_ocorrencia` para Etapa 3 |
| `src/components/evento/EventoEtapa3Relato.tsx` | Aceitar `localPadrao` e pre-preencher campo Rua |

Nenhuma migration necessaria -- todos os campos ja existem no banco.
