
# Plano: Sistema Completo de Manutenção de Rastreadores (Processo 1 + 2)

## Resumo Executivo

O sistema atual cobre **parcialmente** o Processo 1 (Vistoria de Campo). Precisamos:
1. Expandir o enum `status_rastreador` com 4 novos status
2. Adicionar desfechos faltantes no Processo 1 (não resolvido, reagendamento)
3. Criar o **Processo 2** completo (Manutenção Interna na Base)
4. Nova página + tela de gestão de bancada para o Coordenador

---

## Diagnóstico do Estado Atual

### Status Rastreador (Banco)
```
ATUAL: estoque | instalado | manutencao | baixado
```

### Tipos de Resultado Manutenção (Código)
```typescript
// ATUAL em types/vistoriaManutencao.ts
type ResultadoManutencao = 'resolvido' | 'substituicao';
```

### O que FALTA
| Item | Status |
|------|--------|
| Status `retorno_base` | Não existe |
| Status `triagem` | Não existe |
| Status `em_analise_plataforma` | Não existe |
| Status `em_garantia` | Não existe |
| Resultado "Não Resolvido" | Não existe |
| Opção "Reagendar" | Parcial (só não compareceu) |
| Tela de Manutenção Interna (Base) | Não existe |
| Workflow de Triagem | Não existe |
| Registro de Laudo Plataforma | Não existe |

---

## Alterações de Banco de Dados

### 1. Expandir Enum `status_rastreador`

```sql
-- Adicionar novos status ao enum
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'retorno_base';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'triagem';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'em_analise_plataforma';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'em_garantia';
```

### 2. Criar Tabela de Histórico de Manutenção Interna

```sql
CREATE TABLE rastreador_manutencao_interna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NOT NULL REFERENCES rastreadores(id),
  servico_origem_id UUID REFERENCES servicos(id), -- Vistoria que originou o retorno
  
  -- Status do processo interno
  etapa VARCHAR(30) NOT NULL DEFAULT 'aguardando_triagem' 
    CHECK (etapa IN (
      'aguardando_triagem',    -- Acabou de chegar na base
      'em_triagem',            -- Coordenador analisando
      'em_analise_plataforma', -- Enviado para Rede/Softruck
      'em_garantia',           -- Enviado para fornecedor
      'concluido_estoque',     -- Devolvido ao estoque OK
      'descartado'             -- Baixado definitivamente
    )),
  
  -- Diagnóstico
  diagnostico_inicial TEXT,
  defeito_identificado VARCHAR(100),
  
  -- Encaminhamentos
  encaminhado_para VARCHAR(50), -- 'rede_veiculos', 'softruck', 'fornecedor_xyz'
  data_encaminhamento TIMESTAMPTZ,
  numero_protocolo_externo VARCHAR(100),
  
  -- Laudo/Resultado
  laudo_externo TEXT,
  recuperavel BOOLEAN,
  data_retorno TIMESTAMPTZ,
  
  -- Resolução
  acao_tomada TEXT, -- 'troca_chip', 'reset', 'reconfiguracao', 'descarte', etc
  resolvido_por UUID REFERENCES profiles(id),
  resolvido_em TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Índices
CREATE INDEX idx_manut_interna_rastreador ON rastreador_manutencao_interna(rastreador_id);
CREATE INDEX idx_manut_interna_etapa ON rastreador_manutencao_interna(etapa);
```

### 3. Adicionar Coluna de Destino na Substituição

```sql
-- Na tabela servicos, para saber pra onde foi o rastreador antigo
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS 
  rastreador_destino_pos_substituicao VARCHAR(30) 
  CHECK (rastreador_destino_pos_substituicao IN ('retorno_base', 'baixado'));
```

---

## Alterações de Código

### Fase 1: Ajustes no Processo 1 (Vistoria de Campo)

#### 1.1 Expandir Tipos

**Arquivo:** `src/types/vistoriaManutencao.ts`

```typescript
// NOVO: Resultado expandido
export type ResultadoManutencao = 
  | 'resolvido'           // Consertou no local
  | 'substituicao'        // Trocou por outro
  | 'nao_resolvido';      // Não conseguiu resolver

// NOVO: Destino do rastreador antigo pós-substituição
export type DestinoRastreadorSubstituido = 'retorno_base' | 'baixado';
```

#### 1.2 Atualizar Modal de Resultado

**Arquivo:** `src/components/monitoramento/manutencao/RegistrarResultadoModal.tsx`

Adicionar terceira opção:

```
├── A) RESOLVIDO NO LOCAL
│     Rastreador continua instalado
│
├── B) SUBSTITUIÇÃO
│     - Escolher novo rastreador do estoque
│     - Rastreador antigo vai para: [Retorno Base] ou [Baixar Direto]
│
└── C) NÃO RESOLVIDO
        - Não tinha peça/substituto
        - Escolher: [Reagendar] ou [Cancelar Manutenção]
```

#### 1.3 Atualizar Hook de Resultado

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

No `useRegistrarResultadoManutencao`:

```typescript
// Se resultado = 'substituicao':
if (params.destinoRastreadorAntigo === 'retorno_base') {
  // Rastreador antigo → status 'retorno_base'
  // Cria registro em rastreador_manutencao_interna
} else {
  // Rastreador antigo → status 'baixado' (atual)
}

// Se resultado = 'nao_resolvido':
if (params.acaoNaoResolvido === 'reagendar') {
  // Serviço → status 'reagendada'
  // Rastreador continua 'manutencao'
} else {
  // Cancela a manutenção
}
```

---

### Fase 2: Criar Processo 2 (Manutenção Interna)

#### 2.1 Nova Página

**Arquivo:** `src/pages/monitoramento/ManutencaoInterna.tsx`

Tela exclusiva para Coordenador de Monitoramento:

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 Manutenção Interna (Bancada)                           │
│  Rastreadores aguardando triagem/análise                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Aguardando│ │Triagem  │ │Plataforma│ │Garantia │          │
│  │ Triagem │ │   (2)   │ │   (1)   │ │   (0)   │          │
│  │   (5)   │ │         │ │         │ │         │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Rastreador   │ Origem      │ Etapa    │ Ações      │   │
│  ├──────────────┼─────────────┼──────────┼────────────┤   │
│  │ RAST-001     │ Prot-12345  │ Aguard.  │ [Triar]   │   │
│  │ RAST-002     │ Prot-12346  │ Triagem  │ [Resolver]│   │
│  │ RAST-003     │ Prot-12347  │ Plataf.  │ [Laudo]   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Componentes da Manutenção Interna

**Arquivos novos em** `src/components/monitoramento/manutencao-interna/`:

| Componente | Função |
|------------|--------|
| `TriagemModal.tsx` | Coordenador avalia e define próximo passo |
| `ResolverInternoModal.tsx` | Resolver na bancada (troca chip, reset, etc) |
| `EncaminharPlataformaModal.tsx` | Enviar para Rede Veículos/Softruck |
| `EncaminharGarantiaModal.tsx` | Enviar para fornecedor |
| `RegistrarLaudoModal.tsx` | Registrar resultado do laudo externo |
| `ConfirmarDescarteModal.tsx` | Baixar definitivamente |

#### 2.3 Hook de Manutenção Interna

**Arquivo:** `src/hooks/useManutencaoInterna.ts`

```typescript
// Queries
useRastreadoresAguardandoTriagem()
useRastreadoresEmAnalise()
useManutencaoInternaDetalhe(id)

// Mutations
useIniciarTriagem(rastreadorId)
useResolverInterno(params: { rastreadorId, acaoTomada, observacao })
useEncaminharPlataforma(params: { rastreadorId, plataforma, protocoloExterno })
useEncaminharGarantia(params: { rastreadorId, fornecedor, notaFiscal })
useRegistrarLaudo(params: { rastreadorId, laudo, recuperavel })
useConfirmarDescarte(params: { rastreadorId, motivo })
useDevolverAoEstoque(params: { rastreadorId, observacao })
```

#### 2.4 Fluxo de Transições

```typescript
// Transições de status do rastreador no Processo 2
const TRANSICOES_MANUTENCAO_INTERNA = {
  retorno_base: ['triagem'],
  triagem: ['estoque', 'em_analise_plataforma', 'em_garantia', 'baixado'],
  em_analise_plataforma: ['triagem', 'estoque', 'baixado'],
  em_garantia: ['triagem', 'estoque', 'baixado'],
};
```

---

### Fase 3: Integração e Navegação

#### 3.1 Adicionar Rota

**Arquivo:** `src/App.tsx`

```typescript
<Route path="/monitoramento/manutencao-interna" element={<ManutencaoInterna />} />
```

#### 3.2 Adicionar ao Menu

**Arquivo:** `src/components/layout/AppSidebar.tsx`

```typescript
// Dentro de MONITORAMENTO, adicionar:
{ title: 'Manutenção Base', url: '/monitoramento/manutencao-interna', icon: Wrench }
```

#### 3.3 Permissões

- **Ver/Gerenciar Manutenção Interna**: Coordenador de Monitoramento, Diretor
- **Baixar Rastreador (descarte)**: Diretor apenas (confirmação extra)

---

## Tipos Atualizados

**Arquivo:** `src/types/rastreadores.ts`

```typescript
export type StatusRastreador = 
  | 'estoque'               // Pronto para uso
  | 'reservado'             // Separado para instalação
  | 'instalado'             // No veículo
  | 'manutencao'            // Vistoria aberta (campo)
  | 'retorno_base'          // Voltou do campo, aguarda triagem
  | 'triagem'               // Coordenador avaliando
  | 'em_analise_plataforma' // Na plataforma (Rede/Softruck)
  | 'em_garantia'           // No fornecedor
  | 'baixado';              // TERMINAL - descartado

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  estoque: 'Em Estoque',
  reservado: 'Reservado',
  instalado: 'Instalado',
  manutencao: 'Em Manutenção (Campo)',
  retorno_base: 'Retorno Base',
  triagem: 'Em Triagem',
  em_analise_plataforma: 'Análise Plataforma',
  em_garantia: 'Em Garantia',
  baixado: 'Baixado',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  estoque: 'bg-green-100 text-green-800',
  reservado: 'bg-blue-100 text-blue-800',
  instalado: 'bg-emerald-100 text-emerald-800',
  manutencao: 'bg-orange-100 text-orange-800',
  retorno_base: 'bg-yellow-100 text-yellow-800',
  triagem: 'bg-purple-100 text-purple-800',
  em_analise_plataforma: 'bg-cyan-100 text-cyan-800',
  em_garantia: 'bg-indigo-100 text-indigo-800',
  baixado: 'bg-gray-100 text-gray-600',
};
```

---

## Resumo de Arquivos

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/monitoramento/ManutencaoInterna.tsx` | Página principal Processo 2 |
| `src/hooks/useManutencaoInterna.ts` | Hooks CRUD manutenção interna |
| `src/components/monitoramento/manutencao-interna/TriagemModal.tsx` | Modal triagem |
| `src/components/monitoramento/manutencao-interna/ResolverInternoModal.tsx` | Modal resolver |
| `src/components/monitoramento/manutencao-interna/EncaminharPlataformaModal.tsx` | Modal enviar plataforma |
| `src/components/monitoramento/manutencao-interna/EncaminharGarantiaModal.tsx` | Modal garantia |
| `src/components/monitoramento/manutencao-interna/RegistrarLaudoModal.tsx` | Modal laudo |
| `src/components/monitoramento/manutencao-interna/ConfirmarDescarteModal.tsx` | Modal descarte |
| `src/components/monitoramento/manutencao-interna/index.ts` | Exports |

### Arquivos Modificados
| Arquivo | Alteração |
|---------|-----------|
| `src/types/vistoriaManutencao.ts` | Novos tipos de resultado |
| `src/types/rastreadores.ts` | Novos status |
| `src/hooks/useVistoriaManutencao.ts` | Lógica de retorno_base |
| `src/components/monitoramento/manutencao/RegistrarResultadoModal.tsx` | Opção "não resolvido" + destino |
| `src/components/layout/AppSidebar.tsx` | Menu Manutenção Base |
| `src/App.tsx` | Nova rota |
| Migration SQL | Novos status + tabela |

---

## Fluxo Visual Final

```
                    PROCESSO 1 (Campo)                    PROCESSO 2 (Base)
                    ────────────────                      ──────────────────
                          │
    [instalado] ──► [manutencao] ──► Vistoria
                          │
          ┌───────────────┼───────────────┐
          │               │               │
      Resolvido    Substituição    Não Resolvido
          │               │               │
          ▼               │               ▼
    [instalado]           │         [reagendada]
                          │               ou
                          │         [cancelada]
                          │
              ┌───────────┴───────────┐
              │                       │
        [retorno_base] ◄──────  [baixado]
              │                   (fim)
              ▼
         [triagem]
              │
    ┌─────────┼─────────┬─────────┐
    │         │         │         │
Resolve   Plataforma  Garantia  Descarte
    │         │         │         │
    ▼         ▼         ▼         ▼
[estoque]  [em_analise] [em_garantia] [baixado]
              │         │              (fim)
              ▼         ▼
         ┌────┴────┐  ┌─┴──┐
         │         │  │    │
     [estoque] [baixado] [estoque] [baixado]
```

---

## Ordem de Implementação

1. **Migration SQL** - Criar status e tabela
2. **Tipos TypeScript** - Atualizar enums e interfaces
3. **Modificar Processo 1** - Adicionar "não resolvido" + destino rastreador
4. **Criar hooks Processo 2** - useManutencaoInterna
5. **Criar componentes Processo 2** - Modais de triagem/resolução
6. **Criar página Processo 2** - ManutencaoInterna.tsx
7. **Integrar menu e rotas**
8. **Testes end-to-end**
