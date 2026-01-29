
# Revisao Completa - Dados do Rastreador Softruck no Modulo de Assistencia 24h

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Buscar posicao atual quando chamado entra | **NAO IMPLEMENTADO** | Usa apenas GPS do celular do associado |
| Enviar localizacao para prestador | **PARCIALMENTE** | Envia link Google Maps apenas com coordenadas informadas |
| Atualizar posicao em tempo real | **NAO IMPLEMENTADO** | Nao ha atualizacao durante acompanhamento |
| Registrar posicao final ao encerrar | **NAO IMPLEMENTADO** | Historico nao possui campo de posicao |
| Posicao exibida no mapa para atendente | **PARCIALMENTE** | Exibe coordenadas informadas, nao do rastreador |
| Prestador recebe link com localizacao | **PARCIALMENTE** | Recebe posicao estatica, nao atualizada |
| Historico inclui posicoes durante atendimento | **NAO IMPLEMENTADO** | Tabela historico sem campos lat/lng |
| Rastreador fornece posicao se associado nao sabe | **NAO IMPLEMENTADO** | Nao ha fallback para rastreador |

---

## Analise Detalhada

### 1. Quando o Chamado Entra no Sistema - Buscar Posicao Atual

**Arquivos Analisados:**
- `supabase/functions/criar-chamado-assistencia/index.ts`
- `src/pages/app/AppAssistenciaNova.tsx`

**Situacao Atual:**

O fluxo de criacao de chamado:
1. Associado abre o app e solicita assistencia
2. App captura GPS do celular via `navigator.geolocation.getCurrentPosition`
3. Edge function `criar-chamado-assistencia` recebe `latitude` e `longitude`
4. Grava na tabela `chamados_assistencia` nos campos `origem_lat` e `origem_lng`

```typescript
// AppAssistenciaNova.tsx - linha 216-260
const handleGetGPS = async () => {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
  // Usa GPS do celular, NAO do rastreador
};
```

**Gap Critico:** O sistema **NAO** busca a posicao do rastreador Softruck quando o chamado entra. Isso e problematico porque:
- Associado pode estar em local sem sinal de celular
- GPS do celular pode ser impreciso (dentro de edificios)
- O rastreador ja possui posicao precisa do veiculo

---

### 2. Quando o Prestador e Acionado - Enviar Localizacao

**Arquivos Analisados:**
- `src/components/assistencia/AtribuirPrestadorModal.tsx`
- `supabase/functions/criar-chamado-assistencia/index.ts`

**Situacao Atual:**

Ao criar chamado, envia WhatsApp para central com link do Google Maps:

```typescript
// criar-chamado-assistencia/index.ts - linha 283-316
const linkMapa = `https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`;

const mensagemCentral = `🚨 *NOVO CHAMADO DE ASSISTÊNCIA*
...
🗺️ *Ver no Mapa:* ${linkMapa}`;
```

**Gap:** Quando o atendente atribui o prestador (`AtribuirPrestadorModal`):
- **NAO** envia automaticamente WhatsApp para o prestador
- **NAO** compartilha link com localizacao
- Prestador recebe apenas ligacao manual do atendente

Nao existe funcionalidade para:
- Enviar link atualizado de posicao do rastreador
- Compartilhar localizacao em tempo real
- Usar posicao do rastreador em vez do GPS do celular

---

### 3. Quando Ha Acompanhamento do Chamado - Atualizar Posicao

**Arquivos Analisados:**
- `src/pages/app/AcompanharChamado.tsx`
- `src/pages/assistencia/ChamadoDetalhe.tsx`

**Situacao Atual:**

No app do associado (`AcompanharChamado.tsx`):
- Exibe mapa com marcador **ESTATICO** na posicao original
- Nao atualiza posicao durante acompanhamento
- Usa coordenadas salvas em `origem_lat` e `origem_lng`

```typescript
// AcompanharChamado.tsx - linha 460-474
<Marker 
  position={[chamado.origem_lat, chamado.origem_lng]}
  icon={origemIcon}
>
  <Popup>Sua localização</Popup>
</Marker>
```

Na central (`ChamadoDetalhe.tsx`):
- Exibe placeholder "Visualização de mapa (em breve)" - **linha 359-364**
- Mapa nao esta implementado para o atendente

**Gap Critico:**
- Nenhuma atualizacao de posicao durante o atendimento
- Nao consulta API Softruck para posicao em tempo real
- Nao registra movimentacao do veiculo

---

### 4. Quando o Chamado e Encerrado - Registrar Posicao Final

**Tabela Analisada:**
- `chamados_assistencia_historico`

**Colunas disponiveis:**
| Campo | Tipo |
|-------|------|
| id | uuid |
| chamado_id | uuid |
| status_anterior | varchar |
| status_novo | varchar |
| usuario_id | uuid |
| observacao | text |
| created_at | timestamp |

**Gap:** A tabela historico **NAO possui** campos para:
- `latitude` / `longitude` do momento da mudanca de status
- `posicao_rastreador_lat` / `posicao_rastreador_lng`
- `posicao_capturada_em` - timestamp da posicao

Ao encerrar chamado:
- Nao grava posicao final do veiculo
- Nao consulta rastreador para confirmar localizacao
- Perde auditoria de onde o veiculo estava

---

## Gaps Identificados e Impacto

### Gap 1: Nao Utiliza Posicao do Rastreador

**Impacto: ALTO**

Cenario problematico:
1. Associado sofre pane em estrada sem sinal de celular
2. App nao consegue capturar GPS
3. Associado informa endereco aproximado por texto
4. Prestador vai para local errado

Se o sistema consultasse o rastreador:
- Teria posicao precisa independente do celular
- Poderia sugerir endereco ao associado
- Prestador chegaria mais rapido

### Gap 2: Prestador Nao Recebe Link de Localizacao

**Impacto: MEDIO**

Fluxo atual:
1. Central recebe chamado com link
2. Atendente liga para prestador
3. Repassa endereco verbalmente ou por WhatsApp manual
4. Prestador digita endereco no GPS

Fluxo ideal:
1. Ao despachar prestador, sistema envia automaticamente
2. WhatsApp com link de localizacao atualizada
3. Link consulta rastreador em tempo real
4. Prestador abre e vai direto

### Gap 3: Sem Atualizacao em Tempo Real

**Impacto: MEDIO**

Se veiculo estiver sendo rebocado:
- Posicao inicial fica desatualizada
- Prestador pode ir para lugar errado
- Sem tracking do deslocamento

### Gap 4: Historico Sem Posicoes

**Impacto: BAIXO**

Para auditoria e analise:
- Nao sabe onde prestador estava ao aceitar
- Nao sabe onde estava ao concluir
- Perde metricas de deslocamento

---

## Plano de Implementacao

### Fase 1: Adicionar Campos de Rastreador na Tabela

**SQL Migration:**
```sql
-- Campos na tabela chamados_assistencia
ALTER TABLE chamados_assistencia 
  ADD COLUMN rastreador_lat DECIMAL(10,8),
  ADD COLUMN rastreador_lng DECIMAL(11,8),
  ADD COLUMN rastreador_posicao_capturada_em TIMESTAMPTZ,
  ADD COLUMN rastreador_endereco TEXT;

-- Campos na tabela chamados_assistencia_historico  
ALTER TABLE chamados_assistencia_historico
  ADD COLUMN latitude DECIMAL(10,8),
  ADD COLUMN longitude DECIMAL(11,8),
  ADD COLUMN posicao_fonte VARCHAR(20); -- 'rastreador', 'gps', 'manual'
```

### Fase 2: Modificar Edge Function criar-chamado-assistencia

**Alteracoes:**

1. Buscar rastreador do veiculo
2. Consultar posicao via API Softruck
3. Gravar posicao do rastreador como alternativa/complemento
4. Se GPS do celular nao disponivel, usar rastreador

```typescript
// Buscar rastreador do veiculo
const { data: rastreador } = await supabaseAdmin
  .from('rastreadores')
  .select('id, plataforma, plataforma_device_id, plataforma_veiculo_id, ultima_posicao_lat, ultima_posicao_lng')
  .eq('veiculo_id', veiculo.id)
  .eq('status', 'instalado')
  .maybeSingle();

// Se tem rastreador, buscar posicao atualizada
if (rastreador?.plataforma === 'softruck' && rastreador.plataforma_veiculo_id) {
  const posicaoResult = await supabaseAdmin.functions.invoke('posicao-veiculo', {
    body: { veiculo_id: veiculo.id }
  });
  
  if (posicaoResult.data?.posicao) {
    // Gravar posicao do rastreador
    rastreadorLat = posicaoResult.data.posicao.latitude;
    rastreadorLng = posicaoResult.data.posicao.longitude;
  }
}

// Se associado nao informou localizacao, usar rastreador
if (!payload.latitude || !payload.longitude) {
  payload.latitude = rastreadorLat || rastreador?.ultima_posicao_lat;
  payload.longitude = rastreadorLng || rastreador?.ultima_posicao_lng;
}
```

### Fase 3: Enviar Link Automatico para Prestador

**Novo arquivo:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

Botao que:
1. Gera link para pagina publica de tracking
2. Envia WhatsApp automatico para prestador
3. Link consulta posicao atualizada do rastreador

**Novo arquivo:** `src/pages/public/TrackingAssistencia.tsx`

Pagina publica (sem login) que:
1. Recebe token de chamado
2. Exibe mapa com posicao em tempo real
3. Atualiza automaticamente a cada 30 segundos
4. Consulta rastreador via API

### Fase 4: Atualizar Posicao Durante Acompanhamento

**Modificar:** `src/pages/app/AcompanharChamado.tsx`

Adicionar:
1. Polling de posicao do rastreador a cada 30s
2. Atualizar marcador no mapa
3. Exibir status do rastreador (online/offline)
4. Mostrar ultima atualizacao

**Modificar:** `src/pages/assistencia/ChamadoDetalhe.tsx`

Implementar:
1. Mapa real (nao placeholder)
2. Marcador com posicao do rastreador
3. Botao "Atualizar Posicao"
4. Historico de posicoes

### Fase 5: Registrar Posicoes no Historico

**Modificar:** `src/components/assistencia/AtualizarStatusChamadoModal.tsx`

Ao mudar status:
1. Buscar posicao atual do rastreador
2. Gravar no historico
3. Registrar fonte (rastreador/gps)

### Fase 6: Exibir Opcao "Usar Posicao do Rastreador"

**Modificar:** `src/pages/app/AppAssistenciaNova.tsx`

Adicionar:
1. Botao "Usar posicao do rastreador"
2. Consultar API e exibir endereco
3. Fallback se GPS do celular falhar
4. Badge indicando fonte da posicao

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/assistencia/EnviarLinkPrestadorButton.tsx` | Botao para enviar WhatsApp com link |
| `src/pages/public/TrackingAssistencia.tsx` | Pagina publica de tracking |
| `src/components/assistencia/MapaChamado.tsx` | Mapa do chamado com rastreador |
| `src/hooks/useChamadoPosicaoTempoReal.ts` | Hook para posicao em tempo real |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/criar-chamado-assistencia/index.ts` | Buscar e gravar posicao do rastreador |
| `src/pages/app/AppAssistenciaNova.tsx` | Adicionar opcao "usar rastreador" |
| `src/pages/app/AcompanharChamado.tsx` | Atualizar posicao em tempo real |
| `src/pages/assistencia/ChamadoDetalhe.tsx` | Implementar mapa real |
| `src/components/assistencia/AtribuirPrestadorModal.tsx` | Adicionar envio de link |
| `src/components/assistencia/AtualizarStatusChamadoModal.tsx` | Gravar posicao ao mudar status |

## SQL Migrations

Necessarias para adicionar campos de posicao do rastreador.

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Ao abrir chamado, posicao do rastreador e capturada
- [ ] Se GPS do celular falhar, rastreador e usado como fallback
- [ ] Central ve mapa com posicao do rastreador em tempo real
- [ ] Ao despachar prestador, WhatsApp com link e enviado automaticamente
- [ ] Link do prestador abre mapa com posicao atualizada
- [ ] Durante acompanhamento, posicao atualiza a cada 30s
- [ ] Ao mudar status, posicao e registrada no historico
- [ ] Ao encerrar chamado, posicao final e gravada
- [ ] Associado pode escolher "usar posicao do rastreador"
- [ ] Card de veiculo no chamado mostra status do rastreador

---

## Teste Recomendado: Chamado de Guincho

### Pre-requisitos

1. Associado com veiculo que possui rastreador Softruck instalado
2. Rastreador comunicando (posicao disponivel)
3. `SOFTRUCK_PUBLIC_KEY` valida

### Passos do Teste

1. **Login como associado** no app (`/app/login`)
2. **Solicitar assistencia de guincho**
   - Verificar se botao "Usar posicao do rastreador" aparece
   - Clicar e confirmar que endereco e preenchido automaticamente
3. **Enviar solicitacao**
4. **Login como atendente** (`/assistencia`)
5. **Abrir chamado**
   - Verificar se mapa exibe posicao do rastreador
   - Confirmar que coordenadas sao do rastreador (nao do GPS)
6. **Atribuir prestador**
   - Verificar se opcao "Enviar Link" aparece
   - Clicar e confirmar que WhatsApp abre com link
7. **Abrir link enviado ao prestador**
   - Confirmar que mapa exibe posicao atualizada
   - Aguardar 30s e verificar se atualiza
8. **Mudar status para "A caminho"**
   - Verificar se posicao foi registrada no historico
9. **Concluir chamado**
   - Confirmar posicao final gravada

### Resultado Esperado

- Posicao do rastreador aparece em todas as etapas
- Prestador recebe link funcional com mapa
- Historico mostra posicoes de cada mudanca de status
