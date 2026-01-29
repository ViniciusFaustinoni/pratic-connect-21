
# Plano: Integracao SGA Pratic com API Hinova SGA

## Resumo Executivo

Implementar sincronizacao de associados e veiculos com o sistema SGA Hinova, incluindo:
1. Edge Function para comunicacao com a API Hinova
2. Botao "Ativar no SGA" na pagina de analise de proposta
3. Hook customizado para gerenciar o estado da sincronizacao
4. Tabelas auxiliares para logs e mapeamentos
5. Campos adicionais nas tabelas existentes

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
├─────────────────────────────────────────────────────────────────────┤
│  PropostaAnalise.tsx                                                 │
│  ├── BotaoAtivarSGA.tsx (novo componente)                           │
│  │   └── Dialog confirmacao                                          │
│  │   └── Status visual (pendente/sincronizando/ativado/erro)        │
│  └── useSGASync.ts (hook de estado)                                  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTION                                   │
├─────────────────────────────────────────────────────────────────────┤
│  sga-hinova-sync/index.ts                                            │
│  ├── 1. Autenticar na API Hinova                                     │
│  ├── 2. Cadastrar/buscar associado                                   │
│  ├── 3. Cadastrar veiculo                                            │
│  ├── 4. Enviar fotos/documentos                                      │
│  └── 5. Atualizar registros locais                                   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API HINOVA SGA v2                               │
├─────────────────────────────────────────────────────────────────────┤
│  Base URL: https://api.hinova.com.br/api/sga/v2                      │
│  ├── POST /usuario/autenticar                                        │
│  ├── POST /associado/cadastrar                                       │
│  ├── POST /veiculo/cadastrar                                         │
│  └── POST /veiculo/foto/cadastrar                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Configuracao de Secrets

**Secrets necessarios no Supabase:**

| Secret | Descricao | Obrigatorio |
|--------|-----------|-------------|
| `HINOVA_API_URL` | URL base da API (https://api.hinova.com.br/api/sga/v2) | Sim |
| `HINOVA_TOKEN` | Token Bearer gerado no SGA Hinova | Sim |
| `HINOVA_USUARIO` | Usuario para autenticacao | Sim |
| `HINOVA_SENHA` | Senha para autenticacao | Sim |
| `HINOVA_CODIGO_CONTA` | Codigo da conta padrao | Sim |
| `HINOVA_CODIGO_REGIONAL` | Codigo regional padrao | Nao |
| `HINOVA_CODIGO_COOPERATIVA` | Codigo cooperativa padrao | Nao |
| `HINOVA_CODIGO_VOLUNTARIO` | Codigo voluntario padrao | Nao |

---

## Fase 2: Alteracoes no Banco de Dados

### 2.1 Novos campos na tabela `associados`

```sql
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS codigo_hinova INTEGER,
ADD COLUMN IF NOT EXISTS sincronizado_hinova BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sincronizado_hinova_em TIMESTAMPTZ;
```

### 2.2 Novos campos na tabela `veiculos`

```sql
ALTER TABLE veiculos 
ADD COLUMN IF NOT EXISTS codigo_hinova INTEGER,
ADD COLUMN IF NOT EXISTS sincronizado_hinova BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sincronizado_hinova_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_sga VARCHAR(50) DEFAULT 'pendente';
-- status_sga: pendente | sincronizando | ativado_sga | erro_sincronizacao
```

### 2.3 Nova tabela `sga_sync_logs`

```sql
CREATE TABLE sga_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  veiculo_id UUID REFERENCES veiculos(id),
  associado_id UUID REFERENCES associados(id),
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  usuario_id UUID,
  duracao_ms INTEGER
);

CREATE INDEX idx_sync_logs_veiculo ON sga_sync_logs(veiculo_id);
CREATE INDEX idx_sync_logs_associado ON sga_sync_logs(associado_id);
CREATE INDEX idx_sync_logs_created ON sga_sync_logs(created_at DESC);

-- RLS
ALTER TABLE sga_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver logs" ON sga_sync_logs
FOR SELECT TO authenticated
USING (public.am_i_funcionario());

CREATE POLICY "Edge functions podem inserir logs" ON sga_sync_logs
FOR INSERT TO authenticated
WITH CHECK (true);
```

### 2.4 Nova tabela `hinova_mapeamentos`

```sql
CREATE TABLE hinova_mapeamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  codigo_local VARCHAR(100) NOT NULL,
  codigo_hinova INTEGER NOT NULL,
  descricao VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tipo, codigo_local)
);

-- Dados iniciais de mapeamento
INSERT INTO hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao) VALUES
-- Cores
('cor', 'preto', 1, 'PRETO'),
('cor', 'branco', 2, 'BRANCO'),
('cor', 'prata', 3, 'PRATA'),
('cor', 'cinza', 4, 'CINZA'),
('cor', 'vermelho', 5, 'VERMELHO'),
('cor', 'azul', 6, 'AZUL'),
('cor', 'verde', 7, 'VERDE'),
('cor', 'amarelo', 8, 'AMARELO'),
('cor', 'marrom', 9, 'MARROM'),
('cor', 'bege', 10, 'BEGE'),
-- Combustivel
('combustivel', 'gasolina', 1, 'GASOLINA'),
('combustivel', 'etanol', 2, 'ETANOL'),
('combustivel', 'alcool', 2, 'ETANOL'),
('combustivel', 'flex', 3, 'FLEX'),
('combustivel', 'diesel', 4, 'DIESEL'),
('combustivel', 'gnv', 5, 'GNV'),
('combustivel', 'eletrico', 6, 'ELETRICO'),
('combustivel', 'hibrido', 7, 'HIBRIDO'),
-- Tipo de veiculo
('tipo_veiculo', 'automovel', 1, 'AUTOMOVEL'),
('tipo_veiculo', 'carro', 1, 'AUTOMOVEL'),
('tipo_veiculo', 'motocicleta', 2, 'MOTOCICLETA'),
('tipo_veiculo', 'moto', 2, 'MOTOCICLETA'),
('tipo_veiculo', 'caminhao', 3, 'CAMINHAO'),
('tipo_veiculo', 'utilitario', 4, 'UTILITARIO'),
-- Tipos de foto/documento
('tipo_foto', 'cnh', 1, 'CNH'),
('tipo_foto', 'crlv', 2, 'CRLV'),
('tipo_foto', 'comprovante_residencia', 3, 'COMPROVANTE RESIDENCIA'),
('tipo_foto', 'foto_frontal_veiculo', 4, 'FOTO FRENTE'),
('tipo_foto', 'foto_frente', 4, 'FOTO FRENTE'),
('tipo_foto', 'foto_traseira_veiculo', 5, 'FOTO TRASEIRA'),
('tipo_foto', 'foto_traseira', 5, 'FOTO TRASEIRA'),
('tipo_foto', 'foto_lateral_esquerda', 6, 'FOTO LATERAL ESQUERDA'),
('tipo_foto', 'foto_lateral_direita', 7, 'FOTO LATERAL DIREITA'),
('tipo_foto', 'foto_motor', 8, 'FOTO MOTOR'),
('tipo_foto', 'foto_chassi', 9, 'FOTO CHASSI'),
('tipo_foto', 'foto_painel', 10, 'FOTO PAINEL'),
('tipo_foto', 'foto_hodometro', 10, 'FOTO KM')
ON CONFLICT (tipo, codigo_local) DO NOTHING;

-- RLS
ALTER TABLE hinova_mapeamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler mapeamentos" ON hinova_mapeamentos
FOR SELECT TO authenticated USING (true);
```

---

## Fase 3: Edge Function `sga-hinova-sync`

**Arquivo:** `supabase/functions/sga-hinova-sync/index.ts`

### 3.1 Estrutura da Funcao

```text
Entrada:
{
  veiculo_id: string (UUID),
  associado_id: string (UUID)
}

Fluxo:
1. Validar entrada
2. Buscar dados do associado (Supabase)
3. Buscar dados do veiculo (Supabase)
4. Buscar documentos/fotos do Storage
5. Autenticar na API Hinova
6. Verificar se associado ja existe (por CPF)
   - Se existe: usar codigo_associado existente
   - Se nao existe: cadastrar novo
7. Cadastrar veiculo com codigo_associado
8. Enviar fotos em lotes de 50
9. Atualizar registros locais (codigo_hinova, status_sga)
10. Registrar logs em sga_sync_logs
11. Retornar resultado

Saida (sucesso):
{
  success: true,
  data: {
    codigo_associado_hinova: 12345,
    codigo_veiculo_hinova: 67890,
    fotos_enviadas: 8,
    fotos_com_erro: []
  }
}

Saida (erro):
{
  success: false,
  error: "Descricao do erro",
  step: "autenticar|associado|veiculo|fotos",
  details: {...}
}
```

### 3.2 Mapeamento de Campos

| Campo Supabase (associados) | Campo Hinova |
|-----------------------------|--------------|
| nome | nome |
| cpf | cpf |
| rg | rg |
| data_nascimento | data_nascimento (dd/mm/yyyy) |
| email | email |
| telefone | telefone |
| whatsapp | celular |
| cep | cep |
| logradouro | logradouro |
| numero | numero |
| complemento | complemento |
| bairro | bairro |
| cidade | cidade |
| uf | estado |
| sexo | sexo |
| dia_vencimento | dia_vencimento |

| Campo Supabase (veiculos) | Campo Hinova |
|---------------------------|--------------|
| placa | placa |
| chassi | chassi |
| renavam | renavam |
| ano_fabricacao | ano_fabricacao |
| ano_modelo | ano_modelo |
| codigo_fipe | codigo_fipe |
| valor_fipe | valor_fipe |
| cor | codigo_cor (via mapeamento) |
| combustivel | codigo_combustivel (via mapeamento) |

### 3.3 Tratamento de Erros e Retry

- Implementar retry com backoff exponencial (3 tentativas)
- Delays: 1s, 2s, 4s
- Registrar cada tentativa no log
- Se associado ja existe (CPF duplicado): buscar codigo existente
- Se foto falhar: continuar com proximas, retornar lista de falhas

---

## Fase 4: Componente `BotaoAtivarSGA`

**Arquivo:** `src/components/cadastro/BotaoAtivarSGA.tsx`

### 4.1 Interface do Componente

```typescript
interface BotaoAtivarSGAProps {
  veiculoId: string;
  associadoId: string;
  statusAtual: 'pendente' | 'sincronizando' | 'ativado_sga' | 'erro_sincronizacao';
  onSuccess?: () => void;
  onError?: (error: string) => void;
}
```

### 4.2 Estados Visuais

| Status | Aparencia | Acao |
|--------|-----------|------|
| `pendente` | Botao azul, icone Upload | Abre dialog de confirmacao |
| `sincronizando` | Botao cinza, spinner | Desabilitado |
| `ativado_sga` | Botao verde, icone Check | Desabilitado, tooltip com data |
| `erro_sincronizacao` | Botao vermelho/laranja | Permite retry |

### 4.3 Fluxo de Interacao

```text
1. Usuario clica "Ativar no SGA"
2. Dialog de confirmacao abre:
   - Titulo: "Ativar Associado no SGA Hinova?"
   - Mensagem: "Esta acao enviara todos os dados para o sistema SGA Hinova"
   - Botoes: "Cancelar" | "Confirmar Ativacao"
3. Ao confirmar:
   - Status muda para "sincronizando"
   - Chama Edge Function sga-hinova-sync
4. Se sucesso:
   - Status muda para "ativado_sga"
   - Toast: "Associado ativado com sucesso no SGA!"
   - Invalida queries relacionadas
5. Se erro:
   - Status muda para "erro_sincronizacao"
   - Toast com mensagem de erro
   - Permite nova tentativa
```

---

## Fase 5: Hook `useSGASync`

**Arquivo:** `src/hooks/useSGASync.ts`

### 5.1 Interface do Hook

```typescript
interface UseSGASyncOptions {
  veiculoId: string;
  associadoId: string;
  onSuccess?: (data: SyncResult) => void;
  onError?: (error: Error) => void;
}

interface SyncResult {
  success: boolean;
  codigo_associado_hinova?: number;
  codigo_veiculo_hinova?: number;
  fotos_enviadas?: number;
  fotos_com_erro?: string[];
}

// Retorno do hook
const {
  status,           // 'idle' | 'loading' | 'success' | 'error'
  isLoading,
  isSynced,         // true se ja sincronizado
  canSync,          // true se pode sincronizar
  error,
  syncResult,
  veiculoData,      // dados do veiculo com status_sga
  logs,             // historico de tentativas
  sync,             // funcao para sincronizar
  retry,            // funcao para retry
} = useSGASync(options);
```

### 5.2 Logica de `canSync`

```typescript
const canSync = useMemo(() => {
  const veiculo = veiculoQuery.data;
  if (!veiculo) return false;
  if (veiculo.sincronizado_hinova) return false;
  if (veiculo.status_sga === 'sincronizando') return false;
  
  // Veiculo deve estar aprovado ou ativo
  const statusOk = ['aprovado', 'ativo'].includes(veiculo.status);
  
  return statusOk;
}, [veiculoQuery.data]);
```

---

## Fase 6: Integracao na Pagina PropostaAnalise

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

### 6.1 Onde Adicionar o Botao

Na secao de acoes (linha ~730), apos a aprovacao, adicionar:

```typescript
{/* Ativacao SGA Hinova */}
{proposta.status === 'ativo' && proposta.veiculo_id && (
  <div className="mt-4 pt-4 border-t">
    <p className="text-sm text-muted-foreground mb-3">
      Integracao SGA Hinova
    </p>
    <BotaoAtivarSGA
      veiculoId={proposta.veiculo_id}
      associadoId={proposta.associado_id}
      statusAtual={proposta.veiculo_status_sga || 'pendente'}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      }}
    />
    
    {/* Informacoes pos-sincronizacao */}
    {proposta.veiculo_sincronizado_hinova && (
      <div className="mt-3 p-3 bg-success/10 rounded-lg text-sm">
        <p>Codigo Hinova: {proposta.veiculo_codigo_hinova}</p>
        <p>Sincronizado em: {format(...)}</p>
      </div>
    )}
  </div>
)}
```

### 6.2 Condicoes para Exibir

- Proposta com status `ativo`
- Veiculo possui `veiculo_id`
- Usuario tem perfil `analista_cadastro` ou superior

---

## Fase 7: Configuracao no Supabase

### 7.1 config.toml

```toml
[functions.sga-hinova-sync]
verify_jwt = false
```

### 7.2 Adicionar Integracao na Pagina de Servicos

Na `ServicosTab.tsx`, adicionar card para SGA Hinova:

```typescript
{
  id: 'hinova',
  nome: 'SGA Hinova',
  descricao: 'Sistema de gestao de associados',
  icone: '🏢',
  integracaoId: 'hinova',
  secretName: 'HINOVA_TOKEN',
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/sga-hinova-sync/index.ts` | Edge function principal |
| `src/components/cadastro/BotaoAtivarSGA.tsx` | Componente do botao |
| `src/hooks/useSGASync.ts` | Hook de gerenciamento de estado |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/config.toml` | Adicionar funcao sga-hinova-sync |
| `src/pages/cadastro/PropostaAnalise.tsx` | Integrar BotaoAtivarSGA |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Exibir status SGA |
| `src/components/integracoes/ServicosTab.tsx` | Adicionar card Hinova |
| `src/hooks/useIntegracoesStatus.ts` | Verificar secret HINOVA_TOKEN |

---

## Estimativa de Tempo

| Fase | Tempo |
|------|-------|
| Configurar secrets | 10 min |
| Migracoes de banco | 15 min |
| Edge Function sga-hinova-sync | 90 min |
| Componente BotaoAtivarSGA | 45 min |
| Hook useSGASync | 30 min |
| Integracao PropostaAnalise | 30 min |
| Integracao ServicosTab | 15 min |
| Testes e ajustes | 45 min |
| **Total** | **~4-5 horas** |

---

## Proximos Passos Apos Implementacao

1. Obter credenciais da API Hinova com o cliente
2. Configurar secrets no Supabase
3. Testar com um associado/veiculo em ambiente de homologacao
4. Ajustar mapeamentos de codigos conforme cadastros no Hinova
5. Liberar para producao
