
# TUM3D59 — Corrigir vínculo de rastreador (Rede Veículos, não Softruck)

## Diagnóstico

Saneamento anterior assumiu `plataforma='softruck'` porque a busca tri-fonte casou no Softruck primeiro. Na verdade, o IMEI **869412072526525** (Honda CG 160 Start, EDGAR DA SILVA SANTOS) está fisicamente vinculado na **Rede Veículos**, e o registro Softruck é resíduo de associação antiga ao KPX3F78.

Estado atual no banco:
- `rastreadores.plataforma` = `softruck` ❌ (deveria ser `rede_veiculos`)
- `rastreadores.plataforma_device_id` = `K3VgZ9xApKQ5EYW` (id Softruck do antigo veículo)
- `rastreadores.plataforma_veiculo_id` = `grADZV6qk3ZyqOk` (id Softruck que criamos pro TUM3D59)
- `rastreadores.softruck_integration_status` = `PENDING`
- `veiculos.softruck_vehicle_id` = `grADZV6qk3ZyqOk`
- `veiculos.rede_veiculos_veiculo_id` = NULL
- `veiculos.rede_veiculos_cliente_id` = NULL

Validação na API Rede Veículos (agora):
- `rede-veiculos-buscar-dispositivo` por IMEI **e** por placa: `found=false`, mensagem *"Equipamento/Veículo não localizado ou não permite integração (Opção: 'Permitir sincronismo nas integrações' no cadastro do equipamento/veículo)"*.

Ou seja: na Rede o equipamento existe mas com **sincronismo desabilitado**, ou ainda não foi cadastrado. Sem habilitar isso no backoffice da Rede, nenhuma chamada de sync nossa terá efeito.

## Plano

### Passo 1 — Saneamento do registro `rastreadores` (migration)
Em `rastreadores.id=7a4b13ab-da6c-4e8f-ab7e-38b8803d8fdb`:
- `plataforma = 'rede_veiculos'`
- `plataforma_device_id = NULL`
- `plataforma_veiculo_id = NULL`
- `softruck_integration_status = NULL`
- `softruck_last_attempt_at = NULL`
- `softruck_payload_sent = NULL`
- `softruck_response_raw = NULL`
- `softruck_chip_id = NULL`
- `id_plataforma`, `imei`, `veiculo_id`, `status='instalado'` permanecem
- Log de auditoria `[CORRECAO_PLATAFORMA_RASTREADOR]` com motivo (vínculo físico é Rede, Softruck era resíduo do KPX3F78).

### Passo 2 — Limpar resíduo Softruck em `veiculos` (TUM3D59)
- `veiculos.softruck_vehicle_id = NULL`
- Log de auditoria.
- (Não tocar em `rede_veiculos_veiculo_id` aqui — virá do sync no Passo 4.)

### Passo 3 — Avisar operador da Rede Veículos
A API responde "não encontrado ou sync desabilitado". Antes do Passo 4 funcionar, o operador precisa, no backoffice da Rede:
1. Confirmar que o equipamento IMEI `869412072526525` está cadastrado, e
2. Marcar **"Permitir sincronismo nas integrações"** no cadastro desse equipamento/veículo.

Sem isso, qualquer chamada de sync nossa volta `found=false` e o vínculo não materializa. Esse passo é manual e fora do código.

### Passo 4 — Sincronizar na Rede Veículos (depois do Passo 3)
Chamar, nesta ordem:
1. `rede-veiculos-ativar-cliente-completo` (ou `vincular-cliente` + `ativar-veiculo` conforme o caso) para o associado `4326b0f4-ba90-49fb-ad98-e58e3e298fbe` + veículo `55c2f9bc-9c16-4e63-a838-d2fbe143d5aa`.
2. `rede-veiculos-buscar-dispositivo` por IMEI para confirmar `found=true` e gravar `rede_veiculos_veiculo_id`/`rede_veiculos_cliente_id` em `veiculos`.
3. Atualizar `rastreadores.id_plataforma` com o id retornado pela Rede, se diferente.

Sem o Passo 3, o Passo 4 é abortado com aviso ao operador (sem mais retries cegos).

### Passo 5 — Decisão sobre Softruck (limpeza do lado de lá)
Na Softruck o asset `K3VgZ9xApKQ5EYW` continua associado ao veículo antigo `1aN6LqxoGawEY4O` (KPX3F78) — isso ficou inconsistente porque é resíduo de instalação que nunca foi de fato Softruck. Como o vínculo real é Rede, **não fazemos nada na Softruck**: nem desassociar, nem desativar, pra não bagunçar histórico de outro veículo. Só registro de auditoria explicando.

### Passo 6 — Guard pra não cair de novo (correção pontual no hook)
Em `useBuscarRastreadorPorImei` (`src/hooks/useBuscarRastreadorPorImei.ts`) a tri-fonte tem ordem **estoque → Softruck → Rede**. Quando o Softruck retorna `found=true` mas o dispositivo está associado a **outro veículo** lá, hoje paramos no Softruck e gravamos `plataforma='softruck'` mesmo que a Rede também devolva `found=true` para a placa-alvo.

Ajuste mínimo:
- Quando o Softruck devolve `found=true` mas o asset Softruck está vinculado a veículo **diferente** do `veiculoIdAlvo` (cenário "asset already associated"), consultar também a Rede Veículos pela placa do veículo alvo. Se a Rede devolver `found=true` para a placa alvo, preferir `rede_veiculos`.
- Se ambas as fontes devolverem found mas em veículos distintos, devolver `conflito` enriquecido (origem ambígua) em vez de assumir Softruck.

Esse ajuste é frontend-only, não muda o contrato de retorno (`origem` continua `'estoque' | 'softruck' | 'rede_veiculos'`).

### Passo 7 — Memória
Atualizar `mem://logic/operations/rastreador-vinculo-preservacao` (já existente) com uma linha lembrando: na correção de IMEI órfão, validar plataforma pelo veículo-alvo (cruzar Softruck E Rede), nunca herdar do registro Softruck antigo.

## Fora de escopo
- Não mexer em Softruck do KPX3F78.
- Não criar trigger DB nova (o problema é dado-pontual + viés do tri-fonte, não cascata).
- Não tocar no fluxo de Cadastro/Monitoramento — o caso TUM3D59 já está na fila de aprovação correta.

## Dependência externa
Passo 4 depende do operador habilitar "Permitir sincronismo nas integrações" no backoffice da Rede (Passo 3). Se isso já estiver feito, executamos Passo 4 nesta mesma loop. Caso contrário, aplico Passos 1, 2, 5, 6, 7 agora e deixo o Passo 4 sinalizado pra rodar quando o operador confirmar.
