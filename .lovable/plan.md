
# Plano: Configurar Credenciais Softruck/Rede Veículos via Interface

## Contexto
Atualmente, a tela de configuração de rastreadores (Softruck e Rede Veículos) exibe os nomes dos secrets necessários e direciona o diretor para configurá-los manualmente no painel do Supabase. Isso é confuso e fora do padrão do sistema, onde outras integrações como Hinova permitem inserir credenciais diretamente pela interface.

## Objetivo
Permitir que diretores configurem as credenciais da Softruck e Rede Veículos diretamente na tela de Integrações, da mesma forma que já funciona para Hinova, Asaas e outras integrações.

---

## Mudanças Propostas

### 1. Remover `ConfigurarRastreadorSheet` (arquivo separado)
O sheet atual apenas exibe informações e não permite inserir credenciais. Vamos reutilizar o `ConfigurarIntegracaoSheet` que já tem toda a lógica de formulário, criptografia e testes.

### 2. Atualizar `ServicosTab.tsx`
- Remover a importação e uso do `ConfigurarRastreadorSheet`
- Para Softruck e Rede Veículos, usar o mesmo `ConfigurarIntegracaoSheet` que já funciona para outras integrações
- Os campos já estão definidos no schema (`softruck`, `rede_veiculos`)

### 3. Atualizar Edge Function `rastreador-auth`
Modificar para buscar credenciais com prioridade:
1. **Primeiro**: Banco de dados (`integracoes_credenciais`) - criptografado
2. **Fallback**: Supabase Secrets (variáveis de ambiente)

Isso permite manter compatibilidade com secrets existentes enquanto dá prioridade às credenciais configuradas pela interface.

### 4. Atualizar Edge Function `rastreador-testar-conexao`
Modificar para também buscar credenciais do banco primeiro, garantindo que o botão "Testar Conexão" funcione corretamente.

### 5. Atualizar Edge Function `rastreador-posicao`
Mesma lógica de busca de credenciais híbrida para garantir consistência.

---

## Detalhes Técnicos

### Função auxiliar para buscar credenciais (reutilizada)
```text
async function getCredenciais(supabase, integracao, serviceKey):
  1. Buscar da tabela integracoes_credenciais
  2. Se encontrar e configurado=true:
     - Descriptografar com AES-256-GCM
     - Retornar objeto de credenciais
  3. Se não encontrar, retornar null (para usar secrets como fallback)
```

### Lógica de autenticação Softruck atualizada
```text
1. Tentar buscar credenciais do banco (getCredenciais('softruck'))
2. Se não encontrar, usar Deno.env.get() como fallback
3. Usar credenciais para autenticar
```

### Campos por integração (já definidos)
- **Softruck**: `public_key`, `username`, `password`, `enterprise_id` (opcional)
- **Rede Veículos**: `bearer_token`

---

## Arquivos a serem modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/integracoes/ServicosTab.tsx` | Usar `ConfigurarIntegracaoSheet` para rastreadores |
| `src/components/integracoes/ConfigurarRastreadorSheet.tsx` | Remover (não mais necessário) |
| `supabase/functions/rastreador-auth/index.ts` | Adicionar busca de credenciais do banco |
| `supabase/functions/rastreador-testar-conexao/index.ts` | Adicionar busca de credenciais do banco |
| `supabase/functions/rastreador-posicao/index.ts` | Adicionar busca de credenciais do banco |

---

## Benefícios

1. **Experiência unificada**: Todas as integrações são configuradas da mesma forma
2. **Sem acesso ao Supabase**: Diretores não precisam acessar o painel técnico
3. **Segurança mantida**: Credenciais continuam criptografadas com AES-256-GCM
4. **Compatibilidade**: Secrets existentes continuam funcionando como fallback
5. **Auditoria**: Histórico de quem alterou credenciais via `updated_by`
