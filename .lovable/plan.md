
## Plano: Sistema de Análise de Sinistros para Diretor

### Visão Geral

Criar um fluxo de análise de sinistros semelhante à análise cadastral (`PropostaAnalise.tsx`), onde o diretor pode visualizar todos os dados do sinistro, documentos do veículo, histórico do veículo, localização e trajeto das últimas 24 horas, e tomar uma decisão: **Aprovar**, **Reprovar** ou **Solicitar Documentação**.

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | **Criar** | Nova página de análise completa do sinistro |
| `src/hooks/useSinistroAnalise.ts` | **Criar** | Hook para buscar dados completos para análise |
| `src/components/sinistros/AprovarSinistroDialog.tsx` | **Criar** | Dialog de confirmação de aprovação |
| `src/components/sinistros/ReprovarSinistroDialog.tsx` | **Criar** | Dialog com motivo de reprovação |
| `src/pages/eventos/SinistrosList.tsx` | **Modificar** | Adicionar botão "Analisar" na tabela |
| `src/pages/eventos/SinistroDetalhe.tsx` | **Modificar** | Adicionar botão "Analisar" no header |
| `src/App.tsx` | **Modificar** | Adicionar rota `/eventos/sinistros/:id/analisar` |
| `supabase/functions/aprovar-sinistro/index.ts` | **Criar** | Edge Function para aprovar sinistro |
| `supabase/functions/reprovar-sinistro/index.ts` | **Criar** | Edge Function para reprovar sinistro |

### Estrutura da Página de Análise

```text
+---------------------------------------------------------------+
|  ← Voltar    Análise de Sinistro - SIN-2026XXXX    [Próximo →] |
|  Status: Comunicado                                            |
+---------------------------------------------------------------+
|                                                                |
| ⚠️ ALERTA (se aplicável): Associado Recém-Ativado             |
|                                                                |
+---------------------------------------------------------------+
|                                                                |
| COLUNA ESQUERDA (60%)              | COLUNA DIREITA (40%)     |
|                                    |                          |
| ┌─────────────────────────────┐   | ┌─────────────────────┐  |
| │ 👤 Dados do Associado       │   | │ 🎬 AÇÕES            │  |
| │ Nome, CPF, Telefone, Email  │   | │                     │  |
| └─────────────────────────────┘   | │ [✓ Aprovar]         │  |
|                                    | │ [✗ Reprovar]        │  |
| ┌─────────────────────────────┐   | │ [📄 Solicitar Docs] │  |
| │ 🚗 Dados do Veículo         │   | └─────────────────────┘  |
| │ Placa, Marca, Modelo, Ano   │   |                          |
| │ Status, Coberturas          │   | ┌─────────────────────┐  |
| │ Código FIPE, Valor FIPE     │   | │ 📋 Checklist        │  |
| └─────────────────────────────┘   | │ ☑ Documentos OK     │  |
|                                    | │ ☑ Fotos OK          │  |
| ┌─────────────────────────────┐   | │ ☑ B.O. Anexado      │  |
| │ 🔔 Informações do Sinistro  │   | │ ☑ Local Verificado  │  |
| │ Tipo, Data, Local, Descrição│   | └─────────────────────┘  |
| └─────────────────────────────┘   |                          |
|                                    | ┌─────────────────────┐  |
| ┌─────────────────────────────┐   | │ 📜 Histórico        │  |
| │ 📍 Trajeto 24h              │   | │ Timeline de eventos │  |
| │ (TrajetoSinistroCard)       │   | └─────────────────────┘  |
| │ Mapa + Paradas + Exportar   │   |                          |
| └─────────────────────────────┘   |                          |
|                                    |                          |
| ┌─────────────────────────────┐   |                          |
| │ 📍 Comparação GPS           │   |                          |
| │ (ComparacaoPosicoes)        │   |                          |
| │ Informada vs Rastreador     │   |                          |
| └─────────────────────────────┘   |                          |
|                                    |                          |
| ┌─────────────────────────────┐   |                          |
| │ 📸 Fotos do Sinistro        │   |                          |
| │ Galeria com visualização    │   |                          |
| └─────────────────────────────┘   |                          |
|                                    |                          |
| ┌─────────────────────────────┐   |                          |
| │ 📄 Documentos Anexados      │   |                          |
| │ B.O., CNH, CRLV, etc        │   |                          |
| └─────────────────────────────┘   |                          |
|                                    |                          |
| ┌─────────────────────────────┐   |                          |
| │ 🚗 Histórico do Veículo     │   |                          |
| │ Sinistros anteriores        │   |                          |
| │ Ativações/desativações      │   |                          |
| └─────────────────────────────┘   |                          |
+---------------------------------------------------------------+
```

### Fluxo de Decisões

```text
                    SINISTRO COMUNICADO
                           │
                           ▼
              ┌────────────────────────┐
              │   PÁGINA DE ANÁLISE    │
              │  (visualização total)  │
              └────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    [APROVAR]      [SOLICITAR DOCS]     [REPROVAR]
         │                 │                 │
         ▼                 ▼                 ▼
    - Status →         - Status →        - Status →
      'em_analise'    'doc_pendente'      'negado'
    - Registra         - Registra         - Registra
      histórico         histórico          histórico
    - Notifica         - IA envia         - Notifica
      WhatsApp          WhatsApp           WhatsApp
                        pedindo docs        com motivo
```

### Detalhamento Técnico

#### 1. Hook `useSinistroAnalise.ts`

```typescript
// Dados agregados para análise:
interface SinistroAnaliseData {
  sinistro: SinistroComRelacoes;
  documentos: SinistroDocumento[];
  fotos: SinistroFoto[];
  historicoSinistro: SinistroHistorico[];
  
  // Dados do veículo
  veiculo: VeiculoComDetalhes;
  veiculoHistorico: VeiculoHistoricoItem[];
  sinistrosAnteriores: Sinistro[];
  
  // Rastreador (se existir)
  rastreador: Rastreador | null;
  temRastreadorAtivo: boolean;
  
  // Dados do associado
  associado: AssociadoCompleto;
  contratoAtivo: Contrato | null;
}
```

#### 2. Página `SinistroAnalise.tsx`

Seções principais:
- **Header**: Protocolo, status, badges de alerta, navegação
- **Alerta Recém-Ativado**: Se `alerta_recem_ativado = true`
- **Dados do Associado**: Nome, CPF, telefone, email, endereço
- **Dados do Veículo**: Placa, marca/modelo, ano, cor, chassi, FIPE, coberturas
- **Informações do Sinistro**: Tipo, data, hora, local, descrição, B.O.
- **Trajeto 24h**: Componente `TrajetoSinistroCard` (se rastreador ativo)
- **Comparação GPS**: Componente `ComparacaoPosicoes` (se houver coordenadas)
- **Fotos do Sinistro**: Galeria com zoom
- **Documentos Anexados**: Lista com status e visualização
- **Histórico do Veículo**: Sinistros anteriores, ativações
- **Painel de Ações**: Aprovar, Reprovar, Solicitar Docs
- **Checklist de Análise**: Itens verificados pelo analista
- **Histórico do Sinistro**: Timeline de mudanças de status

#### 3. Edge Function `aprovar-sinistro`

```typescript
// Payload
{
  sinistro_id: string;
  observacao?: string;
}

// Ações:
// 1. Atualizar status para 'em_analise' (aguarda vistoria/regulação)
// 2. Registrar no histórico
// 3. Enviar WhatsApp: "Seu sinistro foi aprovado para análise. Próximos passos..."
// 4. Retornar sucesso
```

#### 4. Edge Function `reprovar-sinistro`

```typescript
// Payload
{
  sinistro_id: string;
  motivo: 'fora_cobertura' | 'documentacao_invalida' | 'fraude_suspeita' | 'prazo_expirado' | 'outro';
  justificativa: string;
}

// Ações:
// 1. Atualizar status para 'negado'
// 2. Salvar motivo e justificativa
// 3. Registrar no histórico
// 4. Enviar WhatsApp: "Seu sinistro foi analisado e infelizmente não foi aprovado. Motivo: ..."
```

#### 5. Dialog `SolicitarDocumentosSinistroDialog` (já existe!)

O componente já está implementado em `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx`:
- Lista tipos de documentos
- Atualiza status para `documentacao_pendente`
- Envia WhatsApp com lista de documentos
- Vinculação automática já funciona via `whatsapp-webhook`

#### 6. Modificações na Lista de Sinistros

Adicionar botão "Analisar" visível apenas para `isDiretor`:

```typescript
{isDiretor && sinistro.status === 'comunicado' && (
  <Button
    size="sm"
    className="bg-purple-600 hover:bg-purple-700"
    onClick={() => navigate(`/eventos/sinistros/${sinistro.id}/analisar`)}
  >
    <Search className="mr-1 h-4 w-4" />
    Analisar
  </Button>
)}
```

### Processamento de Documentos via WhatsApp

O sistema já possui integração completa no `whatsapp-webhook`:

1. **Solicitação de documentos** → Status sinistro muda para `documentacao_pendente`
2. **IA envia WhatsApp** listando documentos necessários
3. **Associado envia foto/PDF** via WhatsApp
4. **Webhook processa mídia**:
   - Baixa arquivo para Supabase Storage
   - Vincula a `sinistro_documentos` pendente
   - Atualiza status do documento para `enviado`
   - Se todos enviados, status sinistro → `em_analise`
5. **IA confirma recebimento** via WhatsApp

### Navegação entre Sinistros

Similar à análise cadastral:
- Botão "Próximo Sinistro" para ir ao próximo com status `comunicado`
- Após aprovar/reprovar, redireciona automaticamente

### Resumo de Permissões

| Ação | Diretor | Analista | Associado |
|------|---------|----------|-----------|
| Ver lista de sinistros | ✅ | ✅ | ❌ |
| Ver detalhes | ✅ | ✅ | ✅ (próprio) |
| Analisar (página completa) | ✅ | ❌ | ❌ |
| Aprovar | ✅ | ❌ | ❌ |
| Reprovar | ✅ | ❌ | ❌ |
| Solicitar documentos | ✅ | ✅ | ❌ |

### Arquivos a Criar

1. `src/pages/eventos/SinistroAnalise.tsx` (~800 linhas)
2. `src/hooks/useSinistroAnalise.ts` (~200 linhas)
3. `src/components/sinistros/AprovarSinistroDialog.tsx` (~100 linhas)
4. `src/components/sinistros/ReprovarSinistroDialog.tsx` (~150 linhas)
5. `supabase/functions/aprovar-sinistro/index.ts` (~150 linhas)
6. `supabase/functions/reprovar-sinistro/index.ts` (~180 linhas)

### Arquivos a Modificar

1. `src/pages/eventos/SinistrosList.tsx` - Adicionar botão "Analisar"
2. `src/pages/eventos/SinistroDetalhe.tsx` - Adicionar botão "Analisar" no header
3. `src/App.tsx` - Nova rota
4. `supabase/config.toml` - Registrar novas edge functions
