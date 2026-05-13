## Reset KOU6D37 — voltar para "termo de cancelamento assinado"

Estado atual:
- `solicitacoes_troca_titularidade 52cc74c1` → `liberada_para_assinatura`, cadastro aprovado, vinculada à cotação `3f0408b9`.
- `cotacoes 3f0408b9` → criada (vistoria_agendada) com 1 `agendamentos_base` vinculado.
- `veiculos.em_troca_titularidade = true` (correto para essa fase — manter).
- Sem contratos/vistorias/serviços/instalações/cobranças associados.

## Migration única (data fix)

```sql
-- 1) Limpar artefatos da cotação criada após a aprovação do cadastro
DELETE FROM public.agendamentos_base
 WHERE cotacao_id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c';

DELETE FROM public.cotacoes
 WHERE id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c';

-- 2) Voltar a solicitação para o estado pós-assinatura do termo
UPDATE public.solicitacoes_troca_titularidade
   SET status                       = 'aguardando_cadastro',
       cotacao_id                   = NULL,
       aprovado_cadastro_em         = NULL,
       aprovado_cadastro_por        = NULL,
       observacao_cadastro          = NULL,
       aprovado_monitoramento_em    = NULL,
       aprovado_monitoramento_por   = NULL,
       observacao_monitoramento     = NULL,
       servico_vistoria_id          = NULL,
       analise_previa_resultado     = NULL,
       analise_previa_em            = NULL,
       efetivada_em                 = NULL,
       motivo_reprovacao            = NULL,
       reprovado_por                = NULL,
       reprovado_em                 = NULL,
       updated_at                   = now()
 WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';
```

Mantido intencionalmente:
- `termo_cancelamento_assinado_em`, `termo_cancelamento_autentique_id`, `termo_cancelamento_url`, `termo_cancelamento_enviado_em`, `novo_titular_dados`, `associado_antigo_id`, `veiculo_id`.
- `veiculos.em_troca_titularidade = true` (sinaliza que o termo já foi assinado).

## Validação
1. Abrir Troca de Titularidade → solicitação aparece na fila do **Cadastro** novamente, status "Aguardando aprovação do cadastro", com termo assinado ✓ e sem cotação vinculada.
2. A partir daí, fluir: aprovar cadastro → criar cotação (testando a vinculação corrigida) → link público → vistoria → contrato → pagamento.

## Fora de escopo
Nenhuma alteração de código. Apenas SQL de reset.
