
# Plano: Configurar API Keys de Rede Veículos e Softruck nas Integrações

## Objetivo

Permitir que as credenciais das plataformas de rastreamento (Rede Veículos e Softruck) sejam configuráveis diretamente na página **Configurações > Integrações > Serviços**, tornando a experiência mais intuitiva.

---

## Situação Atual

| Item | Status |
|------|--------|
| Secrets no Supabase | REDE_VEICULOS_TOKEN, SOFTRUCK_PUBLIC_KEY/USERNAME/PASSWORD/ENTERPRISE_ID |
| Tabela de config | `rastreadores_config_plataformas` (2 registros) |
| Tabela de credenciais | `rastreadores_credenciais` (2 registros, sem senhas - apenas status) |
| Página atual | `/monitoramento/credenciais` - funcional mas em outro módulo |
| Botão "Configurar" na ServicosTab | Não faz nada (apenas visual) |

---

## Proposta de Solução

Ao invés de duplicar a funcionalidade, vamos:

1. **Modificar a ServicosTab** para que o botão "Configurar" dos cards de Rede Veículos e Softruck abra um modal/sheet com formulário de configuração
2. **Criar uma edge function** para salvar credenciais nos secrets do Supabase
3. **Mostrar status real de conexão** nos cards (usando dados do banco)
4. **Manter compatibilidade** com a página existente `/monitoramento/credenciais`

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/integracoes/ConfigurarRastreadorSheet.tsx` | Sheet/modal com formulário para configurar credenciais de cada plataforma |
| `supabase/functions/rastreador-salvar-credenciais/index.ts` | Edge function para salvar credenciais nos secrets |

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/integracoes/ServicosTab.tsx` | Tornar dinâmico, buscar status do banco, adicionar modal de configuração |
| `supabase/config.toml` | Adicionar nova edge function |

---

## Detalhamento Técnico

### 1. ConfigurarRastreadorSheet.tsx

Componente Sheet (slide-in lateral) com:
- **Para Softruck:**
  - Campo Public Key
  - Campo Username
  - Campo Password (com toggle mostrar/ocultar)
  - Campo Enterprise ID (opcional, pode ser descoberto automaticamente)
- **Para Rede Veículos:**
  - Campo Token Bearer (com toggle mostrar/ocultar)
- Botão "Testar Conexão" (usa `rastreador-testar-conexao`)
- Botão "Salvar" (usa nova `rastreador-salvar-credenciais`)
- Exibição de status do último teste

### 2. Edge Function rastreador-salvar-credenciais

```text
Entrada:
{
  plataforma_codigo: 'softruck' | 'rede_veiculos',
  credenciais: {
    public_key?: string,
    username?: string,
    password?: string,
    enterprise_id?: string,
    bearer_token?: string
  }
}

Ações:
1. Validar campos obrigatórios por plataforma
2. Atualizar secrets no Supabase via API Management
3. Atualizar tabela rastreadores_credenciais com status
4. Retornar sucesso/erro

Saída:
{
  success: boolean,
  mensagem: string
}
```

**Nota importante:** Como não é possível atualizar secrets via API diretamente do Edge Function, a função irá:
- Salvar um registro em `rastreadores_credenciais` com hash das credenciais
- Instruir o usuário a atualizar os secrets manualmente no painel Supabase
- OU usar a tabela `vault.secrets` se disponível

### 3. Modificações na ServicosTab

```text
Antes (estático):
- Lista fixa de serviços
- Status hardcoded
- Botão "Configurar" sem ação

Depois (dinâmico):
- Busca status de rastreadores_credenciais
- Status real: Conectado/Desconectado/Não configurado
- Última execução/teste
- Botão "Configurar" abre ConfigurarRastreadorSheet
- Botão "Ver Logs" para serviços conectados
```

---

## Fluxo do Usuário

```text
1. Usuário acessa Configurações > Integrações
2. Na aba "Serviços", vê cards de Rede Veículos e Softruck
3. Status mostra "OFF" ou "Não configurado"
4. Clica em "Configurar"
5. Sheet abre com formulário da plataforma
6. Preenche credenciais
7. Clica "Testar Conexão"
8. Se sucesso, clica "Salvar"
9. Card atualiza para mostrar "ON" e "Conectado"
```

---

## Interface do Sheet de Configuração

```text
┌────────────────────────────────────────┐
│ ✕  Configurar Rede Veículos            │
├────────────────────────────────────────┤
│                                        │
│  Token Bearer *                        │
│  ┌────────────────────────────────┐   │
│  │ ●●●●●●●●●●●●●●●●        👁️    │   │
│  └────────────────────────────────┘   │
│  Token fornecido pela Rede Veículos    │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ ✅ Conexão testada com sucesso! │  │
│  │    Último teste: há 2 min       │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ┌──────────────┐  ┌───────────────┐  │
│  │ Testar       │  │   💾 Salvar   │  │
│  └──────────────┘  └───────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## Considerações de Segurança

1. **Secrets não são expostos:** A edge function apenas verifica se existem, não retorna valores
2. **Senhas mascaradas:** UI mostra ●●●● para tokens/senhas
3. **Hash para auditoria:** Salvamos hash das credenciais para tracking de mudanças
4. **Apenas gerência:** Verificação de permissão `isGerencia` antes de permitir acesso

---

## Abordagem Alternativa (Recomendada)

Como os secrets do Supabase não podem ser atualizados via Edge Function facilmente, uma abordagem mais prática seria:

1. **Mostrar instruções claras** no sheet de como configurar os secrets no painel do Supabase
2. **Fornecer link direto** para a página de secrets do Supabase
3. **Usar "Testar Conexão"** para validar se os secrets foram configurados corretamente
4. **Salvar status** na tabela `rastreadores_credenciais` após teste bem-sucedido

Isso evita complexidade de gerenciamento de secrets e mantém a segurança.

---

## Resumo das Entregas

1. **Componente `ConfigurarRastreadorSheet.tsx`** - Formulário em sheet para configurar credenciais
2. **Edge function `rastreador-salvar-credenciais`** - Salvar status e validar configuração
3. **ServicosTab atualizada** - Cards dinâmicos com status real e ação de configurar
4. **Integração completa** - Botões funcionais que abrem configuração específica de cada plataforma
