

## Diagnóstico

A vistoria da Kelly **foi salva apenas em `cotacoes` (`vistoria_data_agendada=2026-04-17`)**, mas não criou registro em `vistorias`, `instalacoes`, nem `servicos`. Por isso não aparece no calendário de monitoramento.

### Por que aconteceu

A edge `agendar-vistoria-presencial` foi alterada para **NÃO criar mais a instalação** — ela só salva os campos `vistoria_*` na cotação e delega tudo para `criar-instalacao-pos-pagamento`, que só roda depois do pagamento confirmado.

No caso da Kelly:
- Contrato `assinado`, `adesao_paga=true` ✅
- Mas `criar-instalacao-pos-pagamento` **nunca foi chamado** para a cotação `c64ae336…` (zero logs).

A edge tem 4 disparadores (frontend de pagamento, webhook Asaas e 2 caminhos do cron de reconciliação), e essa cotação caiu numa fresta entre eles — provavelmente o pagamento foi marcado por outro caminho (sga-hinova ou aprovação manual) que não dispara a edge.

## Correção (duas frentes)

### 1) Recuperar a Kelly agora
Disparar manualmente `criar-instalacao-pos-pagamento` para `cotacaoId = c64ae336-ae89-420a-b2bf-10ecf78abe8e` via `supabase.functions.invoke`. Como o `adesao_paga` já é `true`, vai criar a instalação + serviço + aparecer no calendário de 17/04.

### 2) Fechar a fresta para sempre
Criar **trigger no banco** em `contratos` que, quando `adesao_paga` passa de `false` → `true` E a cotação vinculada tem `vistoria_data_agendada` E não existe instalação ainda, dispara `criar-instalacao-pos-pagamento` via `pg_net.http_post` (já usado no projeto). Assim, qualquer caminho que marque o pagamento (webhook, cron, SGA, manual, etc.) garante a criação da instalação.

Pseudo-trigger:
```sql
CREATE OR REPLACE FUNCTION trg_disparar_criar_instalacao()
RETURNS trigger AS $$
BEGIN
  IF NEW.adesao_paga = true AND COALESCE(OLD.adesao_paga,false) = false THEN
    -- Verifica se cotação tem agendamento e ainda não tem instalação
    IF EXISTS (
      SELECT 1 FROM cotacoes c
      WHERE c.id = NEW.cotacao_id
        AND c.vistoria_data_agendada IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = c.id)
    ) THEN
      PERFORM net.http_post(
        url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/criar-instalacao-pos-pagamento',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||<service_role>),
        body   := jsonb_build_object('cotacaoId', NEW.cotacao_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 3) Logging melhor (mínimo)
Em `agendar-vistoria-presencial`, adicionar uma fila de retentativas (`fila_jobs` ou similar) caso o pagamento já esteja `true` no momento do agendamento — assim cobrimos também o caso "agendou depois de pagar".

## Arquivos a editar

- **Migration nova**: criar trigger `trg_disparar_criar_instalacao_pos_pagamento` na tabela `contratos`.
- **Script único** (não código): invocar `criar-instalacao-pos-pagamento` para a cotação da Kelly.
- (Opcional) `supabase/functions/agendar-vistoria-presencial/index.ts`: ao final, se cotação já tiver `adesao_paga=true`, chamar a edge de criação na hora.

## Não vou mexer

- Cálculo de vagas, geocodificação, lógica de comissão CC.
- Demais paths que já chamam a edge.

## Resultado

- Kelly aparece no calendário de 17/04 imediatamente após o disparo manual.
- Daqui pra frente, qualquer cotação que tiver pagamento confirmado por **qualquer caminho** vai automaticamente criar a instalação/serviço e aparecer no calendário, sem depender do front lembrar de chamar a edge.

