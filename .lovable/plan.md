
Diagnóstico confirmado (com evidência real do banco)

- O erro que está quebrando o upload agora não é mais `hora_agendada`; o banco está registrando:
  - `record "new" has no field "endereco_uf"` (erro 42703).
- A função ativa no banco `public.sync_vistoria_update_to_servicos()` ainda está com:
  - `uf = COALESCE(NEW.endereco_uf, servicos.uf)`  
  mas em `vistorias` a coluna correta é `endereco_estado`.
- Também existe risco de próxima quebra: `servicos.data_agendada` é NOT NULL e a função atual faz `data_agendada = NEW.data_agendada` (vistorias de entrada normalmente têm `data_agendada = null`), podendo causar erro depois que corrigirmos o `endereco_uf`.

Do I know what the issue is?  
- Sim: trigger de sync da vistoria para serviço está usando campos errados/incompatíveis com o schema atual de `vistorias`.

Plano de correção (implementação)

1) Criar nova migration SQL (não editar migrations antigas)
- Recriar `public.sync_vistoria_update_to_servicos()` com mapeamento correto de colunas:
  - `uf = COALESCE(NEW.endereco_estado, servicos.uf)` (corrige erro 42703)
  - `hora_agendada = COALESCE(NEW.horario_agendado, servicos.hora_agendada)`
  - `data_agendada = COALESCE(NEW.data_agendada, servicos.data_agendada)` (evita violação NOT NULL)
  - manter `status = public.map_to_status_servico(NEW.status::text)`
  - manter sincronização de endereço/coords com `COALESCE`.
- Estrutura alvo da função:
  - profissional_id, status, data/hora, logradouro/numero/bairro/cidade/uf/latitude/longitude, updated_at.

2) Endurecer contra regressão de schema
- Na mesma migration, adicionar bloco `DO $$ ... $$` de validação leve (assert):
  - garante que `vistorias` possui `endereco_estado` e `horario_agendado`;
  - se não tiver, levanta exception na migration (falha explícita em vez de quebrar runtime).

3) Validar após aplicar migration
- Verificação técnica no banco:
  - `pg_get_functiondef('public.sync_vistoria_update_to_servicos'::regproc)` sem `endereco_uf` e sem `NEW.hora_agendada`.
- Verificação funcional:
  - repetir upload do vídeo na vistoria `1aae23ac-af44-4e82-98fc-29569de38673`;
  - confirmar PATCH em `vistorias` com 2xx e `video_360_url` preenchido;
  - confirmar ausência de novos 42703 no postgres log.

4) Checagem de impacto nos outros fluxos
- Testar rapidamente updates em vistoria de instalação (auto-save de checklist e observações) para garantir que trigger não derruba:
  - atualização simples em `dados_parciais`/`observacoes`;
  - atualização de status em vistoria concluída.
- Confirmar que sincronização para `servicos` continua íntegra (sem alterar indevidamente agendamento existente quando a vistoria não informa data/hora).

Resumo executivo
- A correção anterior removeu `NEW.hora_agendada`, mas deixou outro campo inválido (`NEW.endereco_uf`), por isso o erro continuou.
- A correção definitiva é ajustar o trigger para os nomes reais de `vistorias` (`endereco_estado`, `horario_agendado`) e preservar `data_agendada` com COALESCE para não quebrar novamente.
