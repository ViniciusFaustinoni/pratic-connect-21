

# Fila de Processamento IA para WhatsApp

## Confirmação do Diagnóstico
- 6 mensagens de entrada em Março: **todas salvas** no banco
- 0 respostas enviadas dentro de 5 min para **qualquer** uma delas
- O problema é exclusivamente na delegação assíncrona (processo morre após o 200 OK)

## Solução: Tabela de Fila + Processador com Cron

### 1. Nova tabela `whatsapp_fila_ia`
```sql
CREATE TABLE whatsapp_fila_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid REFERENCES whatsapp_mensagens(id),
  telefone text NOT NULL,
  texto text,
  tipo_msg text DEFAULT 'text',
  latitude double precision,
  longitude double precision,
  message_id text,
  status text DEFAULT 'pendente',
  tentativas int DEFAULT 0,
  erro text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_fila_ia_pendente ON whatsapp_fila_ia(status) WHERE status IN ('pendente','erro');
```

### 2. Modificar `whatsapp-meta-webhook`
Ao identificar um associado ativo, em vez de delegar diretamente para `whatsapp-webhook`:
- Inserir na fila `whatsapp_fila_ia` com status `pendente`
- Tentar disparar `processar-fila-ia` (best-effort, sem depender disso)
- Retornar 200 imediatamente

### 3. Nova Edge Function `processar-fila-ia`
- Busca registros com status `pendente` ou `erro` (tentativas < 3)
- Para cada um, chama `whatsapp-webhook` com payload sintético
- Atualiza status para `concluido` ou `erro` + incrementa tentativas
- Se falhar 3x, envia fallback ao associado

### 4. Cron Job (safety net)
A cada 1 minuto, invoca `processar-fila-ia` para garantir que nenhuma mensagem fique sem resposta.

### Fluxo
```text
Associado envia msg
       │
       ▼
whatsapp-meta-webhook
       │
       ├─ Salva em whatsapp_mensagens (já faz)
       ├─ Insere em whatsapp_fila_ia (pendente)
       ├─ Retorna 200 OK para Meta
       └─ Tenta disparar processar-fila-ia (best-effort)
       
processar-fila-ia (cron 1min OU disparo imediato)
       │
       ├─ Busca pendentes/erro com tentativas < 3
       ├─ Chama whatsapp-webhook para cada
       ├─ Marca concluido ou erro
       └─ Após 3 falhas → envia fallback
```

### Arquivos
- **Migração SQL**: tabela `whatsapp_fila_ia`
- **`supabase/functions/whatsapp-meta-webhook/index.ts`**: substituir delegação direta por insert na fila
- **`supabase/functions/processar-fila-ia/index.ts`**: nova function
- **Cron job SQL**: schedule a cada 1 minuto
- **`supabase/config.toml`**: adicionar `processar-fila-ia` com `verify_jwt = false`

