
# Plano: Corrigir Geocodificação na Criação de Instalações

## Problema Identificado

A instalação do associado MARCUS VINICIUS foi criada **sem coordenadas GPS** porque o código que cria instalações após aprovação de autovistoria (em `usePropostasPendentes.ts`) **não geocodifica o endereço**.

### Dados Atuais

| Tabela | Campo | Valor |
|--------|-------|-------|
| `servicos` | `latitude` | `null` |
| `servicos` | `longitude` | `null` |
| `instalacoes` | `endereco_latitude` | `null` |
| `instalacoes` | `endereco_longitude` | `null` |
| `servicos` | `logradouro` | EST CAFUNDA |
| `servicos` | `bairro` | TANQUE |
| `servicos` | `cidade` | RIO DE JANEIRO |

### Fluxo do Problema

```text
Analista aprova autovistoria
        ↓
Código cria instalação com endereço do associado
        ↓
❌ NÃO GEOCODIFICA o endereço (lat/lng ficam null)
        ↓
Trigger sincroniza para tabela servicos (também sem coords)
        ↓
Vistoriador inicia serviço
        ↓
Edge Function busca serviços disponíveis
        ↓
1 serviço encontrado
        ↓
Filtro remove serviços sem coordenadas
        ↓
0 serviços restantes
        ↓
"Aguardando tarefas..." (mas tem tarefa!)
```

## Solução

### 1. Adicionar Geocodificação na Aprovação de Autovistoria

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linhas ~1403-1421)

Antes de criar a instalação, chamar a Edge Function `geocode-endereco` para obter as coordenadas:

```typescript
// Geocodificar endereço do associado antes de criar instalação
let endereco_latitude: number | null = null;
let endereco_longitude: number | null = null;

if (associadoData?.logradouro && associadoData?.cidade) {
  try {
    const { data: geoResult } = await supabase.functions.invoke('geocode-endereco', {
      body: {
        logradouro: associadoData.logradouro,
        numero: associadoData.numero,
        bairro: associadoData.bairro,
        cidade: associadoData.cidade,
        uf: associadoData.uf,
        cep: associadoData.cep,
      }
    });
    
    if (geoResult?.latitude && geoResult?.longitude) {
      endereco_latitude = geoResult.latitude;
      endereco_longitude = geoResult.longitude;
      console.log(`Geocodificação OK: (${endereco_latitude}, ${endereco_longitude})`);
    }
  } catch (geoError) {
    console.warn('Geocodificação falhou, continuando sem coordenadas:', geoError);
  }
}

// Criar instalação COM coordenadas
const { error: instalacaoError } = await supabase
  .from('instalacoes')
  .insert({
    associado_id: associadoId,
    veiculo_id: veiculoId,
    contrato_id: contratoId,
    status: 'agendada',
    data_agendada: dataAgendada,
    periodo: 'manha',
    logradouro: associadoData?.logradouro || null,
    numero: associadoData?.numero || null,
    bairro: associadoData?.bairro || null,
    cidade: associadoData?.cidade || null,
    uf: associadoData?.uf || null,
    cep: associadoData?.cep || null,
    endereco_latitude,     // ✅ NOVO
    endereco_longitude,    // ✅ NOVO
    local_vistoria: 'cliente',
  } as any);
```

### 2. Corrigir Edge Function `criar-instalacao-pos-pagamento`

**Arquivo:** `supabase/functions/criar-instalacao-pos-pagamento/index.ts` (linhas 205-222)

O código atual tem um bug onde usa campos errados para autovistoria:

```typescript
// ANTES (BUG - linhas 216-217)
latitude: cotacao.vistoria_endereco_latitude,  // ← Errado!
longitude: cotacao.vistoria_endereco_longitude,

// DEPOIS (CORREÇÃO)
// Se for autovistoria, buscar vistoria_completa_endereco_* para coords
// Como não existe essa coluna, fazer geocodificação do endereço
```

Adicionar geocodificação quando coordenadas estão ausentes:

```typescript
// 5.2 Se não tiver coordenadas, geocodificar
if (!endereco.latitude || !endereco.longitude && endereco.logradouro && endereco.cidade) {
  try {
    const geoResponse = await fetch(`${supabaseUrl}/functions/v1/geocode-endereco`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.estado,
        cep: endereco.cep,
      }),
    });
    
    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      if (geoData.latitude && geoData.longitude) {
        endereco.latitude = geoData.latitude;
        endereco.longitude = geoData.longitude;
        console.log(`[CriarInstalacaoPosPagamento] Geocodificado: (${endereco.latitude}, ${endereco.longitude})`);
      }
    }
  } catch (geoError) {
    console.warn('[CriarInstalacaoPosPagamento] Geocodificação falhou:', geoError);
  }
}
```

### 3. Corrigir Dados Existentes (Migração Pontual)

Executar SQL para geocodificar a instalação do MARCUS:

```sql
-- Atualizar instalação existente com coordenadas aproximadas do endereço
-- EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO, RJ
UPDATE instalacoes
SET endereco_latitude = -22.9208,  -- Aproximado para Tanque, RJ
    endereco_longitude = -43.3589
WHERE id = 'ca79d033-abbe-4767-8ad7-999d5c03130d';

-- O trigger irá sincronizar para a tabela servicos automaticamente
```

Ou chamar a função de geocodificação via SQL/Edge Function.

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePropostasPendentes.ts` | Adicionar geocodificação antes de criar instalação na aprovação de autovistoria |
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Adicionar fallback de geocodificação quando coords ausentes |

## Seção Técnica

### Trigger de Sincronização

A tabela `servicos` é populada via trigger SQL (`trigger_sync_instalacao_to_servicos`) que copia dados da `instalacoes`. Os campos mapeados incluem:
- `latitude` ← `endereco_latitude`
- `longitude` ← `endereco_longitude`

Portanto, corrigir a fonte (`instalacoes`) automaticamente corrige o destino (`servicos`).

### Edge Function `geocode-endereco`

Já existe e funciona corretamente. Usa a API Nominatim (OpenStreetMap) para geocodificação. Rate limit de 1 req/seg.

### Fallback

Se a geocodificação falhar:
1. Logar warning no console
2. Continuar criando instalação sem coordenadas
3. O serviço ficará pendente de atribuição manual até coordenadas serem adicionadas

### Correção Imediata do Caso Atual

Para corrigir o caso do MARCUS imediatamente sem esperar deploy:

```sql
-- 1. Atualizar instalação
UPDATE instalacoes
SET endereco_latitude = -22.9208,
    endereco_longitude = -43.3589
WHERE id = 'ca79d033-abbe-4767-8ad7-999d5c03130d';

-- 2. Forçar sync para servicos (trigger deve fazer automaticamente)
UPDATE servicos
SET latitude = -22.9208,
    longitude = -43.3589
WHERE id = 'bf662bc2-29f1-4de1-8d1e-17bf5c672854';
```

## Resultado Esperado

### Antes (Bug)
- Instalação criada sem coordenadas
- Serviço filtrado pelo algoritmo de atribuição
- Vistoriador fica "Aguardando tarefas" mesmo com tarefa pendente

### Depois (Corrigido)
- Instalação criada COM coordenadas geocodificadas
- Serviço passa pelo filtro de atribuição
- Vistoriador recebe tarefa automaticamente

### Logs Esperados
```
[atribuir-proxima-tarefa] Serviços encontrados: 1 normais + 0 encaixes futuros
[atribuir-proxima-tarefa] 1 serviços disponíveis no total
[atribuir-proxima-tarefa] 1 serviços após filtragem  ← CORRIGIDO!
[atribuir-proxima-tarefa] Tentando atribuir instalacao bf662bc2-... (X.XX km)
```
