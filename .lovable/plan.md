
# Revisao Completa - Dados do Rastreador Softruck no Modulo de Eventos (Sinistros)

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Buscar ultima posicao ao comunicar evento | **NAO IMPLEMENTADO** | Edge function `criar-sinistro` recebe lat/lng mas NAO grava |
| Buscar historico de trajeto na analise | **IMPLEMENTADO** | `TrajetoSinistroCard` busca 24h antes do sinistro |
| Buscar posicoes para suspeita de fraude | **NAO IMPLEMENTADO** | Nao ha fluxo para consultas ampliadas |
| Confirmar posicao na recuperacao | **IMPLEMENTADO** | `acionar-roubo-furto` grava ultima posicao |
| Historico anexado ao dossie | **NAO IMPLEMENTADO** | Trajeto apenas exibido, nao salvo |
| Posicao gravada como evidencia | **NAO IMPLEMENTADO** | Tabela `sinistros` nao tem campos lat/lng |
| Exportar relatorio de trajeto | **NAO IMPLEMENTADO** | Nao existe funcionalidade de exportacao |
| Dados do rastreador na decisao | **NAO IMPLEMENTADO** | `EmitirParecerModal` nao exibe dados do rastreador |

---

## Analise Detalhada

### 1. Quando um Evento e Comunicado - Buscar Ultima Posicao Conhecida

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`
**Arquivo Frontend:** `src/pages/app/NovoSinistro.tsx`

**Situacao Atual:**
- O formulario do app coleta latitude/longitude via mapa interativo (linhas 357-358)
- O payload e enviado para a edge function com os campos `latitude` e `longitude`
- **PROBLEMA:** A edge function recebe mas NAO grava esses dados

```typescript
// NovoSinistro.tsx - ENVIA lat/lng
const resultado = await createSinistro.mutateAsync({
  ...
  latitude: coordenadas?.[0],    // Enviado
  longitude: coordenadas?.[1],   // Enviado
});

// criar-sinistro/index.ts - NAO GRAVA lat/lng
const { data: sinistro } = await supabaseAdmin
  .from('sinistros')
  .insert({
    // NÃO POSSUI:
    // latitude: payload.latitude,
    // longitude: payload.longitude,
  })
```

**Gap Critico:** A tabela `sinistros` **nao possui** colunas `latitude`, `longitude` para gravar a posicao do evento como evidencia.

**Alem disso:** O sistema **NAO** busca a ultima posicao conhecida do rastreador ao comunicar o sinistro, perdendo uma evidencia crucial de onde o veiculo estava antes/durante o evento.

---

### 2. Quando Ha Analise de Sinistro - Buscar Historico de Trajeto

**Arquivo:** `src/components/sinistros/TrajetoSinistroCard.tsx`
**Edge Function:** `supabase/functions/rastreador-historico/index.ts`

**Situacao Atual - IMPLEMENTADO:**
- O componente `TrajetoSinistroCard` e exibido na pagina `SinistroDetalhe.tsx` (linha 835-841)
- Busca automaticamente o trajeto das 24h anteriores ao sinistro
- Usa a edge function `rastreador-historico` que chama API Softruck `/vehicles/{id}/trajectories/`
- Exibe mapa com trajeto, paradas e marcador do local do sinistro

```typescript
// TrajetoSinistroCard.tsx - Busca 24h antes
const dataFim = dataOcorrencia ? new Date(dataOcorrencia) : new Date();
const dataInicio = subHours(dataFim, 24);

const { data: historico } = useQuery({
  queryFn: async () => {
    const { data } = await supabase.functions.invoke('rastreador-historico', {
      body: {
        rastreador_id: rastreador!.id,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
      },
    });
    return data;
  },
});
```

**Funcionalidades Presentes:**
- Mapa visual com trajeto
- Identificacao de paradas (>5 minutos)
- Marcador do local do sinistro (ultima posicao)
- Indicador de fonte (API ou local)
- Modo fullscreen para analise detalhada

**Limitacoes:**
- Dados NAO sao salvos/anexados ao dossie
- Periodo fixo de 24h (nao personalizavel)
- Sem opcao de exportar

---

### 3. Quando Ha Suspeita de Fraude - Buscar Posicoes Anteriores e Posteriores

**Situacao Atual - NAO IMPLEMENTADO:**

O sistema possui o status `em_sindicancia` para investigacoes especiais, mas:

- Nao ha interface para consultar periodos personalizados de trajeto
- Nao ha comparacao automatica de posicoes (antes/depois do evento)
- Nao ha analise de padroes suspeitos (ex: veiculo parado no local de "roubo" por horas)
- Nao ha integracao com o fluxo de sindicancia

**Workflow Existente:**
```typescript
// types/sinistros.ts
WORKFLOW_SINISTRO = {
  comunicado: ['em_analise', 'em_sindicancia', 'cancelado'],
  em_sindicancia: ['em_analise', 'aprovado', 'negado', 'cancelado'],
};
```

O analista pode marcar como "Em Sindicancia", mas nao ha ferramentas de investigacao do rastreador.

---

### 4. Quando o Veiculo e Recuperado - Confirmar Posicao Atual

**Arquivo:** `supabase/functions/acionar-roubo-furto/index.ts`

**Situacao Atual - PARCIALMENTE IMPLEMENTADO:**

No acionamento de recuperacao:
- Busca ultima posicao do rastreador do banco local (linhas 172-180)
- Grava posicao no registro de acionamento (linhas 196-198)
- Envia posicao via WhatsApp para central de monitoramento (linhas 450-452)

```typescript
// acionar-roubo-furto/index.ts
let ultimaPosicao = null;
if (rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng) {
  ultimaPosicao = {
    lat: rastreador.ultima_posicao_lat,
    lng: rastreador.ultima_posicao_lng,
    data: rastreador.ultima_comunicacao,
  };
}

// Grava no acionamento
await supabaseAdmin.from("acionamentos_roubo_furto").insert({
  ultima_posicao_lat: ultimaPosicao?.lat,
  ultima_posicao_lng: ultimaPosicao?.lng,
  ultima_posicao_data: ultimaPosicao?.data,
});
```

**Gap:** Nao ha funcionalidade para confirmar recuperacao e gravar posicao final quando o veiculo e localizado.

---

## Gaps Identificados e Impacto

### Gap 1: Posicao Nao Gravada Como Evidencia

**Impacto: ALTO**
- Posicao enviada pelo usuario no app e perdida
- Posicao do rastreador no momento do sinistro nao e capturada
- Auditoria comprometida em caso de questionamento

**Campos Ausentes na Tabela `sinistros`:**
- `latitude_informada` - Posicao informada pelo usuario
- `longitude_informada`
- `rastreador_lat_momento` - Posicao do rastreador no momento
- `rastreador_lng_momento`
- `rastreador_posicao_capturada_em`
- `snapshot_trajeto_json` - Trajeto 24h para auditoria

---

### Gap 2: Trajeto Nao Anexado ao Dossie

**Impacto: MEDIO**
- Dados de trajeto sao efemeros (buscados sob demanda)
- Se API Softruck ficar indisponivel, perde-se evidencia
- Nao ha snapshot historico para auditoria futura

---

### Gap 3: Sem Exportacao de Relatorio de Trajeto

**Impacto: MEDIO**
- Nao e possivel gerar PDF com trajeto para anexar a processos juridicos
- Nao ha como compartilhar dados de forma documental

---

### Gap 4: Dados do Rastreador Nao Considerados na Decisao

**Impacto: MEDIO**
- `EmitirParecerModal` nao exibe informacoes do rastreador
- Analista nao ve trajeto/posicoes ao emitir parecer
- Decisao baseada apenas em documentos, sem validacao GPS

---

## Plano de Correcoes Recomendado

### Fase 1: Adicionar Campos de Posicao na Tabela Sinistros

**SQL Migration:**
```sql
ALTER TABLE sinistros ADD COLUMN latitude_informada DECIMAL(10,8);
ALTER TABLE sinistros ADD COLUMN longitude_informada DECIMAL(11,8);
ALTER TABLE sinistros ADD COLUMN rastreador_lat_momento DECIMAL(10,8);
ALTER TABLE sinistros ADD COLUMN rastreador_lng_momento DECIMAL(11,8);
ALTER TABLE sinistros ADD COLUMN rastreador_posicao_capturada_em TIMESTAMPTZ;
ALTER TABLE sinistros ADD COLUMN snapshot_trajeto_json JSONB;
```

### Fase 2: Atualizar Edge Function criar-sinistro

**Modificar:** `supabase/functions/criar-sinistro/index.ts`

1. Gravar latitude/longitude informadas pelo usuario
2. Buscar rastreador do veiculo
3. Buscar ultima posicao do rastreador via API ou banco
4. Gravar posicao do rastreador como evidencia
5. Opcionalmente: buscar e gravar snapshot do trajeto 24h

```typescript
// Buscar rastreador e posicao
const { data: rastreador } = await supabaseAdmin
  .from('rastreadores')
  .select('id, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao')
  .eq('veiculo_id', payload.veiculo_id)
  .eq('status', 'instalado')
  .maybeSingle();

// Inserir com posicoes
const { data: sinistro } = await supabaseAdmin
  .from('sinistros')
  .insert({
    // ... campos existentes ...
    latitude_informada: payload.latitude,
    longitude_informada: payload.longitude,
    rastreador_lat_momento: rastreador?.ultima_posicao_lat,
    rastreador_lng_momento: rastreador?.ultima_posicao_lng,
    rastreador_posicao_capturada_em: rastreador?.ultima_comunicacao,
  });
```

### Fase 3: Funcionalidade de Snapshot de Trajeto

**Novo componente:** `src/components/sinistros/SalvarTrajetoButton.tsx`

Botao para o analista:
1. Buscar trajeto via API
2. Gravar JSON no campo `snapshot_trajeto_json`
3. Confirmar salvamento

### Fase 4: Exportar Relatorio de Trajeto em PDF

**Novo arquivo:** `src/components/sinistros/ExportarTrajetoPDF.tsx`

Gerar PDF contendo:
- Mapa estatico do trajeto (via API de mapas)
- Lista de paradas
- Dados de velocidade media
- Posicao no momento do sinistro
- Comparacao posicao informada vs rastreador

### Fase 5: Consulta de Periodos Personalizados (Sindicancia)

**Novo componente:** `src/components/sinistros/ConsultaTrajetoAvancada.tsx`

Para analise de fraude:
- Selector de data inicio/fim
- Buscar trajeto de qualquer periodo
- Comparar posicoes antes e depois do evento
- Identificar inconsistencias

### Fase 6: Exibir Dados do Rastreador no Parecer

**Modificar:** `src/components/eventos/EmitirParecerModal.tsx`

Adicionar secao com:
- Posicao informada vs posicao do rastreador
- Distancia entre as posicoes
- Ultima comunicacao do rastreador
- Link para ver trajeto completo

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/sinistros/SalvarTrajetoButton.tsx` | Botao para anexar trajeto ao dossie |
| `src/components/sinistros/ExportarTrajetoPDF.tsx` | Exportar trajeto para PDF |
| `src/components/sinistros/ConsultaTrajetoAvancada.tsx` | Consulta periodos personalizados |
| `src/components/sinistros/ComparacaoPosicoes.tsx` | Comparar posicao informada vs rastreador |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/criar-sinistro/index.ts` | Gravar lat/lng e buscar posicao rastreador |
| `src/components/eventos/EmitirParecerModal.tsx` | Adicionar dados do rastreador |
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar opcoes de exportacao |
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Adicionar botoes de salvar/exportar |

## Migracao SQL

Necessaria para adicionar campos de posicao na tabela `sinistros`.

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Ao comunicar sinistro, posicao do usuario e gravada
- [ ] Ao comunicar sinistro, posicao do rastreador e capturada automaticamente
- [ ] Trajeto de 24h disponivel na tela de analise
- [ ] Analista pode salvar snapshot do trajeto no dossie
- [ ] Analista pode exportar trajeto para PDF
- [ ] Para sindicancia, e possivel consultar periodos personalizados
- [ ] Ao emitir parecer, dados do rastreador sao exibidos
- [ ] Ao recuperar veiculo, posicao final e gravada
- [ ] Comparacao posicao informada vs rastreador esta visivel

---

## Teste Recomendado

1. **Login como associado** no app
2. **Comunicar sinistro de colisao**:
   - Selecionar local no mapa
   - Preencher descricao
   - Enviar
3. **Login como analista**
4. **Abrir sinistro comunicado**
5. **Verificar:**
   - Posicao informada pelo usuario aparece
   - Posicao do rastreador no momento aparece
   - Trajeto de 24h esta carregando
   - Mapa exibe rota e local do sinistro
6. **Emitir parecer:**
   - Verificar se dados do rastreador estao visiveis
   - Confirmar distancia entre posicao informada e rastreador
7. **Exportar relatorio PDF** (apos implementacao)
