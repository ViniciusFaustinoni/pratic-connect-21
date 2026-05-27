## Objetivo

1. Corrigir o local de instalação do **RJH0C29** na Rede Veículos (hoje "PAINEL", correto: **ODB**).
2. Criar caminho reutilizável para alterar `localInstalacao` na Rede após o vínculo inicial.

## Situação atual (apurada)

- **Banco local** já está correto: `rastreadores.local_instalacao = 'odb'`.
- **`veiculos.rede_veiculos_veiculo_id` está NULL** para o RJH0C29 — nosso sistema não tem o ID da Rede gravado, então não consegue chamar nenhum endpoint de atualização direto.
- Hoje só enviamos `localInstalacao` para a Rede no momento do vínculo inicial (`rede-veiculos-vincular-cliente`). Não existe endpoint nosso para alterar isso depois.

## Plano

### Passo 1 — Backfill do RJH0C29 (caso pontual)

Criar edge **`rede-veiculos-backfill-rjh0c29`** (one-shot, descartável após uso) que:

1. Autentica na Rede.
2. Chama `obterDadosVeiculo` por **placa** (`RJH0C29`) para descobrir `idVeiculo`, `idCliente`, `idEquipamento`.
3. Grava esses IDs no nosso banco:
   - `veiculos.rede_veiculos_veiculo_id`
   - `veiculos.rede_veiculos_cliente_id`
   - `rastreadores.plataforma_device_id` / `id_plataforma`
4. Retorna os IDs encontrados.

Se a Rede não aceitar busca por placa sem CPF, usar fallback: buscar pelo IMEI `356428070135895` via endpoint que aceite (ou cair em `obterDadosVeiculo` passando `cpfCnpj` do associado + `placa`).

### Passo 2 — Nova edge `rede-veiculos-atualizar-equipamento`

Caminho reutilizável para qualquer veículo que precise corrigir o local depois:

- **Input:** `{ veiculoId, localInstalacao }`
- **Fluxo:**
  1. Lê `veiculos.rede_veiculos_veiculo_id` + `rastreadores` do veículo. Falha clara se faltar ID da Rede.
  2. Autentica.
  3. POST para o endpoint da Rede de atualização de equipamento (`atualizarDadosEquipamento/` — confirmar nome exato na primeira chamada via log).
  4. Atualiza `rastreadores.local_instalacao` local em caso de sucesso.
  5. Loga em `rastreadores_api_logs`.
- **Onde acionar** (fora deste plano, mas previsto): drawer do rastreador (aba Gestão da Rede) — botão "Atualizar local na Rede" próximo ao campo de local. Não vou implementar a UI agora; só a edge.

### Passo 3 — Aplicar para o RJH0C29

1. Rodar `rede-veiculos-backfill-rjh0c29`.
2. Rodar `rede-veiculos-atualizar-equipamento` com `localInstalacao='odb'`.
3. Confirmar no painel da Rede.

### Passo 4 — Memória

Adicionar nota em `mem://logic/integrations/rede-atualizar-local-instalacao` registrando o novo endpoint e o requisito de `rede_veiculos_veiculo_id` populado.

## Não está no escopo

- Botão na UI para acionar a atualização (posso fazer depois, se quiser).
- Backfill em massa de outros veículos com `rede_veiculos_veiculo_id` NULL — só o RJH0C29.
- Criar valor "DUTO DO AR ESQUERDO" no catálogo (você optou por manter ODB).

## Riscos

- O endpoint exato da Rede para alterar `localInstalacao` pós-vínculo precisa ser confirmado pela documentação/teste. Se a Rede não expõe isso, o Passo 2 vira **"sincronizar local no nosso banco + alerta para o operador ajustar manualmente no painel"** — eu reporto antes de prosseguir.
