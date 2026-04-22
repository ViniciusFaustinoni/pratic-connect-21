

## Correções para envio de veículos a Softruck e Rede Veículos

Após auditar os fluxos em produção, confirmei: **os veículos NÃO estão sendo enviados corretamente**. O sistema mostra posição (porque polla a API por ID), mas a maioria dos veículos nunca foi criada na conta correta.

### Diagnóstico (confirmado em produção)

**Softruck**
- Conta tem 3 enterprises: `Pratic ABM` (`Xz9klZ7Djw4onEM`), `PraticCar` (`1Ndzlwjm7NZagyv`) e `Pratic Master` (`oydMqwmvgeLJ1kB`).
- O código tem **hardcoded** `SOFTRUCK_ENTERPRISE_ID = 'oydMqwmvgeLJ1kB'` (Pratic Master) em `softruck-api/index.ts` linha 129.
- Resultado: dos 3 únicos veículos com `softruck_integration_status = SUCCESS`, todos foram criados na enterprise **errada** (Pratic Master, em desuso). Os veículos reais de produção (6159 rastreadores Softruck) **nunca foram enviados** à API — estão com status `pending` (default), o que significa que `softruck-ativar-dispositivo` nunca foi chamado para eles.
- Bug adicional: `listar-veiculos` envia atributos antigos (`type`, `brand`, `model`) — a API mudou e exige `type_name`, `brand_name`, `model_name`. Retorna 400.

**Rede Veículos**
- Zero veículos no banco têm `rede_veiculos_veiculo_id` populado (0 de 9677). Isto é, **nenhum veículo foi criado com sucesso** pela função `rede-veiculos-vincular-cliente`. Ou nunca foi chamada, ou sempre retorna erro silencioso.
- Não existe trigger automático de chamada após instalação concluída.

**Causa raiz comum**: o frontend conclui a instalação (atualiza tabelas locais) mas **não dispara** as edge functions de envio para a plataforma. Apenas o fluxo manual (admin Integrações → Ativar) chega a chamar.

### O que vai mudar

**1. Softruck — corrigir Enterprise ID** (`supabase/functions/softruck-api/index.ts`)
- Remover hardcode de `SOFTRUCK_ENTERPRISE_ID`.
- Ler de variável de ambiente `SOFTRUCK_ENTERPRISE_ID` (a ser configurada como secret).
- Default fallback: chamar `descobrir-enterprise-id` filtrando pelo CNPJ correto (vou perguntar qual abaixo) e usar o primeiro retornado.
- Cachear em memória do worker para evitar lookup a cada request.

**2. Softruck — corrigir `listar-veiculos`** (mesmo arquivo, linha ~360)
- Trocar `attributes[]=type` → `attributes[]=type_name`, `brand` → `brand_name`, `model` → `model_name`. Mesmo ajuste em `criar-veiculo` se necessário (já usa `type` no body, que é correto para POST).

**3. Softruck — re-sincronizar veículos da enterprise errada**
- Nova edge function `softruck-recriar-veiculos-enterprise-correta`:
  - Lista os 3 veículos atuais em Pratic Master via API.
  - Para cada um, recria na enterprise correta (`Xz9klZ7Djw4onEM` ou a escolhida pelo usuário).
  - Atualiza `veiculos.softruck_vehicle_id` e `rastreadores.plataforma_veiculo_id` no banco.
  - Re-associa device + ativa.
  - Opcionalmente deleta o veículo antigo da enterprise errada (com confirmação).

**4. Disparo automático na conclusão da instalação**
- Identificar onde `instalacoes.status = 'concluida'` é setado (provavelmente `concluir-instalacao-prestador` ou hook `useInstalacao`).
- Adicionar trigger pós-conclusão que chama `softruck-ativar-dispositivo` ou `rede-veiculos-vincular-cliente` conforme `rastreador.plataforma`.
- Já existe `cron-reconciliar-instalacoes` — auditar se ele faz isso e corrigir se não estiver chamando as funções de envio.

**5. Rede Veículos — backfill dos 6000+ rastreadores**
- Nova edge function `rede-veiculos-backfill-veiculos`:
  - Lista todos os veículos com rastreador `plataforma=rede_veiculos`, status `instalado`, `rede_veiculos_veiculo_id IS NULL`.
  - Processa em lotes de 30 (rate limit), chamando `rede-veiculos-vincular-cliente` para cada.
  - Loga sucessos/erros em `rastreadores_api_logs`.
- Análogo para Softruck: nova `softruck-backfill-veiculos` para os 6159 rastreadores `pending`.

**6. Painel admin de monitoramento**
- Em `/admin/integracoes` (ou similar — verificar rota exata): card mostrando "X de Y veículos enviados à Softruck", "X de Y enviados à Rede Veículos", botão "Sincronizar pendentes" que dispara as backfill functions.

**7. Logs de erro visíveis**
- A tabela `rastreadores_api_logs` referenciada no código **não existe** no schema (confirmado no teste). Criar via migration: `id, rastreador_id, plataforma, operacao, request jsonb, response jsonb, status text, erro_mensagem text, created_at timestamptz`. Sem esta tabela, todos os `INSERT` em logs estão falhando silenciosamente — mascara erros.

### Pergunta antes de implementar

Preciso confirmar **qual enterprise da Softruck deve receber os novos veículos**. Posso te perguntar isso com `ask_questions` na hora da implementação, mas adianto as opções:

- **Pratic ABM** (`Xz9klZ7Djw4onEM`, CNPJ 29.314.883/0001-96) — onde já existem 1 veículo (placa QQK6G89… aliás, este aparece em "ASSOCIACAO BENEFICIOS PRATICCAR").
- **PraticCar** (`1Ndzlwjm7NZagyv`, CNPJ 50.974.144/0001-17) — "Associação de Benefícios PraticCar para Motoristas de Aplicativo".
- **Pratic Master** (`oydMqwmvgeLJ1kB`) — onde está o hardcode atual.

### Arquivos editados/criados

- `supabase/functions/softruck-api/index.ts` — remover hardcode, usar env var, corrigir atributos `*_name`
- `supabase/functions/softruck-backfill-veiculos/index.ts` — novo
- `supabase/functions/softruck-recriar-veiculos-enterprise-correta/index.ts` — novo
- `supabase/functions/rede-veiculos-backfill-veiculos/index.ts` — novo
- `supabase/functions/concluir-instalacao-prestador/index.ts` — disparo pós-conclusão (auditar e ajustar)
- Migration: criar tabela `rastreadores_api_logs` + secret `SOFTRUCK_ENTERPRISE_ID`
- UI admin: card de status + botões de sincronização (caminho exato a confirmar na implementação)

### Riscos

- Recriar veículos na enterprise correta pode gerar duplicidade temporária — a função usa `buscar-veiculo-placa` antes de criar para evitar.
- Backfill de 6000+ chamadas precisa de rate limit (200ms entre cada) — vai levar ~20min em background. Implementarei com paginação para rodar em lotes.

