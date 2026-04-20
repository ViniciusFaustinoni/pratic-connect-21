

## Marcar instalação como "Concluída com ressalvas (sistema legado)" e ativar para 360

### Contexto
A instalação do **VENILTON AUGUSTO DA SILVA** (Ford Focus, HAT3D43) foi efetivamente realizada pelo Wallace, mas o registro ficou aberto porque a finalização foi feita no **sistema antigo**. Precisamos:
1. Destravar o Wallace.
2. Fechar o serviço como **concluído com ressalvas** (não como cancelado, para preservar o histórico real de execução).
3. Ativar o veículo para **monitoramento 360** (rastreador ativo, cobertura liberada).

### Ações (via SQL — uma migração de dados única)

#### 1. Fechar a vistoria/serviço órfão como concluído com ressalvas
```sql
-- Serviço
UPDATE servicos
   SET status = 'concluida',
       iniciada_em = COALESCE(iniciada_em, created_at),
       concluida_em = now(),
       observacoes = COALESCE(observacoes,'') ||
         E'\n[20/04 - ajuste manual] Serviço finalizado no sistema antigo. Registrado como CONCLUÍDO COM RESSALVAS para destravar o instalador WALLACE e ativar o veículo no 360.'
 WHERE id = '1ae32eeb-41a2-4d23-99b7-e825c0e3da2d';

-- Vistoria correspondente
UPDATE vistorias
   SET status = 'concluida_com_ressalvas',
       concluida_em = now(),
       observacoes_finais = 'Instalação finalizada no sistema legado. Registro migrado com ressalvas para destravar fluxo e ativar 360.',
       updated_at = now()
 WHERE id = '9a79a9b4-7894-44bf-a23b-efd67ab1c086';

-- Agendamento base
UPDATE agendamentos_base
   SET status = 'concluido',
       updated_at = now()
 WHERE id = '836bcba0-92a5-4193-b608-5426461b2d69';
```

#### 2. Ativar veículo para Monitoramento 360
```sql
-- Marca rastreador como ativo / instalado
UPDATE veiculos
   SET rastreador_ativo = true,
       rastreador_instalado_em = COALESCE(rastreador_instalado_em, now()),
       monitoramento_ativo = true,
       updated_at = now()
 WHERE placa = 'HAT3D43';

-- Garante que a cobertura não fique suspensa pela regra das 48h
-- (limpa qualquer suspensão automática por falta de instalação)
UPDATE coberturas_associado
   SET status = 'ativa',
       suspenso_motivo = NULL,
       suspenso_em = NULL,
       updated_at = now()
 WHERE veiculo_id = (SELECT id FROM veiculos WHERE placa = 'HAT3D43')
   AND suspenso_motivo ILIKE '%rastreador%';
```

#### 3. Registrar no histórico do associado (auditoria)
```sql
INSERT INTO associados_historico (associado_id, veiculo_id, tipo, descricao, dados_novos)
SELECT v.associado_id,
       v.id,
       'instalacao_concluida_legado',
       'Instalação concluída com ressalvas — finalizada no sistema antigo. Veículo ativado para Monitoramento 360 manualmente em 20/04.',
       jsonb_build_object(
         'instalador', 'Wallace',
         'placa', 'HAT3D43',
         'origem_ajuste', 'sistema_legado',
         'servico_id', '1ae32eeb-41a2-4d23-99b7-e825c0e3da2d'
       )
  FROM veiculos v
 WHERE v.placa = 'HAT3D43';
```

#### 4. Cancelar a instalação duplicada de amanhã (09:00)
A instalação `5671f5cd` foi gerada porque o sistema "achou" que a vistoria não tinha terminado. Como o serviço já está concluído de fato, ela vira duplicidade.

```sql
UPDATE servicos
   SET status = 'cancelada',
       observacoes = COALESCE(observacoes,'') ||
         E'\n[20/04] Cancelada por duplicidade — instalação já realizada (registrada com ressalvas via sistema legado).'
 WHERE id = '5671f5cd-...';   -- confirmar UUID completo via consulta antes
```

### Nada de mudança em código front
Apenas dados. As telas de Serviços, Mapa de Equipe e Monitoramento 360 vão refletir automaticamente.

### Validação
1. Tela do Wallace: a tarefa do VENILTON deixa de aparecer; "Tarefa Atual" zera (ou mostra a próxima legítima).
2. Em **Monitoramento → Serviços de Campo → Serviços**, filtrar por placa HAT3D43 → aparece como **Concluída com ressalvas**.
3. Em **Monitoramento 360**, o veículo HAT3D43 do VENILTON aparece como **ativo**, com rastreador instalado e cobertura ativa.
4. Histórico do associado mostra a entrada `instalacao_concluida_legado`.
5. Sem nova instalação duplicada agendada para 21/04 09:00.

