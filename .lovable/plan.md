
# Revisao Completa - Uso de Dados da Rede Veiculos no Modulo de Assistencia 24h

## Resumo Executivo

| Cenario | Status | Detalhes |
|---------|--------|----------|
| Buscar posicao quando chamado entra | **IMPLEMENTADO** | `criar-chamado-assistencia` chama `posicao-veiculo` e grava campos `rastreador_lat/lng` |
| Gerar link via /obterLinkCompartilhamento | **NAO IMPLEMENTADO** | Usa link Google Maps estatico, nao chama API Rede Veiculos |
| Preparar acionamento de roubo no chamado | **IMPLEMENTADO** | Menu "Abrir Sinistro" no painel admin permite transicionar para fluxo de roubo |
| Registrar posicao final ao encerrar | **NAO IMPLEMENTADO** | Encerramento apenas atualiza status, nao captura posicao final |
| Posicao exibida no mapa para atendente | **PARCIAL** | Componente `MapaChamado` existe mas NAO e usado na tela `ChamadoDetalhe` |
| Link de compartilhamento enviado ao prestador | **PARCIAL** | `EnviarLinkPrestadorButton` existe mas NAO e utilizado em nenhuma tela |
| Chamados de emergencia por roubo | **IMPLEMENTADO** | Menu permite abrir sinistro diretamente do chamado |
| Historico inclui posicoes consultadas | **PARCIAL** | Posicao inicial gravada, mas nao ha posicoes de acompanhamento |

---

## Analise Detalhada

### 1. Quando o Chamado Entra - Buscar Posicao via Rastreador

**Arquivo:** `supabase/functions/criar-chamado-assistencia/index.ts` (linhas 201-264)

**STATUS: IMPLEMENTADO**

O sistema busca a posicao em tempo real quando o chamado e aberto:

```typescript
// Tentar buscar posição em tempo real via API (Softruck OU Rede Veículos)
if (rastreador.plataforma === 'softruck' || rastreador.plataforma === 'rede_veiculos') {
  try {
    const posicaoResult = await fetch(
      `${supabaseUrl}/functions/v1/posicao-veiculo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ veiculo_id: veiculo.id }),
      }
    );
    
    const posicaoData = await posicaoResult.json();
    
    if (posicaoData.success && posicaoData.posicao) {
      rastreadorLat = posicaoData.posicao.latitude;
      rastreadorLng = posicaoData.posicao.longitude;
      rastreadorPosicaoCapturadaEm = posicaoData.posicao.data_posicao || new Date().toISOString();
      rastreadorEndereco = posicaoData.posicao.endereco || null;
    }
  } catch (err) {
    console.error("[criar-chamado] Erro ao buscar posição via API:", err);
  }
}
```

**Campos Gravados na Tabela `chamados_assistencia`:**
- `rastreador_lat` - Latitude do rastreador no momento da abertura
- `rastreador_lng` - Longitude do rastreador no momento da abertura
- `rastreador_posicao_capturada_em` - Data/hora da captura
- `rastreador_endereco` - Endereco obtido via reverse geocoding

**Observacao:** Tambem usa posicao do rastreador como fallback se associado nao informar localizacao.

---

### 2. Quando Prestador e Acionado - Gerar Link de Compartilhamento

**STATUS: PARCIALMENTE IMPLEMENTADO**

#### Componente Existe mas Nao Esta Integrado

**Arquivo:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

O componente esta implementado com:
- Geracao de link Google Maps estatico: `https://www.google.com/maps?q=${lat},${lng}`
- Mensagem formatada para WhatsApp com protocolo, tipo de servico e localizacao
- Botao para copiar link
- Botao para abrir mapa
- Indicacao se posicao e via rastreador ou informada pelo associado

**Props aceitas:**
```typescript
interface EnviarLinkPrestadorButtonProps {
  chamadoId: string;
  protocolo: string;
  prestadorNome?: string;
  prestadorTelefone?: string;
  origemLat?: number | null;
  origemLng?: number | null;
  origemEndereco?: string;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
  tipoServico?: string;
}
```

#### Gaps Identificados

1. **Componente NAO utilizado:** Nao ha nenhuma tela que importe ou use `EnviarLinkPrestadorButton`

2. **Nao usa API `/obterLinkCompartilhamento`:** O sistema gera um link estatico do Google Maps em vez de chamar a API da Rede Veiculos que poderia fornecer:
   - Link de tracking em tempo real
   - Atualizacao automatica da posicao
   - Integracao com a plataforma de monitoramento

3. **Tela ChamadoDetalhe nao integra mapa nem botao de envio:**
   - O componente `MapaChamado.tsx` existe mas nao e usado em `ChamadoDetalhe.tsx`
   - O placeholder "Visualização de mapa (em breve)" ainda esta presente

---

### 3. Quando Ha Suspeita de Roubo no Chamado - Preparar Acionamento

**STATUS: IMPLEMENTADO VIA FLUXO DE SINISTRO**

**Arquivo:** `src/pages/assistencia/ChamadoDetalhe.tsx` (linhas 247-252)

O menu de acoes permite abrir sinistro diretamente do chamado:

```typescript
<DropdownMenuItem 
  onClick={() => navigate(
    `/eventos/sinistros/novo?chamado_id=${chamado.id}&associado_id=${chamado.associado?.id}&veiculo_id=${chamado.veiculo?.id}`
  )}
>
  <AlertTriangle className="h-4 w-4 mr-2" />
  Abrir Sinistro
</DropdownMenuItem>
```

**Fluxo Completo:**
1. Atendente identifica suspeita de roubo no chamado de assistencia
2. Clica em "Abrir Sinistro" - navega para formulario de sinistro com dados pre-preenchidos
3. No formulario de sinistro, seleciona tipo "roubo" ou "furto"
4. Sinistro e criado e pode acionar recuperacao via `AcionarRecuperacaoModal`
5. Acionamento chama `acionar-roubo-furto` que notifica Rede Veiculos

**Integracao na Edge Function:**

O hook `useAcionarRouboFurto` aceita `chamado_assistencia_id`:

```typescript
interface AcionamentoRequest {
  veiculo_id: string;
  sinistro_id?: string;
  chamado_assistencia_id?: string; // <- Vinculo com assistencia
  tipo_origem: 'sinistro' | 'assistencia' | 'diretoria' | 'manual';
  observacoes?: string;
  modo_rastreamento?: 'intensivo' | 'emergencia';
}
```

A tabela `acionamentos_roubo_furto` possui campo `chamado_assistencia_id` para rastreabilidade.

---

### 4. Quando o Chamado e Encerrado - Registrar Posicao Final

**STATUS: NAO IMPLEMENTADO**

**Arquivo:** `src/components/assistencia/AtualizarStatusChamadoModal.tsx`

O encerramento apenas atualiza o status, sem capturar posicao final:

```typescript
const updateData: Record<string, any> = {
  status: novoStatus,
  updated_at: new Date().toISOString(),
};

// Se concluído, adicionar data de conclusão
if (novoStatus === 'concluido') {
  updateData.data_conclusao = new Date().toISOString();
}
// NAO CAPTURA POSICAO FINAL DO RASTREADOR
```

**Campos que deveriam ser preenchidos:**
- `posicao_final_lat` / `posicao_final_lng`
- `posicao_final_capturada_em`
- `km_percorridos` (calculado entre posicao inicial e final)

---

## Componentes e Hooks Existentes

### Hook de Posicao em Tempo Real

**Arquivo:** `src/hooks/useChamadoPosicaoTempoReal.ts`

```typescript
export function useChamadoPosicaoTempoReal(
  veiculoId: string | undefined,
  { autoRefresh = true, refetchInterval = 30000 } = {}
): UseChamadoPosicaoTempoRealResult
```

**Funcionalidades:**
- Busca rastreador do veiculo
- Chama `posicao-veiculo` para posicao em tempo real
- Fallback para ultima posicao do banco
- Atualiza automaticamente a cada 30 segundos
- Retorna flag `tempoReal` indicando fonte dos dados

**Status:** Implementado mas NAO UTILIZADO em nenhuma tela

### Componente de Mapa

**Arquivo:** `src/components/assistencia/MapaChamado.tsx`

**Funcionalidades:**
- Exibe mapa com Leaflet
- Mostra marcador do veiculo (rastreador) com icone animado
- Mostra marcador da origem informada
- Badge indicando "Tempo Real" ou "Ultima Posicao"
- Botao para alternar entre rastreador e origem
- Botao para atualizar posicao
- Exibe velocidade e ignicao

**Status:** Implementado mas NAO UTILIZADO em nenhuma tela

---

## Gaps Identificados

### Gap 1: Mapa Nao Exibido na Tela do Atendente

A tela `ChamadoDetalhe.tsx` exibe apenas um placeholder:

```typescript
{/* Placeholder para mapa */}
<div className="h-40 bg-muted rounded-lg flex items-center justify-center">
  <div className="text-center text-muted-foreground">
    <MapPin className="h-8 w-8 mx-auto mb-2" />
    <p className="text-sm">Visualização de mapa (em breve)</p>
  </div>
</div>
```

O componente `MapaChamado` ja esta pronto mas nao foi integrado.

### Gap 2: Botao de Enviar Localizacao Nao Integrado

O componente `EnviarLinkPrestadorButton` existe mas nao e usado em nenhuma tela. Deveria estar visivel quando um prestador e atribuido ao chamado.

### Gap 3: Nao Usa API de Compartilhamento da Rede Veiculos

O sistema gera link estatico do Google Maps. Deveria chamar `/obterLinkCompartilhamento` da API Rede Veiculos para:
- Link de tracking em tempo real
- Validade configuravel
- Atualizacao automatica da posicao

### Gap 4: Posicao Final Nao Registrada

Quando chamado e concluido, nao ha captura da posicao final para:
- Calcular distancia percorrida
- Validar que servico foi realizado no local correto
- Auditoria completa do atendimento

### Gap 5: Posicoes de Acompanhamento Nao Registradas

Durante o atendimento, posicoes intermediarias nao sao registradas no historico. Deveria haver:
- Posicao quando prestador aceita
- Posicao quando prestador chega ao local
- Posicao durante o atendimento (opcional)
- Posicao final ao concluir

---

## Plano de Implementacao

### Fase 1: Integrar Mapa e Posicao em Tempo Real na Tela do Atendente

**Modificar:** `src/pages/assistencia/ChamadoDetalhe.tsx`

```typescript
import { MapaChamado } from '@/components/assistencia/MapaChamado';
import { useChamadoPosicaoTempoReal } from '@/hooks/useChamadoPosicaoTempoReal';
import { EnviarLinkPrestadorButton } from '@/components/assistencia/EnviarLinkPrestadorButton';

// No componente
const { posicao, isLoading: posicaoLoading, tempoReal, refetch } = 
  useChamadoPosicaoTempoReal(chamado?.veiculo?.id);

// Substituir placeholder pelo mapa real
<MapaChamado
  origemLat={chamado.origem_lat}
  origemLng={chamado.origem_lng}
  origemEndereco={chamado.origem_endereco}
  rastreadorLat={posicao?.latitude || chamado.rastreador_lat}
  rastreadorLng={posicao?.longitude || chamado.rastreador_lng}
  rastreadorDataPosicao={posicao?.data_posicao || chamado.rastreador_posicao_capturada_em}
  velocidade={posicao?.velocidade}
  ignicao={posicao?.ignicao}
  tempoReal={tempoReal}
  isLoading={posicaoLoading}
  onRefresh={refetch}
  height="h-64"
/>
```

### Fase 2: Adicionar Botao de Enviar Localizacao

**Modificar:** `src/pages/assistencia/ChamadoDetalhe.tsx`

No card do prestador, adicionar o botao:

```typescript
{/* Card: Prestador */}
{(chamado.prestador || chamado.prestador_nome) && (
  <Card>
    <CardContent className="space-y-4">
      {/* ... dados do prestador ... */}
      
      {/* Adicionar botão de enviar localização */}
      <EnviarLinkPrestadorButton
        chamadoId={chamado.id}
        protocolo={chamado.protocolo}
        prestadorNome={chamado.prestador?.razao_social || chamado.prestador_nome}
        prestadorTelefone={chamado.prestador?.whatsapp || chamado.prestador?.telefone || chamado.prestador_telefone}
        origemLat={chamado.origem_lat}
        origemLng={chamado.origem_lng}
        origemEndereco={chamado.origem_endereco}
        rastreadorLat={posicao?.latitude || chamado.rastreador_lat}
        rastreadorLng={posicao?.longitude || chamado.rastreador_lng}
        tipoServico={chamado.tipo_servico}
      />
    </CardContent>
  </Card>
)}
```

### Fase 3: Capturar Posicao Final ao Encerrar Chamado

**Modificar:** `src/components/assistencia/AtualizarStatusChamadoModal.tsx`

Adicionar chamada para capturar posicao quando status = concluido:

```typescript
// Se concluído, capturar posição final
if (novoStatus === 'concluido' && chamado.veiculo_id) {
  try {
    const { data: posicaoFinal } = await supabase.functions.invoke('posicao-veiculo', {
      body: { veiculo_id: chamado.veiculo_id },
    });
    
    if (posicaoFinal?.success && posicaoFinal?.posicao) {
      updateData.posicao_final_lat = posicaoFinal.posicao.latitude;
      updateData.posicao_final_lng = posicaoFinal.posicao.longitude;
      updateData.posicao_final_capturada_em = posicaoFinal.posicao.data_posicao || new Date().toISOString();
    }
  } catch (err) {
    console.warn('Erro ao capturar posição final:', err);
  }
}
```

### Fase 4: Criar Edge Function para Link de Compartilhamento (Opcional)

**Novo arquivo:** `supabase/functions/rede-veiculos-link-compartilhamento/index.ts`

```typescript
// Chamar API Rede Veículos para gerar link de tracking temporário
// POST /obterLinkCompartilhamento
// - codigo_rastreador
// - validade_minutos: 60
// - tipo: 'assistencia'
// Retorna URL de tracking em tempo real
```

### Fase 5: Adicionar Colunas para Posicao Final (Migration)

```sql
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_lat NUMERIC(10, 7);
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_lng NUMERIC(10, 7);
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_capturada_em TIMESTAMPTZ;
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS distancia_percorrida_km NUMERIC(10, 2);
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/assistencia/ChamadoDetalhe.tsx` | Integrar MapaChamado, useChamadoPosicaoTempoReal e EnviarLinkPrestadorButton |
| `src/components/assistencia/AtualizarStatusChamadoModal.tsx` | Capturar posicao final ao concluir |
| `src/components/assistencia/EnviarLinkPrestadorButton.tsx` | (Opcional) Adicionar chamada para API de link de compartilhamento |

## Arquivos a Criar (Opcional)

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-link-compartilhamento/index.ts` | Gerar link de tracking via API |

---

## Checklist de Verificacao Pos-Implementacao

- [x] Posicao buscada em tempo real quando chamado e criado
- [x] Campos `rastreador_lat/lng` gravados na abertura
- [x] Hook `useChamadoPosicaoTempoReal` implementado
- [x] Componente `MapaChamado` implementado
- [x] Componente `EnviarLinkPrestadorButton` implementado
- [x] Menu para abrir sinistro (roubo) a partir do chamado
- [x] Integracao com `acionar-roubo-furto` via sinistro
- [ ] Mapa exibido na tela do atendente (ChamadoDetalhe)
- [ ] Botao de enviar localizacao integrado
- [ ] Posicao final capturada ao encerrar chamado
- [ ] Link de compartilhamento via API Rede Veiculos
- [ ] Posicoes intermediarias registradas no historico

---

## Teste Recomendado: Fluxo Completo de Guincho

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos
2. Prestador de guincho cadastrado e disponivel
3. `REDE_VEICULOS_TOKEN` configurado

### Passos do Teste

**Parte 1: Abrir Chamado**

1. No App do Associado, solicitar guincho
2. Permitir localizacao ou informar endereco
3. Verificar que chamado foi criado
4. Acessar painel administrativo > Assistencia > Chamados
5. Abrir o chamado recente
6. **Verificar:** Mapa exibe posicao do rastreador em tempo real
7. **Verificar:** Badge indica "Tempo Real" ou "Ultima Posicao"

**Parte 2: Atribuir Prestador**

8. Clicar em "Atribuir Prestador"
9. Selecionar um prestador de guincho
10. Confirmar acionamento
11. **Verificar:** Botao "Enviar Localizacao" aparece
12. Clicar no botao e enviar via WhatsApp
13. **Verificar:** Prestador recebe mensagem com link do mapa

**Parte 3: Concluir Chamado**

14. Atualizar status para "Concluido"
15. **Verificar:** Posicao final foi capturada
16. **Verificar:** Campos `posicao_final_lat/lng` preenchidos no banco

**Parte 4: Testar Fluxo de Roubo (Opcional)**

17. Abrir novo chamado de assistencia
18. No menu Acoes, clicar em "Abrir Sinistro"
19. Selecionar tipo "Roubo"
20. Criar sinistro
21. Acionar recuperacao via modal
22. **Verificar:** Acionamento enviado para Rede Veiculos

### Resultado Esperado

- Atendente ve posicao do veiculo em tempo real no mapa
- Prestador recebe link com localizacao atualizada
- Posicao inicial e final registradas para auditoria
- Fluxo de roubo integrado via sinistro funciona corretamente
