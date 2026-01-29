
# Plano: Configurar Secrets de Integracoes pela Interface do Sistema

## Objetivo

Permitir que os diretores configurem os secrets de integracoes (SGA Hinova, Softruck, Rede Veiculos) diretamente pela pagina **Configuracoes > Integracoes**, sem precisar acessar o painel do Supabase.

---

## Situacao Atual

| Integracao | Secrets Necessarios | Status |
|------------|---------------------|--------|
| SGA Hinova | HINOVA_TOKEN, HINOVA_USUARIO, HINOVA_SENHA, HINOVA_CODIGO_CONTA | Nao configurado |
| Softruck | SOFTRUCK_PUBLIC_KEY, SOFTRUCK_USERNAME, SOFTRUCK_PASSWORD, SOFTRUCK_ENTERPRISE_ID | Parcialmente configurado |
| Rede Veiculos | REDE_VEICULOS_TOKEN | Configurado e testado |
| ASAAS | ASAAS_API_KEY | Configurado |
| Autentique | AUTENTIQUE_API_KEY | Configurado |
| Email (Resend) | RESEND_API_KEY | Configurado |

O sistema atual mostra apenas instrucoes para configurar secrets no painel do Supabase, sem interface para input direto.

---

## Abordagem Proposta

### Arquitetura de Seguranca

Como os Supabase Secrets NAO podem ser atualizados diretamente via Edge Functions sem a Management API Key (que nao deve ser exposta), adotaremos uma abordagem hibrida:

1. **Armazenamento seguro no banco** - Criar tabela `integracoes_credenciais` com criptografia a nivel de aplicacao
2. **Edge Function de ponte** - Funcao que le as credenciais do banco e as utiliza para autenticar nas APIs externas
3. **Interface de configuracao** - Sheet para inserir credenciais com validacao em tempo real
4. **Migracao gradual** - Ao salvar credenciais no banco, o sistema as testa automaticamente

### Fluxo de Configuracao

```text
Diretor abre Configuracoes > Integracoes
           |
           v
Clica em "Configurar" no card da integracao
           |
           v
Sheet abre com formulario de credenciais
           |
           v
Preenche os campos (senhas mascaradas)
           |
           v
Clica "Testar Conexao"
           |
           v
Edge Function busca credenciais do banco + testa API externa
           |
           v
Se sucesso: marca como configurado
Se erro: mostra mensagem detalhada
           |
           v
Clica "Salvar" - persiste no banco criptografado
```

---

## Fase 1: Criar Tabela de Credenciais Criptografadas

### Nova Tabela: `integracoes_credenciais`

```sql
CREATE TABLE integracoes_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao VARCHAR(50) NOT NULL UNIQUE,
  credenciais_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  configurado BOOLEAN DEFAULT FALSE,
  testado_em TIMESTAMPTZ,
  teste_sucesso BOOLEAN,
  teste_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_integracoes_credenciais_integracao ON integracoes_credenciais(integracao);

ALTER TABLE integracoes_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas diretores podem gerenciar credenciais" ON integracoes_credenciais
FOR ALL TO authenticated
USING (public.is_diretor(auth.uid()) OR public.is_desenvolvedor(auth.uid()))
WITH CHECK (public.is_diretor(auth.uid()) OR public.is_desenvolvedor(auth.uid()));
```

### Mapeamento de Integracoes

| integracao | Campos de Credenciais |
|------------|----------------------|
| hinova | token, usuario, senha, codigo_conta, codigo_regional, codigo_cooperativa, codigo_voluntario, api_url |
| softruck | public_key, username, password, enterprise_id |
| rede_veiculos | bearer_token |
| asaas | api_key, ambiente |
| autentique | api_key |
| resend | api_key |

---

## Fase 2: Edge Function para Salvar/Ler Credenciais

### Nova Funcao: `integracoes-credenciais`

**Arquivo:** `supabase/functions/integracoes-credenciais/index.ts`

**Acoes suportadas:**
- `GET` - Retorna status (configurado/nao) sem expor valores
- `POST` - Salva credenciais criptografadas
- `DELETE` - Remove credenciais

```text
POST /integracoes-credenciais
{
  "integracao": "hinova",
  "credenciais": {
    "token": "xxx",
    "usuario": "yyy",
    "senha": "zzz",
    "codigo_conta": "1"
  }
}

Resposta:
{
  "success": true,
  "mensagem": "Credenciais salvas com sucesso",
  "configurado": true
}
```

### Criptografia

- Algoritmo: AES-256-GCM
- Chave derivada do SUPABASE_SERVICE_ROLE_KEY (apenas acessivel pela Edge Function)
- IV unico por registro

---

## Fase 3: Atualizar Edge Functions de Teste

### Modificar funcoes existentes para buscar credenciais do banco

1. `rastreador-testar-conexao` - Ja usa Secrets, adicionar fallback para banco
2. `sga-hinova-sync` - Adicionar busca de credenciais do banco
3. `integracoes-verificar-secrets` - Adicionar verificacao de credenciais do banco

**Logica de prioridade:**
1. Primeiro verifica Supabase Secrets (ENV)
2. Se nao encontrar, busca na tabela `integracoes_credenciais`
3. Retorna qual fonte foi usada

---

## Fase 4: Componente ConfigurarIntegracaoSheet

### Novo Componente: `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`

**Funcionalidades:**
- Formulario dinamico baseado na integracao selecionada
- Campos de senha com toggle mostrar/ocultar
- Botao "Testar Conexao" integrado
- Status visual do ultimo teste
- Salvamento com feedback

**Campos por integracao:**

| SGA Hinova | Softruck | Rede Veiculos |
|------------|----------|---------------|
| Token Bearer | Public Key | Token Bearer |
| Usuario | Username | |
| Senha | Password | |
| Codigo Conta | Enterprise ID (opcional) | |
| API URL (opcional) | | |

### Interface do Sheet

```text
┌────────────────────────────────────────────┐
│ x  Configurar SGA Hinova                   │
├────────────────────────────────────────────┤
│                                            │
│  Token Bearer *                            │
│  ┌──────────────────────────────────┐      │
│  │ ●●●●●●●●●●●●                  👁 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  Usuario *                                 │
│  ┌──────────────────────────────────┐      │
│  │ usuario_api                       │      │
│  └──────────────────────────────────┘      │
│                                            │
│  Senha *                                   │
│  ┌──────────────────────────────────┐      │
│  │ ●●●●●●●●●●●●                  👁 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  Codigo da Conta *                         │
│  ┌──────────────────────────────────┐      │
│  │ 1                                 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  ───────────────────────────────────       │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │ ✅ Conexao testada com sucesso!     │   │
│  │    Ultimo teste: ha 5 minutos       │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  ┌───────────────┐  ┌────────────────┐     │
│  │ Testar        │  │  💾 Salvar     │     │
│  └───────────────┘  └────────────────┘     │
│                                            │
└────────────────────────────────────────────┘
```

---

## Fase 5: Atualizar ServicosTab

### Modificacoes:

1. Tornar TODOS os servicos configuraveis (nao apenas rastreadores)
2. Adicionar prop `integracaoTipo` para mapear ao sheet correto
3. Usar o novo `ConfigurarIntegracaoSheet` para todas as integracoes

```typescript
const categoriasBase = [
  {
    titulo: 'Gestao',
    servicos: [
      {
        id: 'hinova',
        nome: 'SGA Hinova',
        integracaoId: 'hinova',
        integracao Tipo: 'hinova', // Para o sheet
        configuravel: true, // AGORA CONFIGURAVEL
      },
    ],
  },
  // ... outras categorias
];
```

---

## Fase 6: Hook useIntegracaoCredenciais

### Novo Hook: `src/hooks/useIntegracaoCredenciais.ts`

**Funcionalidades:**
- Buscar status de credenciais por integracao
- Salvar novas credenciais
- Testar conexao
- Deletar credenciais

```typescript
interface UseIntegracaoCredenciaisOptions {
  integracao: 'hinova' | 'softruck' | 'rede_veiculos' | 'asaas' | 'autentique' | 'resend';
}

const {
  status,           // { configurado, testado_em, teste_sucesso, teste_mensagem }
  isLoading,
  isSaving,
  isTesting,
  salvar,           // (credenciais) => Promise
  testar,           // () => Promise
  remover,          // () => Promise
} = useIntegracaoCredenciais({ integracao: 'hinova' });
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/integracoes-credenciais/index.ts` | Edge function para CRUD de credenciais |
| `src/components/integracoes/ConfigurarIntegracaoSheet.tsx` | Sheet de configuracao generico |
| `src/hooks/useIntegracaoCredenciais.ts` | Hook para gerenciar credenciais |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/config.toml` | Adicionar nova edge function |
| `supabase/functions/sga-hinova-sync/index.ts` | Buscar credenciais do banco como fallback |
| `supabase/functions/rastreador-testar-conexao/index.ts` | Buscar credenciais do banco como fallback |
| `supabase/functions/integracoes-verificar-secrets/index.ts` | Verificar banco alem de ENV |
| `src/components/integracoes/ServicosTab.tsx` | Usar novo sheet para todas integracoes |
| `src/hooks/useIntegracoesStatus.ts` | Incluir status de credenciais do banco |

---

## Seguranca

1. **Criptografia em repouso** - Credenciais criptografadas com AES-256-GCM
2. **RLS restritivo** - Apenas diretores e desenvolvedores podem gerenciar
3. **Sem exposicao de valores** - UI nunca recebe valores decriptografados apos salvar
4. **Logs de auditoria** - Registrar quem alterou credenciais e quando
5. **Chave segura** - Derivada do SERVICE_ROLE_KEY, inacessivel pelo frontend

---

## Fluxo de Usuario Final

1. Diretor acessa **Configuracoes > Integracoes**
2. Clica no card **SGA Hinova** > "Configurar"
3. Sheet abre com campos: Token, Usuario, Senha, Codigo Conta
4. Preenche os valores fornecidos pela Hinova
5. Clica "Testar Conexao"
6. Sistema testa autenticacao com a API real
7. Se sucesso, mostra mensagem verde
8. Clica "Salvar"
9. Card muda para verde com "Configurado"
10. Sistema ja pode sincronizar associados com o SGA

---

## Estimativa de Tempo

| Fase | Tempo |
|------|-------|
| Migracao de banco | 10 min |
| Edge Function integracoes-credenciais | 60 min |
| Modificar Edge Functions existentes | 45 min |
| ConfigurarIntegracaoSheet | 60 min |
| Hook useIntegracaoCredenciais | 30 min |
| Atualizar ServicosTab | 20 min |
| Testes e ajustes | 45 min |
| **Total** | **~4.5 horas** |
