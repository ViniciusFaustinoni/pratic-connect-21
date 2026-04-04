

# Reconhecimento de Associados e Criação Automática de Leads via WhatsApp

## Situação Atual

O webhook WhatsApp busca associados **apenas com status 'ativo'** e **apenas na base principal** (`associados`). Se não encontra, verifica se é um lead existente; se também não, delega para o agente Maya (consultor IA) que pede CPF como fallback. A IA não busca na base antiga nem reconhece associados com outros status (suspenso, em análise, etc.).

## Alterações

### 1. Expandir busca de associados no webhook (`whatsapp-webhook/index.ts`)

**Linha ~3211**: Remover o filtro `.eq("status", "ativo")` e buscar associado com qualquer status. Também buscar na base antiga caso não encontre na principal.

```
Fluxo proposto:
1. Buscar em "associados" por telefone/whatsapp (SEM filtro de status)
2. Se encontrou:
   - Status "ativo" → fluxo normal de IA (já existe)
   - Status "suspenso" → informar que está suspenso, orientar contato com central
   - Status "em_analise"/"pendente" → informar que cadastro está em processamento
   - Status "cancelado" → oferecer recontratação (gerar lead)
3. Se NÃO encontrou na base principal → buscar na base antiga (origem_cadastro filtro)
   - Se encontrou → informar que é da base legada, orientar atualização cadastral
4. Se NÃO encontrou em nenhuma base → verificar leads (já existe)
5. Se NÃO é lead → criar lead automaticamente + delegar para Maya
```

### 2. Criar lead automaticamente para números desconhecidos

**Seção "NÚMERO DESCONHECIDO" (linha ~3301)**: Antes de delegar para o agente Maya, criar automaticamente um lead na tabela `leads` com os dados disponíveis (telefone, nome do contato do WhatsApp). Isso garante que todo contato desconhecido entre no funil de vendas.

```text
Dados do lead automático:
- telefone: número do chamador
- nome: nome_contato do WhatsApp (pushName) ou "Contato WhatsApp"
- origem: "whatsapp_organico"
- etapa: "novo"
- observacoes: "Lead criado automaticamente via WhatsApp"
```

### 3. Ajustar resposta da Maya para oferecer contratação

No fallback do agente-consultor-ia, quando o contato é novo (não é lead prévio), a primeira mensagem deve incluir oferta de plano. A Maya já faz isso via suas configurações — basta garantir que o lead seja criado antes da delegação para que ela tenha contexto.

### 4. Busca na base antiga

Adicionar query adicional na tabela `associados` filtrando por `origem_cadastro` diferente do padrão interno quando a busca principal não retorna resultado, para cobrir registros importados via API/SGA.

## Resumo Técnico

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Expandir busca (remover filtro status=ativo), adicionar lógica por status, busca base antiga, criação automática de lead |

- ~60 linhas adicionadas/modificadas
- 1 arquivo alterado
- Nenhuma tabela nova necessária
- Nenhuma edge function nova necessária

