

# Plano: Expandir Monitoramento de Exclusividade de Vendedores

## Resumo Executivo

O sistema **já possui** um módulo de Auditoria de Vendedores completo em `/auditoria/vendedores`. Este plano expande a funcionalidade existente para detectar vendedores que possam estar realizando cotações para associações concorrentes.

## Situação Atual

O sistema já conta com:

| Componente | Status |
|------------|--------|
| Tela de Auditoria (`/auditoria/vendedores`) | Existente |
| Tabela `auditoria_vendedores` | Existente |
| Tabela `vendedores_monitoramento` | Existente |
| Edge Function `analisar-exclusividade` | Existente |
| Hooks de auditoria (`useAuditoriaVendedores`) | Existente |
| Alertas de CPF duplicado | Existente |
| Alertas de taxa conversão baixa | Existente |
| Alertas de cotações abandonadas | Existente |

## O Que Será Implementado

### 1. Nova Tabela: Associações Concorrentes Cadastradas

Criar uma tabela para cadastrar associações/empresas concorrentes conhecidas que serão usadas para identificar conflitos.

```sql
CREATE TABLE associacoes_concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  palavras_chave TEXT[], -- ex: ['proteja', 'protecao xyz', 'apv']
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Nova Tabela: Registro de Indícios

Armazenar evidências de possível conflito de interesse detectadas.

```sql
CREATE TABLE auditoria_indicios_concorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES profiles(id) NOT NULL,
  tipo_indicio VARCHAR(50) NOT NULL, -- 'email_corporativo', 'telefone_duplicado', 'padrao_horario', 'cliente_migrado'
  descricao TEXT,
  associacao_concorrente_id UUID REFERENCES associacoes_concorrentes(id),
  dados_evidencia JSONB,
  score_risco INTEGER DEFAULT 20,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, analisado, confirmado, ignorado
  analisado_por UUID REFERENCES profiles(id),
  analisado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Novo Tipo de Alerta na Edge Function

Expandir a Edge Function `analisar-exclusividade` para incluir novos tipos de detecção:

**Novos tipos de alerta:**
- `email_suspeito` - Email do vendedor ou leads com domínio de concorrente
- `padrao_multi_organizacao` - Vendedor com leads que mencionam outras associações
- `horario_fora_expediente` - Atividade concentrada fora do horário comercial
- `clientes_migrados` - Leads com histórico em outras associações (quando detectável)

### 4. Nova View: Métricas de Conflito

```sql
CREATE VIEW vw_vendedores_conflito AS
SELECT 
  p.id as vendedor_id,
  p.nome,
  p.email,
  COUNT(DISTINCT aic.id) as total_indicios,
  COUNT(DISTINCT CASE WHEN aic.status = 'confirmado' THEN aic.id END) as indicios_confirmados,
  MAX(aic.created_at) as ultimo_indicio,
  ARRAY_AGG(DISTINCT ac.nome) FILTER (WHERE ac.nome IS NOT NULL) as associacoes_envolvidas
FROM profiles p
LEFT JOIN auditoria_indicios_concorrencia aic ON aic.vendedor_id = p.id
LEFT JOIN associacoes_concorrentes ac ON ac.id = aic.associacao_concorrente_id
WHERE aic.id IS NOT NULL
GROUP BY p.id, p.nome, p.email;
```

### 5. UI: Nova Aba na Tela de Auditoria

Adicionar uma nova aba "Conflito de Interesse" na página `/auditoria/vendedores` com:

- Lista de vendedores com indícios de trabalho para concorrentes
- Detalhes das associações envolvidas
- Timeline de evidências detectadas
- Ações para analisar/confirmar/ignorar

### 6. UI: Cadastro de Associações Concorrentes

Criar uma seção de configuração para gerenciar a lista de associações concorrentes conhecidas (apenas para diretor/desenvolvedor).

## Fluxo de Detecção

```text
1. Vendedor cria cotação/lead
          ↓
2. Edge Function analisa:
   - Email tem domínio de concorrente?
   - Telefone aparece em outra associação?
   - Observações mencionam concorrente?
   - Horário atípico frequente?
          ↓
3. Se detectado → Cria registro em auditoria_indicios_concorrencia
          ↓
4. Atualiza score de risco em vendedores_monitoramento
          ↓
5. Se score >= 70 → Notifica gestores
          ↓
6. Gestor analisa na tela de Auditoria
```

## Alterações em Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/analisar-exclusividade/index.ts` | Adicionar novos tipos de análise |
| `src/hooks/useAuditoriaVendedores.ts` | Novos hooks para indícios de concorrência |
| `src/pages/auditoria/AuditoriaVendedores.tsx` | Nova aba "Conflito de Interesse" |
| `src/components/auditoria/AlertaDetalheModal.tsx` | Suporte a novos tipos de alerta |
| `src/components/auditoria/IndiciosConcorrenciaTab.tsx` | **Novo** - Componente da nova aba |
| `src/components/auditoria/CadastroAssociacoesModal.tsx` | **Novo** - Modal de cadastro |

## Controle de Acesso

Acesso restrito a:
- `diretor`
- `gerente_comercial`
- `desenvolvedor`
- `admin_master`

Usando as permissões já existentes no `usePermissions`:
```ts
canManageAuditoria: isDiretor || isGerencia() || isDesenvolvedor || isAdminMaster
```

## Próximos Passos

1. **Migração SQL** - Criar as novas tabelas e views
2. **Atualizar Edge Function** - Expandir lógica de análise
3. **Novos Hooks** - Adicionar `useIndiciosConcorrencia`, `useAssociacoesConcorrentes`
4. **UI** - Implementar nova aba e modais
5. **Testes** - Validar detecção e notificações

