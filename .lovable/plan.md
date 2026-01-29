
# Revisao Completa - Uso de Dados da Rede Veiculos no Modulo de Eventos (Sinistros)

## Resumo Executivo

| Cenario | Status | Detalhes |
|---------|--------|----------|
| Buscar ultima posicao ao comunicar evento | **IMPLEMENTADO** | Chama `posicao-veiculo` e grava em `rastreador_lat_momento/lng_momento` |
| Verificar status do veiculo na analise | **NAO IMPLEMENTADO** | Usa apenas status local, nao consulta `/obterStatusVeiculo` |
| Acionar roubo/furto confirmado | **IMPLEMENTADO** | Edge function `acionar-roubo-furto` chama `/acionamentoRouboFurto` |
| Atualizar posicao quando veiculo recuperado | **NAO IMPLEMENTADO** | Funcionalidade de recuperacao nao existe |
| Posicao no momento do sinistro anexada ao dossie | **IMPLEMENTADO** | Campos `rastreador_lat_momento`, `rastreador_lng_momento`, `rastreador_posicao_capturada_em` |
| Status de adimplencia verificado antes de cobertura | **PARCIAL** | Verifica `associado.bloqueado` e `veiculo.status`, nao consulta plataforma |
| Acionamentos de roubo/furto geram auditoria | **IMPLEMENTADO** | Tabela `acionamentos_roubo_furto` e `rastreadores_logs` |
| Veiculos com perda total sao inativados | **IMPLEMENTADO** | `EmitirParecerModal` chama `rede-veiculos-inativar-veiculo` |

---

## Analise Detalhada

### 1. Quando Evento e Comunicado - Buscar Ultima Posicao

**Arquivo:** `supabase/functions/criar-sinistro/index.ts` (linhas 244-279)

**STATUS: IMPLEMENTADO**

O sistema busca a posicao em tempo real via `posicao-veiculo`:

```typescript
// Tentar buscar posição em tempo real para evidência (Softruck ou Rede Veículos)
if (rastreador && (rastreador.plataforma === 'softruck' || rastreador.plataforma === 'rede_veiculos')) {
  try {
    console.log('[criar-sinistro] Buscando posição em tempo real via posicao-veiculo para:', rastreador.plataforma);
    
    const posicaoResult = await fetch(
      `${supabaseUrl}/functions/v1/posicao-veiculo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ veiculo_id: payload.veiculo_id }),
      }
    );
    
    const posicaoData = await posicaoResult.json();
    
    if (posicaoData.success && posicaoData.posicao) {
      rastreadorLatMomento = posicaoData.posicao.latitude;
      rastreadorLngMomento = posicaoData.posicao.longitude;
      rastreadorPosicaoCapturadaEm = posicaoData.posicao.data_posicao || posicaoData.posicao.data_hora || new Date().toISOString();
      console.log('[criar-sinistro] Posição tempo real obtida:', rastreadorLatMomento, rastreadorLngMomento);
    }
  } catch (err) {
    console.error('[criar-sinistro] Erro ao buscar posição tempo real (usando cache):', err);
  }
}
```

**Campos Gravados no Sinistro:**
- `rastreador_lat_momento` - Latitude do rastreador no momento do comunicado
- `rastreador_lng_momento` - Longitude do rastreador no momento do comunicado
- `rastreador_posicao_capturada_em` - Data/hora da captura

**Visualizacao no Dossie:**

O componente `ComparacaoPosicoes` exibe e compara:
- Posicao informada pelo usuario (`latitude_informada`, `longitude_informada`)
- Posicao do rastreador (`rastreador_lat_momento`, `rastreador_lng_momento`)
- Calcula distancia entre ambas e classifica: "ok", "atencao" ou "suspeito"

O componente `TrajetoSinistroCard` busca o historico de 24h antes do sinistro para auditoria.

---

### 2. Quando Ha Analise de Sinistro - Verificar Status do Veiculo

**STATUS: NAO IMPLEMENTADO**

A verificacao atual no `criar-sinistro` e apenas local:

```typescript
// Verificar se veículo está ativo
if (veiculo.status !== 'ativo') {
  console.error('[criar-sinistro] Veículo não está ativo:', veiculo.status);
  return Response({ 
    success: false, 
    error: `Este veículo não está ativo (status: ${veiculo.status})...` 
  });
}
```

**Gap:** Nao existe chamada para `/obterStatusVeiculo` da Rede Veiculos para confirmar que o veiculo esta ativo na plataforma de rastreamento antes de processar o sinistro.

---

### 3. Quando Ha Roubo/Furto Confirmado - Acionar Recuperacao

**Arquivo:** `supabase/functions/acionar-roubo-furto/index.ts`

**STATUS: IMPLEMENTADO**

O sistema possui fluxo completo:

1. **Modal de Acionamento:** `AcionarRecuperacaoModal.tsx` permite selecionar modo de rastreamento (intensivo ou emergencia)

2. **Edge Function `acionar-roubo-furto`:**
   - Cria registro na tabela `acionamentos_roubo_furto`
   - Para Rede Veiculos: Chama `POST /acionamentoRouboFurto`
   - Ativa rastreamento intensivo via `POST /rastreamentoIntensivo`
   - Atualiza rastreador para modo intensivo/emergencia
   - Cria alerta critico em `rastreador_alertas`
   - Notifica diretores e analistas
   - Envia WhatsApp para central de monitoramento
   - Registra log em `rastreadores_logs`

3. **Exibicao:** `CardAcionamentoRoubo.tsx` mostra status do acionamento na tela do sinistro

**Payload enviado para Rede Veiculos:**

```typescript
const apiPayload = {
  codigo_rastreador: rastreador.codigo,
  placa: veiculo.placa,
  tipo_evento: "roubo_furto",
  prioridade: "alta",
  origem: payload.tipo_origem,
  associado_nome: associado?.nome || "Não informado",
  associado_telefone: associado?.whatsapp || associado?.telefone || "Não informado",
  ultima_posicao: ultimaPosicao ? {
    latitude: ultimaPosicao.lat,
    longitude: ultimaPosicao.lng,
    data_hora: ultimaPosicao.data,
  } : null,
  observacoes: payload.observacoes || `Acionamento via SGA - ${TIPO_ORIGEM_LABELS[payload.tipo_origem]}`,
};
```

---

### 4. Quando Veiculo e Recuperado - Atualizar Status e Posicao

**STATUS: NAO IMPLEMENTADO**

Nao existe funcionalidade para:
- Registrar que o veiculo foi recuperado
- Atualizar status do sinistro para "veiculo_recuperado"
- Encerrar o acionamento de roubo/furto com motivo "recuperado"
- Reativar o veiculo na plataforma se estava inativado
- Obter posicao de recuperacao

O hook `useEncerrarAcionamento` existe mas encerra genericamente, sem tratar especificamente a recuperacao:

```typescript
const { error } = await supabase
  .from('acionamentos_roubo_furto')
  .update({
    status: 'encerrado',
    encerrado_em: new Date().toISOString(),
    encerrado_por: profile?.id,
    motivo_encerramento: motivo,
  })
  .eq('id', acionamentoId);
```

---

### 5. Posicao no Momento do Sinistro Anexada ao Dossie

**STATUS: IMPLEMENTADO**

**Campos na tabela `sinistros`:**
- `latitude_informada` - Posicao GPS do celular do usuario
- `longitude_informada` - Posicao GPS do celular do usuario
- `rastreador_lat_momento` - Posicao do rastreador do veiculo
- `rastreador_lng_momento` - Posicao do rastreador do veiculo
- `rastreador_posicao_capturada_em` - Data/hora da captura

**Componentes de Visualizacao:**

1. `ComparacaoPosicoes.tsx` - Exibe e compara posicoes:
   - Calcula distancia entre posicao informada e rastreador
   - Classifica: <500m = OK, 500m-2km = Atencao, >2km = Suspeito

2. `TrajetoSinistroCard.tsx` - Exibe trajeto 24h antes:
   - Busca historico via `rastreador-historico`
   - Mostra mapa com polyline do trajeto
   - Permite salvar snapshot como evidencia (campo `snapshot_trajeto_json`)
   - Permite exportar PDF do trajeto

---

### 6. Status de Adimplencia Verificado Antes de Processar Cobertura

**STATUS: PARCIAL**

**Verificacoes atuais em `criar-sinistro`:**

```typescript
// 1. Verificar se associado está bloqueado
if (associado.bloqueado) {
  return Response({ success: false, error: 'Sua conta está bloqueada...' });
}

// 2. Verificar se veículo está ativo
if (veiculo.status !== 'ativo') {
  return Response({ success: false, error: 'Este veículo não está ativo...' });
}
```

**Gap:** O sistema verifica apenas status local. Nao consulta:
- `/obterStatusCliente` para verificar adimplencia na plataforma
- `/obterStatusVeiculo` para verificar se veiculo esta ativo na plataforma

---

### 7. Acionamentos de Roubo/Furto Geram Registro de Auditoria

**STATUS: IMPLEMENTADO**

**Tabelas de Auditoria:**

1. **`acionamentos_roubo_furto`** - Registro completo do acionamento:
   - `id`, `sinistro_id`, `veiculo_id`, `rastreador_id`, `associado_id`
   - `tipo_origem` (sinistro, assistencia, diretoria, manual)
   - `protocolo_externo` - Protocolo da plataforma
   - `solicitado_por`, `solicitado_por_nome`, `solicitado_em`
   - `autorizado_por`, `autorizado_por_nome`, `autorizado_em`
   - `status` (solicitado, autorizado, enviado, confirmado, erro, cancelado, encerrado)
   - `api_request`, `api_response`, `api_status_code`
   - `ultima_posicao_lat`, `ultima_posicao_lng`, `ultima_posicao_data`
   - `encerrado_em`, `encerrado_por`, `motivo_encerramento`

2. **`rastreadores_logs`** - Log tecnico da operacao:
   - `rastreador_id`, `plataforma`, `operacao`
   - `status` (sucesso, erro)
   - `tempo_resposta_ms`
   - `request`, `response`, `erro_mensagem`

3. **`rastreador_alertas`** - Alerta critico para monitoramento:
   - Tipo: `acionamento_roubo`
   - Severidade: `critica`
   - Dados do acionamento em `dados_extras`

---

### 8. Veiculos com Sinistro de Perda Total Sao Inativados Automaticamente

**STATUS: IMPLEMENTADO**

**Arquivo:** `src/components/eventos/EmitirParecerModal.tsx` (linhas 115-174)

```typescript
// Calcular tipo_dano automaticamente baseado na regra 75% FIPE
let tipoDano: 'parcial' | 'perda_total' | null = null;
if (resultado === 'aprovado' && valorIndenizacao && sinistro.valor_fipe) {
  const limite75 = sinistro.valor_fipe * 0.75;
  tipoDano = valorIndenizacao >= limite75 ? 'perda_total' : 'parcial';
}

// ...

// Se perda total, inativar veículo na plataforma e localmente
if (tipoDano === 'perda_total' && sinistro.veiculo_id) {
  console.log('[EmitirParecer] Perda total detectada, inativando veículo:', sinistro.veiculo_id);
  
  try {
    // Chamar edge function para inativar na Rede Veículos
    await supabase.functions.invoke('rede-veiculos-inativar-veiculo', {
      body: {
        veiculoId: sinistro.veiculo_id,
        motivo: 'perda_total',
        observacoes: `Sinistro ${sinistro.protocolo} aprovado como perda total`,
        atualizarBancoLocal: true,
      },
    });
    console.log('[EmitirParecer] Veículo inativado com sucesso');
  } catch (inativarError) {
    console.error('[EmitirParecer] Erro ao inativar veículo:', inativarError);
    // Mesmo se falhar na API, atualizar localmente
    await supabase.from('veiculos').update({
      ativo: false,
      observacoes: `Baixado por perda total - Sinistro ${sinistro.protocolo}`,
    }).eq('id', sinistro.veiculo_id);
  }
}
```

---

## Gaps Identificados

### Gap 1: Nao Consulta Status na Plataforma Antes do Sinistro

A funcao `criar-sinistro` verifica apenas status local. Deveria:
1. Chamar `rede-veiculos-obter-status-veiculo` antes de criar sinistro
2. Verificar se veiculo esta ativo e adimplente na plataforma
3. Bloquear se veiculo inativo na plataforma

### Gap 2: Nao Ha Fluxo de Recuperacao de Veiculo

Quando um veiculo roubado/furtado e recuperado, deveria:
1. Registrar local e data da recuperacao
2. Encerrar acionamento com motivo especifico
3. Atualizar status do sinistro
4. Reativar veiculo na plataforma (se nao for perda total)
5. Obter e gravar posicao de recuperacao

### Gap 3: Nao Verifica Adimplencia na Plataforma

O sistema verifica `associado.bloqueado` local, mas nao consulta `/obterStatusCliente` ou `/obterStatusVeiculo` para confirmar adimplencia na Rede Veiculos.

---

## Plano de Implementacao

### Fase 1: Verificar Status na Plataforma Antes de Criar Sinistro

**Modificar:** `supabase/functions/criar-sinistro/index.ts`

Apos buscar rastreador, verificar status na plataforma:

```typescript
// Apos linha 240, antes de criar sinistro
if (rastreador?.plataforma === 'rede_veiculos' && rastreador.plataforma_veiculo_id) {
  try {
    const statusResponse = await fetch(
      `${supabaseUrl}/functions/v1/rede-veiculos-obter-status-veiculo`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ veiculoId: payload.veiculo_id }),
      }
    );
    
    const statusData = await statusResponse.json();
    
    if (statusData.success) {
      // Verificar se veiculo esta ativo na plataforma
      if (statusData.dados.statusPlataforma === 'inativo') {
        return Response({
          success: false,
          error: 'Veículo inativo na plataforma de rastreamento. Entre em contato com a central.',
        });
      }
      
      // Verificar adimplencia
      if (statusData.dados.adimplente === false) {
        return Response({
          success: false,
          error: 'Existem pendências financeiras que precisam ser regularizadas antes de abrir sinistro.',
        });
      }
    }
  } catch (err) {
    console.warn('[criar-sinistro] Erro ao verificar status plataforma:', err);
    // Nao bloqueia se API falhar
  }
}
```

### Fase 2: Criar Fluxo de Recuperacao de Veiculo

**Novo arquivo:** `src/hooks/useRegistrarRecuperacao.ts`

```typescript
export function useRegistrarRecuperacao() {
  return useMutation({
    mutationFn: async ({ 
      acionamentoId, 
      sinistroId,
      veiculoId,
      localRecuperacao,
      dataRecuperacao,
      observacoes,
      reativarVeiculo = false,
    }) => {
      // 1. Encerrar acionamento
      await supabase.from('acionamentos_roubo_furto').update({
        status: 'encerrado',
        motivo_encerramento: 'veiculo_recuperado',
        encerrado_em: new Date().toISOString(),
      }).eq('id', acionamentoId);
      
      // 2. Atualizar sinistro
      await supabase.from('sinistros').update({
        // Adicionar campo para indicar recuperacao
        updated_at: new Date().toISOString(),
      }).eq('id', sinistroId);
      
      // 3. Voltar rastreador para modo normal
      const { data: acionamento } = await supabase
        .from('acionamentos_roubo_furto')
        .select('rastreador_id')
        .eq('id', acionamentoId)
        .single();
        
      if (acionamento?.rastreador_id) {
        await supabase.from('rastreadores').update({
          modo_rastreamento: 'normal',
          modo_ativado_em: null,
          acionamento_ativo_id: null,
        }).eq('id', acionamento.rastreador_id);
      }
      
      // 4. Se deve reativar veiculo na plataforma
      if (reativarVeiculo) {
        await supabase.functions.invoke('rede-veiculos-ativar-veiculo', {
          body: {
            veiculoId,
            motivo: 'recuperado',
            observacoes: `Veículo recuperado em ${localRecuperacao}`,
          },
        });
      }
      
      // 5. Registrar historico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: null,
        status_novo: 'veiculo_recuperado',
        observacao: `Veículo recuperado em ${localRecuperacao}. ${observacoes || ''}`,
      });
    },
  });
}
```

**Novo componente:** `src/components/sinistros/RegistrarRecuperacaoModal.tsx`

Modal para registrar recuperacao com campos:
- Local de recuperacao
- Data/hora da recuperacao
- Condicao do veiculo
- Observacoes
- Checkbox: Reativar veiculo na plataforma

### Fase 3: Adicionar Verificacao de Adimplencia em Tempo Real

**Modificar:** `supabase/functions/criar-sinistro/index.ts`

Integrar com `rede-veiculos-obter-status-veiculo` para verificar adimplencia antes de criar sinistro (ja incluido na Fase 1).

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useRegistrarRecuperacao.ts` | Hook para registrar recuperacao de veiculo |
| `src/components/sinistros/RegistrarRecuperacaoModal.tsx` | Modal para registrar recuperacao |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/criar-sinistro/index.ts` | Verificar status e adimplencia na plataforma |
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar botao "Registrar Recuperacao" |
| `src/hooks/useEncerrarAcionamento.ts` | Adicionar opcao de motivo "recuperado" |
| `src/components/sinistros/CardAcionamentoRoubo.tsx` | Botao para registrar recuperacao |

---

## Checklist de Verificacao Pos-Implementacao

- [x] Posicao em tempo real buscada ao comunicar sinistro
- [x] Posicao do rastreador gravada no dossie
- [x] Comparacao de posicoes exibida na tela de sinistro
- [x] Trajeto 24h antes disponivel para auditoria
- [x] Acionamento de roubo/furto funciona e chama Rede Veiculos
- [x] Acionamentos geram registro de auditoria completo
- [x] Perda total inativa veiculo automaticamente
- [ ] Status verificado na plataforma antes de criar sinistro
- [ ] Adimplencia verificada na plataforma antes de processar cobertura
- [ ] Funcionalidade de registrar recuperacao de veiculo
- [ ] Reativacao de veiculo apos recuperacao

---

## Teste Recomendado: Fluxo Completo de Roubo

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos
2. `REDE_VEICULOS_TOKEN` configurado
3. Acesso como analista de sinistros

### Passos do Teste

**Parte 1: Comunicar Sinistro de Roubo**

1. No App do Associado, comunicar sinistro de roubo
2. Verificar que sinistro foi criado com status "comunicado"
3. Verificar que campos `rastreador_lat_momento` e `rastreador_lng_momento` foram preenchidos
4. Acessar painel administrativo e ver sinistro

**Parte 2: Acionar Recuperacao**

5. Na tela do sinistro, clicar em "Acionar Recuperacao"
6. Selecionar modo "Intensivo"
7. Confirmar acionamento
8. Verificar que:
   - Registro criado em `acionamentos_roubo_furto`
   - API Rede Veiculos foi chamada (verificar logs)
   - Rastreador em modo intensivo
   - Notificacoes enviadas

**Parte 3: Verificar Auditoria**

9. Consultar tabela `acionamentos_roubo_furto` no banco
10. Verificar campos `api_request`, `api_response`, `protocolo_externo`
11. Consultar tabela `rastreadores_logs`
12. Verificar tabela `rastreador_alertas` para alerta critico

**Parte 4: Verificar Trajeto**

13. Na tela do sinistro, verificar card "Trajeto - 24h Antes do Sinistro"
14. Verificar que mapa mostra trajeto correto
15. Clicar em "Salvar como Evidencia"
16. Verificar que `snapshot_trajeto_json` foi preenchido

### Resultado Esperado

- Posicao capturada em tempo real e gravada no sinistro
- Acionamento enviado para Rede Veiculos e confirmado
- Auditoria completa registrada em multiplas tabelas
- Trajeto disponivel e pode ser salvo como evidencia
