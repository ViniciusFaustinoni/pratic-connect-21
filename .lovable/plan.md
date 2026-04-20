

## Bug — "Não foi possível carregar a vistoria" (Marcos QXV0H02 / Wallace)

### Causa raiz (confirmada)
1. O serviço de instalação (`servicos.id=0a536015…`, tipo `instalacao`, status `em_andamento`) já existe e tem `vistoria_origem_id=null`.
2. Ao entrar na etapa Fotos, o hook `useVistoriaCompletaPorServico` cai no passo 5 e tenta `INSERT INTO vistorias (associado_id, veiculo_id, vistoriador_id, contrato_id, cotacao_id, tipo, status)` — **sem `data_agendada`**.
3. O trigger `sync_vistoria_to_servicos` (AFTER INSERT em `vistorias`) faz `INSERT INTO servicos (..., data_agendada, periodo, ...)` usando `NEW.data_agendada::date`. Como veio `NULL` e `servicos.data_agendada` / `servicos.periodo` são **NOT NULL**, o INSERT do servicos falha → **rollback do INSERT do vistorias**.
4. Resultado: nenhum registro em `vistorias` é criado, o hook devolve `null`, e o app mostra "Não foi possível carregar a vistoria / Ocorreu um erro ao criar o registro de vistoria".

Bônus: mesmo se a NOT NULL não existisse, o trigger criaria um **segundo** `servicos` (tipo `vistoria_entrada`) para o mesmo veículo/associado/contrato, paralelo ao serviço de instalação que já está em andamento — duplicidade indesejada.

### Correção

**1. `src/hooks/useVistorias.ts` — `useVistoriaCompletaPorServico` (passo 5)**
Carregar `data_agendada`, `hora_agendada`, `periodo`, `cep`, `logradouro`, `numero`, `bairro`, `cidade`, `rota_id` no SELECT inicial do `servicos` (linha 863) e propagá-los no INSERT do `vistorias`:

```ts
.insert({
  associado_id: servico.associado_id,
  veiculo_id:  servico.veiculo_id,
  vistoriador_id: servico.profissional_id,
  contrato_id: servico.contrato_id,
  cotacao_id:  servico.cotacao_id,
  tipo: 'entrada',
  status: 'em_analise',
  // NOVO: necessários para o trigger sync_vistoria_to_servicos
  data_agendada: servico.data_agendada,
  horario_agendado: servico.hora_agendada,
  endereco_cep: servico.cep,
  endereco_logradouro: servico.logradouro,
  endereco_numero: servico.numero,
  endereco_bairro: servico.bairro,
  endereco_cidade: servico.cidade,
  rota_id: servico.rota_id,
})
```

Aplicar o mesmo nos dois `insert` do passo 5 (com vistoriador e fallback sem vistoriador).

**2. Trigger `sync_vistoria_to_servicos` (migração)**
Hardening para evitar bug similar no futuro:
- Antes de inserir, verificar se já existe um `servicos` para o mesmo `(associado_id, veiculo_id, contrato_id)` em estado ativo (`agendada`, `em_rota`, `em_andamento`, `em_analise`). Se sim, apenas atualizar o `vistoria_origem_id` deste serviço já existente — não criar duplicata.
- Quando criar de fato, fazer `COALESCE(NEW.data_agendada::date, CURRENT_DATE)` para nunca quebrar com NULL.

```sql
CREATE OR REPLACE FUNCTION public.sync_vistoria_to_servicos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tipo tipo_servico;
  v_hora time;
  v_periodo periodo_servico;
  v_data date;
  v_existing_id uuid;
  v_active_servico_id uuid;
BEGIN
  v_tipo := CASE NEW.tipo::text
    WHEN 'entrada' THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida'   THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro'THEN 'vistoria_sinistro'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END;
  v_hora := COALESCE(NEW.horario_agendado, '09:00:00'::time);
  v_periodo := CASE WHEN v_hora < '12:00' THEN 'manha'::periodo_servico
                    WHEN v_hora < '18:00' THEN 'tarde'::periodo_servico
                    ELSE 'noite'::periodo_servico END;
  v_data := COALESCE(NEW.data_agendada::date, CURRENT_DATE);

  IF TG_OP = 'INSERT' THEN
    -- Idempotência por vistoria_origem_id
    SELECT id INTO v_existing_id FROM servicos WHERE vistoria_origem_id = NEW.id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE servicos SET profissional_id = COALESCE(NEW.vistoriador_id, profissional_id), updated_at = now() WHERE id = v_existing_id;
      RETURN NEW;
    END IF;

    -- NOVO: se já existe serviço ativo para o mesmo trio, vincular sem duplicar
    SELECT id INTO v_active_servico_id
      FROM servicos
     WHERE associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND COALESCE(contrato_id::text,'') = COALESCE(NEW.contrato_id::text,'')
       AND status IN ('agendada','em_rota','em_andamento','em_analise')
     ORDER BY created_at DESC LIMIT 1;
    IF v_active_servico_id IS NOT NULL THEN
      UPDATE servicos SET vistoria_origem_id = NEW.id, updated_at = now() WHERE id = v_active_servico_id;
      RETURN NEW;
    END IF;

    INSERT INTO servicos (tipo, status, data_agendada, hora_agendada, periodo,
                          profissional_id, associado_id, veiculo_id, vistoria_origem_id,
                          cep, logradouro, numero, bairro, cidade, rota_id, created_at, updated_at)
    VALUES (v_tipo, COALESCE(NEW.status::text::status_servico, 'agendada'),
            v_data, v_hora, v_periodo,
            NEW.vistoriador_id, NEW.associado_id, NEW.veiculo_id, NEW.id,
            NEW.endereco_cep, NEW.endereco_logradouro, NEW.endereco_numero,
            NEW.endereco_bairro, NEW.endereco_cidade, NEW.rota_id, now(), now());
    RETURN NEW;
  END IF;

  -- bloco UPDATE inalterado
  ...
END $$;
```

**3. Reparo manual do caso pendente (Marcos / Wallace)**
Após a correção entrar no ar, criar a vistoria que faltou via SQL (one-shot) para que o técnico não precise reiniciar a tarefa:
```sql
INSERT INTO vistorias (associado_id, veiculo_id, vistoriador_id, contrato_id, cotacao_id, tipo, status, data_agendada, horario_agendado)
VALUES ('eb4776fc-…','dbcc9eb9-…','f6313b28-…','86505fe3-…','10c38d64-…','entrada','em_analise', NOW(), '15:00');
```
Com o trigger novo, o `servicos.0a536015…` será automaticamente vinculado via `vistoria_origem_id` (sem duplicar).

### Arquivos tocados
1. `src/hooks/useVistorias.ts` — adicionar campos no SELECT (passo 1) e no INSERT (passo 5, ambos os branches).
2. Nova migration `fix_sync_vistoria_to_servicos_idempotency` — substitui a função `sync_vistoria_to_servicos` com COALESCE de data e dedupe por trio ativo.
3. Migration de dados pontual — INSERT da vistoria faltante para Marcos.

### Validação
1. Logado como Wallace, abrir `/instalador/checklist/0a536015-…` → etapa Fotos carrega sem erro, mostra 0/31 fotos prontas para upload.
2. Logar como qualquer outro técnico em uma instalação `em_andamento` que ainda não tem vistoria → fotos carregam normalmente.
3. Conferir na DB: `vistorias` tem 1 nova linha; `servicos` continua com 1 linha só (`0a536015…`) — não cria duplicata.
4. Concluir a vistoria → status flui para `aprovada`/`reprovada` normalmente; `instalacoes` espelha via triggers existentes.
5. Caso edge: vistoria criada via fluxo público (sem `data_agendada`) → trigger usa `CURRENT_DATE` e não quebra mais.

