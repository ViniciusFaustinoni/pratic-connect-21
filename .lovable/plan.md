

# Plano: Localização e Trajeto para Eventos de Colisão

## Objetivo
Adicionar funcionalidade para exibir a localização atual e o percurso das últimas **4 horas** nos detalhes de eventos de **colisão**, similar ao que foi feito para roubo/furto.

---

## Viabilidade por Plataforma

| Plataforma | Suporte API Histórico | Estratégia |
|------------|----------------------|------------|
| **Softruck** | ✅ Sim | Buscar trajeto via API `/vehicles/{id}/trajectories/` |
| **Rede Veículos** | ❌ Não | Usar dados locais (`rastreador_posicoes`) do banco |

A edge function `rastreador-historico` já implementa esse fallback automaticamente.

---

## Alterações Necessárias

### 1. Arquivo `SinistroDetalhe.tsx` - Adicionar para Colisões

Expandir a lógica existente (roubo/furto) para incluir colisões:

**De:**
```typescript
['roubo', 'furto'].includes(sinistro.tipo)
```

**Para:**
```typescript
['roubo', 'furto', 'colisao', 'colisao_parcial', 'colisao_total'].includes(sinistro.tipo)
```

### 2. Adicionar Card de Trajeto Específico (4h)

Criar um novo card que mostre o trajeto das últimas 4 horas para colisões, diferente das 24h para roubo/furto.

```typescript
{/* Trajeto 4h - para colisões */}
{['colisao', 'colisao_parcial', 'colisao_total'].includes(sinistro.tipo) && (
  <TrajetoColisaoCard
    veiculoId={sinistro.veiculo_id}
    dataOcorrencia={sinistro.data_ocorrencia}
    sinistroId={sinistro.id}
  />
)}
```

### 3. Criar Componente `TrajetoColisaoCard.tsx`

Componente similar ao `TrajetoSinistroCard`, mas com:
- Período de **4 horas** antes do sinistro (ao invés de 24h)
- Título "Trajeto - 4h Antes da Colisão"
- Mesma estrutura de mapa com polyline e marcadores

### 4. Reutilizar Botão de Localização em Tempo Real

Para colisões, também mostrar o botão "Abrir Localização" se houver rastreador instalado:

```typescript
{/* Botão Abrir Localização - para tipos com rastreador */}
{['roubo', 'furto', 'colisao', 'colisao_parcial', 'colisao_total'].includes(sinistro.tipo) && rastreadorVeiculo && (
  <Button onClick={() => setMapaLocalizacaoOpen(true)}>
    📍 Abrir Localização do Veículo
  </Button>
)}
```

---

## Estrutura do Novo Componente

```text
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Trajeto - 4h Antes da Colisão                      [↗]  │
│  ⏰ 01/02 08:30 - 01/02 12:30                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│           ┌────────────────────────────────────┐            │
│           │                                    │            │
│           │      [MAPA COM POLYLINE]           │            │
│           │    🟢 Início ─────────→ 🔴 Colisão  │            │
│           │         ⏸ Paradas                  │            │
│           │                                    │            │
│           └────────────────────────────────────┘            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [ 45 pontos ]  [ 2 paradas ]  [ 🟢 API | 🟡 Local ]        │
│                                                             │
│  [💾 Salvar Evidência]  [📄 Exportar PDF]  [🔍 Consultar]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```text
COLISÃO COMUNICADA
       │
       ▼
┌───────────────────────────────┐
│  Detalhes do Sinistro         │
│  (SinistroDetalhe.tsx)        │
└───────────────┬───────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌──────────────┐    ┌──────────────────┐
│ TrajetoCard  │    │ Botão Localização│
│ (4h antes)   │    │ (Tempo Real)     │
└───────┬──────┘    └────────┬─────────┘
        │                    │
        ▼                    ▼
┌──────────────────────────────────────┐
│   Edge Function: rastreador-historico │
│   (ou rastreador-posicao)            │
└───────────────────┬──────────────────┘
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
┌────────────┐              ┌──────────────┐
│  Softruck  │              │ Rede Veículos│
│  API v2    │              │  Banco Local │
└────────────┘              └──────────────┘
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/pages/eventos/SinistroDetalhe.tsx` | Editar - Incluir colisão nos filtros |
| `src/components/sinistros/TrajetoColisaoCard.tsx` | **Criar** - Componente específico 4h |
| `supabase/functions/rastreador-historico/index.ts` | Verificar - Já suporta período customizado ✅ |

---

## Comportamento Esperado

1. Usuário acessa detalhes de um sinistro de **colisão**
2. Se veículo tem rastreador instalado:
   - Exibe **Card de Trajeto** com últimas 4 horas
   - Exibe **Botão "Abrir Localização"** para posição atual
3. Se plataforma for **Softruck**: busca trajeto via API
4. Se plataforma for **Rede Veículos**: exibe dados do banco local
5. Usuário pode salvar trajeto como evidência, exportar PDF ou fazer consulta avançada

---

## Diferenças: Roubo/Furto vs Colisão

| Aspecto | Roubo/Furto | Colisão |
|---------|-------------|---------|
| Período Trajeto | 24 horas | **4 horas** |
| Foco | Rastrear movimentação do ladrão | Verificar percurso antes do impacto |
| Prioridade | Localização tempo real | Trajeto histórico |
| Card Existente | TrajetoSinistroCard (24h) | **TrajetoColisaoCard (4h)** - Novo |

