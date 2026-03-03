

# Plano: Fila de Reenvio SGA + Consulta Backup por CPF

## Problema
A sincronizacao com o SGA Hinova e inconsistente: as vezes so vai o associado, as vezes so o veiculo. Quando o SGA esta em manutencao, nada e enviado e nao ha reenvio automatico. O sistema atual e fire-and-forget — se falha, mostra um toast e para.

## Diagnostico Tecnico
1. **Estado parcial:** A funcao `sga-hinova-sync` ja salva `codigo_associado` mesmo se o veiculo falhar (linha 1019-1027), mas nao ha mecanismo para retomar a parte que faltou.
2. **Sem fila de reenvio:** Se a chamada falha (manutencao, timeout), o unico recurso e o botao manual.
3. **Sem consulta backup:** O endpoint `associado/buscar/:cpf/:buscar_por` (GET) que o usuario forneceu nao e usado para verificar se o associado ja foi cadastrado apos falhas.

## Solucao

### 1. Criar tabela `sga_sync_queue` (fila de reenvio)

```sql
CREATE TABLE public.sga_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  veiculo_id uuid REFERENCES veiculos(id) ON DELETE CASCADE NOT NULL,
  associado_id uuid REFERENCES associados(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluido','falha_permanente')),
  tentativas int DEFAULT 0,
  ultima_tentativa_em timestamptz,
  proximo_reenvio_em timestamptz DEFAULT now(),
  erro_ultimo text,
  etapa_parou text, -- 'associado', 'veiculo', 'fotos' — onde parou
  codigo_associado_hinova int, -- preservar progresso parcial
  codigo_veiculo_hinova int,
  origem text DEFAULT 'automatico', -- 'automatico' ou 'manual'
  UNIQUE(veiculo_id, associado_id)
);

ALTER TABLE public.sga_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sync queue"
ON public.sga_sync_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Atualizar `sga-hinova-sync` para gravar na fila em caso de falha

Nos pontos onde a funcao retorna erro (autenticacao, cadastro associado, cadastro veiculo), ao inves de apenas retornar o erro, tambem inserir/atualizar um registro na `sga_sync_queue` com:
- `etapa_parou`: onde falhou ('associado', 'veiculo', 'fotos')
- `codigo_associado_hinova`: se ja conseguiu cadastrar o associado
- `tentativas`: incrementar
- `proximo_reenvio_em`: agora + 10 minutos
- `erro_ultimo`: mensagem do erro

Quando a sincronizacao completa com sucesso, marcar o registro como `concluido` (ou remover).

### 3. Usar endpoint de consulta backup `associado/buscar/:cpf/cpf`

Adicionar uma etapa no inicio do PASSO 5 (cadastrar associado): **antes de tentar cadastrar**, se a fila indica que ja tentou antes, usar:
```
GET {hinovaApiUrl}/associado/buscar/{cpfFormatado}/cpf
Headers: Authorization: Bearer {tokenUsuario}
```
Se retornar `codigo_associado`, pular o cadastro e usar o codigo encontrado. Isso resolve o caso onde o SGA estava em manutencao, o associado foi cadastrado parcialmente, e ao retomar a fila, ja existe no Hinova.

Mesma logica para veiculo: usar a resposta `veiculos[]` do endpoint de busca do associado para verificar se o veiculo ja foi vinculado.

### 4. Criar Edge Function `cron-sga-retry` (cron cada 10 min)

**Novo arquivo: `supabase/functions/cron-sga-retry/index.ts`**

Logica:
1. Buscar registros em `sga_sync_queue` com `status = 'pendente'` e `proximo_reenvio_em <= now()` e `tentativas < 10`
2. Para cada registro:
   - Marcar como `processando`
   - Se `etapa_parou = 'associado'`: tentar buscar por CPF primeiro (endpoint backup), se nao encontrar, cadastrar
   - Se `etapa_parou = 'veiculo'`: usar `codigo_associado_hinova` salvo e tentar cadastrar veiculo
   - Se `etapa_parou = 'fotos'`: usar codigos salvos e enviar fotos
   - Sucesso: marcar `concluido`, atualizar `veiculos.status_sga = 'ativado_sga'`
   - Falha: incrementar `tentativas`, setar `proximo_reenvio_em = now() + 10min`, manter `pendente`
   - Se `tentativas >= 10`: marcar `falha_permanente`
3. Registrar cron via `pg_cron` a cada 10 minutos

### 5. Badge visual nos pontos que chamam o SGA

**Arquivos: `src/components/ativacao/BotaoEnviarSGA.tsx`**
- Alem dos estados atuais (sincronizado, erro, loading), adicionar estado `na_fila`:
  - Buscar se existe registro em `sga_sync_queue` para este veiculo com `status IN ('pendente','processando')`
  - Mostrar Badge amarelo: "Na fila de reenvio (tentativa X/10)"
  - Badge vermelho se `falha_permanente`: "Falha permanente — verificar manualmente"

**Arquivo: `src/hooks/useAtivacoes.ts`** (fire-and-forget)
- No catch/falha, inserir na `sga_sync_queue` em vez de apenas mostrar toast

### 6. Registrar cron job (SQL direto)

```sql
SELECT cron.schedule(
  'sga-retry-every-10min',
  '*/10 * * * *',
  $$ SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-sga-retry',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbG..."}'::jsonb,
    body:='{}'::jsonb
  ) as request_id; $$
);
```

## Arquivos Afetados
- **Nova tabela:** `sga_sync_queue` (migracao)
- **Novo:** `supabase/functions/cron-sga-retry/index.ts` — cron de reenvio
- **Editar:** `supabase/functions/sga-hinova-sync/index.ts` — gravar na fila em falha, usar endpoint backup
- **Editar:** `src/components/ativacao/BotaoEnviarSGA.tsx` — badge "na fila"
- **Editar:** `src/hooks/useAtivacoes.ts` — inserir na fila em vez de apenas toast
- **Editar:** `supabase/config.toml` — registrar nova funcao
- **SQL:** cron job a cada 10 minutos

## Fluxo Resultante

```text
Ativacao do contrato
  └── sga-hinova-sync (fire-and-forget)
        ├── SUCESSO → ativado_sga ✓
        └── FALHA (qualquer etapa)
              ├── Grava na sga_sync_queue com etapa_parou + progresso parcial
              ├── Badge amarelo: "Na fila de reenvio"
              └── cron-sga-retry (a cada 10 min)
                    ├── Consulta backup: GET /associado/buscar/{cpf}/cpf
                    │     └── Se encontrado → pula cadastro, usa codigo
                    ├── Retoma da etapa onde parou (associado→veiculo→fotos)
                    ├── Sucesso → ativado_sga ✓, Badge verde
                    └── Falha → tentativa++ , proximo reenvio em 10min
                          └── Apos 10 tentativas → falha_permanente, Badge vermelho
```

