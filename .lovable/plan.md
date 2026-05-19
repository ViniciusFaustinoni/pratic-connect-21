## Reset da autovistoria do Marllon (KRF8B74)

Operação one-shot via migração SQL para limpar os artefatos parciais e devolver o link público ao estado de "Escolha de Vistoria".

**IDs envolvidos:**
- contrato: `226eacc0-1938-4b5e-9ae1-fa9c209875d8`
- cotação: `b50180dc-e4f0-420f-8f08-a07175ef0212`
- vistoria parcial: `a9329637-aae6-4c5f-8fdc-6701c5a8b1b6` (1 foto, sem vídeo)
- serviço vistoria_entrada agendado: `526b7da0-a2c3-43bb-86e7-96eb363215b3`

### Migração SQL

```sql
-- 1) Apaga fotos da vistoria parcial (canônicas)
DELETE FROM vistoria_fotos WHERE vistoria_id = 'a9329637-aae6-4c5f-8fdc-6701c5a8b1b6';

-- 2) Apaga a vistoria parcial (libera trigger de materialização para nova autovistoria)
DELETE FROM vistorias WHERE id = 'a9329637-aae6-4c5f-8fdc-6701c5a8b1b6';

-- 3) Apaga fotos legadas em cotacoes_vistoria_fotos (evita rematerialização do mesmo estado)
DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

-- 4) Cancela o servico vistoria_entrada agendado (libera atribuição)
UPDATE servicos
SET status = 'cancelada',
    observacoes_internas = COALESCE(observacoes_internas,'') || E'\n[RESET ' || now()::text || '] Autovistoria parcial cancelada manualmente — cliente vai escolher novo caminho.'
WHERE id = '526b7da0-a2c3-43bb-86e7-96eb363215b3' AND status NOT IN ('concluida','aprovada','reprovada');

-- 5) Reseta tipo_vistoria na cotação para forçar tela de "Escolha de Vistoria" no link público
UPDATE cotacoes
SET tipo_vistoria = NULL,
    vistoria_data_agendada = NULL,
    vistoria_horario_agendado = NULL,
    vistoria_periodo = NULL,
    vistoria_completa_data_agendada = NULL,
    vistoria_completa_horario_agendado = NULL,
    vistoria_completa_periodo = NULL
WHERE id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

-- 6) Garante que contrato segue 'assinado' e cadastro_aprovado=false (estado pré-vistoria)
UPDATE contratos
SET cadastro_aprovado = false
WHERE id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8' AND cadastro_aprovado IS DISTINCT FROM false;
```

### Verificação pós-migração

```sql
SELECT
  (SELECT count(*) FROM vistorias v WHERE v.contrato_id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8') AS vistorias,
  (SELECT count(*) FROM vistoria_fotos f JOIN vistorias v ON v.id = f.vistoria_id WHERE v.contrato_id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8') AS fotos,
  (SELECT count(*) FROM cotacoes_vistoria_fotos WHERE cotacao_id = 'b50180dc-e4f0-420f-8f08-a07175ef0212') AS fotos_legado,
  (SELECT status FROM servicos WHERE id = '526b7da0-a2c3-43bb-86e7-96eb363215b3') AS servico_status,
  (SELECT tipo_vistoria FROM cotacoes WHERE id = 'b50180dc-e4f0-420f-8f08-a07175ef0212') AS tipo_vistoria_cot;
```

Esperado: `vistorias=0, fotos=0, fotos_legado=0, servico_status='cancelada', tipo_vistoria_cot=NULL`.

### Resultado esperado para o cliente

1. Link público do contrato `CTR-...5W2XYL` reabre na etapa **"Escolha de Vistoria"** (autovistoria opcional / agendar instalação domiciliar / vistoria base).
2. Proposta **não aparece** na fila do Cadastro (gate novo + sem caminho concluído).
3. Marllon decide livremente o próximo caminho — quando completar (2 fotos+vídeo, ou agendar instalação/base), a proposta entra naturalmente na fila do Cadastro.

### Sem mudanças de código

Apenas a migração one-shot acima. Nenhum arquivo de frontend/edge altera.