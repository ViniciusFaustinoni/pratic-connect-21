
# Complementar Histórico Completo do Rastreador

## Objetivo
Aprimorar a aba "Movimentações" do drawer de detalhes do rastreador para exibir um histórico completo e unificado de tudo que acontece com o equipamento, incluindo manutenções de campo, manutenções internas, fotos tiradas durante os serviços e checklist de verificação.

## Situação Atual

A aba "Movimentações" exibe apenas dados da tabela `estoque_movimentacoes`:
- Entrada no estoque
- Atribuição/remoção de portador
- Instalação/manutenção/baixa
- Transferências

**O que falta:**
- Histórico de manutenções de campo (tabela `servicos` com tipo `vistoria_manutencao`)
- Fotos registradas durante as manutenções (campo `fotos_manutencao` em `servicos`)
- Checklist de verificação técnica (campo `checklist_manutencao` em `servicos`)
- Histórico de manutenção interna/bancada (tabela `rastreador_manutencao_interna`)

## Solução

### 1. Criar novo componente de Histórico Completo

Criar `src/components/rastreadores/HistoricoCompletoRastreador.tsx` que consolida:

**Timeline unificada ordenada por data com 3 tipos de eventos:**

| Tipo | Fonte | Ícone | Cor |
|------|-------|-------|-----|
| Movimentação de Estoque | `estoque_movimentacoes` | Package | Verde |
| Manutenção de Campo | `servicos` (tipo=vistoria_manutencao) | Wrench | Âmbar |
| Manutenção Interna | `rastreador_manutencao_interna` | Settings | Roxo |

### 2. Dados a exibir por tipo

**Manutenção de Campo (servicos):**
- Protocolo do serviço
- Motivo da manutenção
- Resultado (resolvido/substituição/não resolvido)
- Técnico responsável
- Data de conclusão
- Observações/análise
- Checklist de itens verificados (expansível)
- Galeria de fotos (com modal de visualização)

**Manutenção Interna (rastreador_manutencao_interna):**
- Etapa atual/final
- Diagnóstico inicial
- Defeito identificado
- Ação tomada
- Encaminhado para (se aplicável)
- Protocolo externo (se houver)
- Laudo externo
- Responsável pela resolução

### 3. Galeria de Fotos de Manutenção

Criar componente `FotosManutencaoGaleria.tsx`:
- Exibe thumbnails das fotos
- Categoria da foto (geral, conexão, LED, etc.)
- Data do upload
- Modal fullscreen ao clicar (usando ImageViewer existente)

### 4. Expandir Checklist de Manutenção

Exibir checklist colapsável com:
- Lista de itens verificados
- Status (ok/não ok) de cada item
- Data/hora da verificação

## Estrutura de Arquivos

```
src/components/rastreadores/
├── HistoricoCompletoRastreador.tsx     (NOVO - componente principal)
├── FotosManutencaoGaleria.tsx          (NOVO - galeria de fotos)
├── HistoricoMovimentacoesRastreador.tsx (manter como fallback)
└── RastreadorDetailDrawer.tsx          (ATUALIZAR - usar novo componente)
```

## Consultas de Dados

### Query: Manutenções de Campo
```sql
SELECT 
  id, protocolo, status, resultado_manutencao,
  motivo_manutencao, motivo_detalhe,
  observacoes_analise, concluida_em, created_at,
  fotos_manutencao, checklist_manutencao,
  profissional:profiles!servicos_profissional_id_fkey(id, nome)
FROM servicos
WHERE rastreador_id = $1 
  AND tipo = 'vistoria_manutencao'
ORDER BY created_at DESC
```

### Query: Manutenções Internas
```sql
SELECT 
  id, etapa, diagnostico_inicial, defeito_identificado,
  acao_tomada, encaminhado_para, numero_protocolo_externo,
  laudo_externo, created_at, resolvido_em,
  servico_origem:servicos(protocolo),
  resolvido_por_profile:profiles(nome)
FROM rastreador_manutencao_interna
WHERE rastreador_id = $1
ORDER BY created_at DESC
```

## Interface Visual

```text
┌──────────────────────────────────────────────┐
│ ● [Movimentações] ● [Manutenções]            │  <- Sub-tabs
├──────────────────────────────────────────────┤
│                                              │
│ 🔧 MAN-2026-00123              08/02/26 15:30│
│    ┌────────────────────────────────────────┐│
│    │ Motivo: Sem sinal                      ││
│    │ Resultado: ✅ Resolvido                ││
│    │ Técnico: João Silva                    ││
│    │                                        ││
│    │ 📋 Checklist (6/6 verificados)    [▼]  ││
│    │                                        ││
│    │ 📷 Fotos da manutenção (3)             ││
│    │ ┌────┐ ┌────┐ ┌────┐                   ││
│    │ │    │ │    │ │    │                   ││
│    │ └────┘ └────┘ └────┘                   ││
│    └────────────────────────────────────────┘│
│                                              │
│ ⚙️ Triagem Interna             05/02/26 10:00│
│    ┌────────────────────────────────────────┐│
│    │ Etapa: Concluído - Devolvido Estoque   ││
│    │ Diagnóstico: Problema de antena        ││
│    │ Ação: Substituição de componente       ││
│    └────────────────────────────────────────┘│
│                                              │
│ 📦 retorno_manutencao          07/02/26 22:25│
│    manutencao → instalado                   ││
│    Correção manual: rastreador não foi...   ││
└──────────────────────────────────────────────┘
```

## Detalhes Técnicos

1. **Unificação de eventos**: Combinar arrays das 3 fontes e ordenar por `created_at`
2. **Tipos TypeScript**: Criar interfaces para cada tipo de evento
3. **Lazy loading de fotos**: Carregar thumbnails apenas quando visíveis
4. **Modal de foto**: Reutilizar `ImageViewer` existente em um Dialog
5. **Acessibilidade**: Manter navegação por teclado na galeria

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `HistoricoCompletoRastreador.tsx` | Criar | Componente principal do histórico unificado |
| `FotosManutencaoGaleria.tsx` | Criar | Galeria de fotos com modal de visualização |
| `RastreadorDetailDrawer.tsx` | Modificar | Substituir componente de movimentações pelo novo |
| `index.ts` | Atualizar | Exportar novos componentes |
