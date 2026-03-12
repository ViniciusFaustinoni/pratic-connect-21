

# Redesign da Area de Integracoes

## Problemas Identificados

1. **WhatsApp duplicado** -- aparece como tab dedicada E como card dentro de "Servicos"
2. **WhatsApp Tab e uma pagina gigante** -- mistura provedor, Evolution config, status, IA, stats e templates Meta em um scroll interminavel (~2400px de conteudo)
3. **Status cards no topo usam dados mock** (hardcoded `servicosConectados = 1`)
4. **4 tabs sem hierarquia clara** -- WhatsApp, Servicos, Fontes Leads, API Keys nao formam uma logica intuitiva
5. **Muita informacao tecnica exposta** -- Webhook URL, Verify Token, campos de API misturados com overview

## Nova Arquitetura UX

Substituir a estrutura de tabs por um **hub visual de integracoes** com 2 niveis:

### Nivel 1 -- Pagina principal (Hub)
Cards de integracao organizados por categoria, cada um mostrando status real (do hook `useIntegracoesStatus`). Sem tabs -- tudo visivel de uma vez.

```text
+--------------------------------------------------+
| Integracoes                                       |
| Conecte e gerencie todos os servicos externos     |
+--------------------------------------------------+
| [Resumo: X conectados, Y pendentes, Z erros]     |
+--------------------------------------------------+
|                                                   |
| COMUNICACAO                                       |
| +--------------------+  +--------------------+    |
| | WhatsApp Business  |  | Email SMTP         |    |
| | [CONECTADO]        |  | [CONFIGURADO]      |    |
| | Provedor: Meta API |  | Resend             |    |
| | [Gerenciar ->]     |  | [Configurar ->]    |    |
| +--------------------+  +--------------------+    |
|                                                   |
| PAGAMENTOS                                        |
| +--------------------+                            |
| | ASAAS              |                            |
| | [CONECTADO]        |                            |
| | [Configurar ->]    |                            |
| +--------------------+                            |
|                                                   |
| RASTREAMENTO                                      |
| +--------------------+  +--------------------+    |
| | Rede Veiculos      |  | Softruck           |    |
| +--------------------+  +--------------------+    |
|                                                   |
| DOCUMENTOS & GESTAO                               |
| +--------------------+  +--------------------+    |
| | Autentique         |  | SGA Hinova         |    |
| +--------------------+  +--------------------+    |
|                                                   |
| AUTOMACAO & DEVELOPERS                            |
| +--------------------+  +--------------------+    |
| | n8n                |  | API Keys           |    |
| | [SEMPRE ATIVO]     |  | 3 chaves ativas    |    |
| +--------------------+  +--------------------+    |
|                                                   |
| CAPTACAO                                          |
| +--------------------+                            |
| | Fontes de Leads    |                            |
| | 2 ativas           |                            |
| | [Gerenciar ->]     |                            |
| +--------------------+                            |
+--------------------------------------------------+
```

### Nivel 2 -- Paginas dedicadas (sub-rotas)

**WhatsApp** tera sua propria sub-rota `/configuracoes/integracoes/whatsapp` organizada em **steps/sections com accordion ou tabs internas**:

```text
+--------------------------------------------------+
| <- Voltar | WhatsApp Business                     |
+--------------------------------------------------+
| TABS: [Conexao] [IA & Respostas] [Templates Meta]|
+--------------------------------------------------+
| Tab Conexao:                                      |
|   Provedor ativo (Evolution vs Meta) com toggle   |
|   Config do provedor selecionado                  |
|   Status + QR Code / Dados da conta               |
|                                                   |
| Tab IA:                                           |
|   Toggle IA + capacidades                         |
|   Estatisticas 24h                                |
|                                                   |
| Tab Templates:                                    |
|   Tabela de templates + acoes                     |
+--------------------------------------------------+
```

**API Keys** e **Fontes de Leads** viram sub-rotas tambem, acessadas pelo card no hub.

## Alteracoes Tecnicas

### 1. `Integracoes.tsx` -- Reescrever como Hub
- Remover tabs, usar grid de cards por categoria
- Usar dados reais de `useIntegracoesStatus()` nos cards de resumo
- Cards clicaveis que navegam para sub-rotas ou abrem o `ConfigurarIntegracaoSheet`
- WhatsApp, API Keys e Fontes de Leads navegam para sub-paginas
- Demais integracoes (ASAAS, Autentique, etc.) continuam abrindo o Sheet existente

### 2. Nova sub-rota: `IntegracaoWhatsApp.tsx`
- Rota: `/configuracoes/integracoes/whatsapp`
- Organiza o conteudo existente em 3 tabs internas: Conexao, IA, Templates
- Botao "Voltar" para o hub
- Reutiliza os componentes existentes sem reescrevê-los internamente

### 3. Nova sub-rota: `IntegracaoApiKeys.tsx`
- Move o conteudo de `ChavesApiTab` para pagina propria
- Rota: `/configuracoes/integracoes/api-keys`

### 4. Nova sub-rota: `IntegracaoFontesLeads.tsx`
- Move o conteudo de `ApisLeadsTab` para pagina propria
- Rota: `/configuracoes/integracoes/fontes-leads`

### 5. Rotas (em `App.tsx` ou arquivo de rotas)
- Adicionar rotas filhas para as 3 sub-paginas

### 6. Cards de servico redesenhados
- Mais compactos, visuais, com icone grande + status badge
- Hover com sutil elevacao
- Click area inteira (nao so botao)

### 7. Resumo no topo com dados reais
- Conectados / Pendentes / Erros calculados de `useIntegracoesStatus()`

## Arquivos Modificados
- `src/pages/configuracoes/Integracoes.tsx` -- reescrever como hub
- `src/pages/configuracoes/IntegracaoWhatsApp.tsx` -- novo
- `src/pages/configuracoes/IntegracaoApiKeys.tsx` -- novo (wrapper fino do ChavesApiTab)
- `src/pages/configuracoes/IntegracaoFontesLeads.tsx` -- novo (wrapper fino do ApisLeadsTab)
- Arquivo de rotas -- adicionar 3 sub-rotas
- `src/components/integracoes/ServicosTab.tsx` -- remover (logica absorvida pelo hub)
- `src/pages/configuracoes/index.tsx` -- exportar novas paginas

## Resultado
- **1 clique** para ver status de tudo
- **2 cliques** para configurar qualquer integracao
- WhatsApp deixa de ser um scroll infinito
- Dados de status reais no lugar de mock
- Separacao clara entre overview e configuracao detalhada

