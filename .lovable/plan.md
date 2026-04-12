

## Plano: Log de Requisições com dados de APIs reais

### Problema
O tab "Requisições" mostra apenas `auth_logs` (login/logout). O usuário quer ver logs das APIs externas: Evolution (WhatsApp), Asaas (pagamentos), Softruck/Rede Veículos (rastreadores), SGA (sincronização), e API de Leads.

### Tabelas existentes no banco

| Tabela | Registros | API | Campos-chave |
|--------|-----------|-----|--------------|
| `whatsapp_logs` | 2.453 | Evolution / WhatsApp | tipo, evento, erro, instancia_id |
| `sga_sync_logs` | 1.099 | SGA (Hinova) | action, status, error_message, duracao_ms |
| `auth_logs` | 891 | Autenticação | acao, email, ip_address |
| `asaas_webhooks_log` | 378 | Asaas | evento, processado, erro |
| `rastreadores_logs` | 33 | Softruck / Rede Veículos | plataforma, operacao, status, tempo_resposta_ms |
| `api_leads_logs` | 0 | API de Leads | origem, status, erro, tempo_resposta_ms |

### Alterações

**1. Reescrever `src/components/gestao-comercial/LogRequisicoesTab.tsx`**

- Adicionar filtro de **Plataforma/API** (dropdown): Todas, WhatsApp/Evolution, Asaas, Softruck, Rede Veículos, SGA, Autenticação, API Leads
- Cada plataforma consulta sua tabela específica
- Normalizar os dados num formato unificado para exibição:
  ```
  { id, created_at, plataforma, operacao, status, erro, tempo_ms, detalhes }
  ```
- Manter filtro de busca (busca em operacao/evento/action)
- Manter paginação existente
- Badges coloridos por plataforma (verde=Evolution, azul=Asaas, laranja=Softruck, vermelho=Rede, roxo=SGA, cinza=Auth)
- Badge de status: sucesso (verde), erro (vermelho), info (amarelo)
- Mostrar tempo de resposta quando disponível

**2. Layout de cada item do log**
- Avatar com iniciais da plataforma (EV, AS, ST, RV, SG, AU, LD)
- Nome da plataforma + badge de operação
- Mensagem de erro (se houver), truncada
- Data/hora + status + tempo de resposta (ms)

### Sem migração SQL necessária
Todas as tabelas já existem e têm RLS configurado. Os tipos já estão no Supabase client.

