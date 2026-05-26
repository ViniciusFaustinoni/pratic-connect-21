# Validação placa ↔ IMEI no Aprovar do Monitoramento (Troca de Titularidade)

## Objetivo
Em `ModalDetalhesTroca` (modo monitoramento), quando o veículo é elegível a rastreador, exigir que o operador digite o IMEI fisicamente instalado e validar — no clique de Aprovar — que esse IMEI está realmente vinculado àquela placa na Softruck (com fallback Rede Veículos), antes de aceitar a decisão.

## Decisões importantes
- **Substituir o `VincularRastreadorExistenteCard` no fluxo de troca** por um novo card mais simples (`ValidarImeiPorPlacaCard`) — o card atual faz busca livre por IMEI (tri-fonte) e não valida vínculo com a placa, que é exatamente o gap descrito. O card antigo continua usado em Aprovação de Associados (fora de escopo).
- **Validação no frontend**, chamando duas edges existentes (sem nova edge function nem migração de banco). Logs com prefixo `[VALIDACAO_IMEI_PLACA]`.
- **IMEI e decisão = transação única**: o IMEI vive no estado do modal e é validado dentro de `handleAprovar` / `handleSolicitarVistoria` / botão de manutenção — qualquer ação de "aprovar/encaminhar" do Monitoramento dispara a validação primeiro.
- **Sem fallback permissivo**: se ambas APIs falharem, bloqueia.
- **Vínculo lógico após sucesso**: ao validar OK, gravar `rastreadores.veiculo_id` localmente (reuso do upsert das edges `*-buscar-dispositivo`) para que a Fase 4 da troca aponte para o rastreador certo.

## Arquivos

### 1. `src/components/troca-titularidade/ValidarImeiPorPlacaCard.tsx` (novo)
Card controlado (parent dono do estado do IMEI). Props: `placa`, `imei`, `onChange`, `erro`, `validando`, `validado`. Renderiza:
- Input numérico do IMEI (14–16 dígitos, sem placeholder/dica nem pré-preenchimento).
- Estado visual: idle / validando / ok (badge verde com origem `Softruck` ou `Rede Veículos`) / erro (Alert vermelho com a mensagem do caso B/C/D).
- Não tem botão próprio — a validação é disparada pelo Aprovar do pai.

### 2. `src/lib/troca-titularidade/validarImeiPorPlaca.ts` (novo)
Função pura:
```
validarImeiPorPlaca({ placa, imei, cpfTitularAntigo }) →
  { ok: true, origem: 'softruck'|'rede_veiculos', rastreadorId: string }
| { ok: false, motivo: 'imei_em_outra_placa'|'nao_encontrado'|'apis_indisponiveis', detalhes? }
```
Fluxo:
1. Sanitiza `imei` (`/^\d{14,16}$/`) e `placa`.
2. **Softruck**: `supabase.functions.invoke('softruck-api', { body: { action: 'buscar-veiculo-placa', data: { placa } } })`. Se 200 e veículo encontrado → pegar `vehicle_id` → `action: 'listar-devices-veiculo'` → procurar IMEI na lista.
   - IMEI bate → garantir upsert local chamando `softruck-buscar-dispositivo` (mantém o padrão atual de upsert) → retorna `{ ok, origem: 'softruck', rastreadorId }`.
   - IMEI presente em outra placa (retornado pela busca por placa em outras consultas) ou IMEI achado mas placa diferente → caso B com a placa concorrente.
3. **Fallback Rede Veículos** (só se Softruck deu timeout/5xx/sem veículo): `supabase.functions.invoke('rede-veiculos-obter-status-veiculo', { body: { placa } })`. Se retornar veículo, comparar `imei` retornado (e/ou validar `cpf` do titular antigo se o payload trouxer) com o digitado.
4. Se nenhuma fonte achou o IMEI → `nao_encontrado` (caso C).
5. Se ambas falharam por erro de rede/5xx → `apis_indisponiveis` (caso D).
6. Antes de retornar ok, **checar conflito local**: `rastreadores.veiculo_id` ≠ veículo atual e status `instalado` em outro veículo ativo → caso B com a placa do outro veículo (mesma lógica de `useBuscarRastreadorPorImei.checarConflito`).
7. Cada chamada externa loga `[VALIDACAO_IMEI_PLACA]` com placa, IMEI mascarado, origem e resultado.

### 3. `src/components/troca-titularidade/ModalDetalhesTroca.tsx` (editar)
- Importar o novo card e a função `validarImeiPorPlaca`.
- Estado novo: `imeiInput`, `validacaoErro`, `validando`, `validado`.
- Renderizar `ValidarImeiPorPlacaCard` **no lugar** do `VincularRastreadorExistenteCard` quando `modo === 'monitoramento' && veiculoExigeRastreador && !jaTemRastreador`. Quando `!veiculoExigeRastreador` → não renderiza (caso E).
- Substituir `precisaVinculoRastreador` por `precisaValidarImei` (mesma condição) e usar no `bloqueado` para desabilitar Aprovar enquanto `!validado`.
- Em `handleAprovar` e `handleSolicitarVistoria` (e nos itens do menu "Solicitar vistoria"), antes de chamar as mutações:
  - Se `precisaValidarImei` e ainda não validado: setar `validando=true`, chamar `validarImeiPorPlaca({ placa: veiculoCompleto.placa, imei: imeiInput, cpfTitularAntigo: veiculoCompleto.associado.cpf })`.
  - `ok=false` → setar mensagem (casos B/C/D), `toast.error`, abortar.
  - `ok=true` → seguir para a mutação atual. Após sucesso, opcionalmente disparar `softruck-ativar-dispositivo` (reuso da mesma chamada do card antigo) para registrar o vínculo lógico e invalidar `veiculo-completo`.
- O botão "Solicitar manutenção de rastreador" também passa pela validação (mesma transação única).
- O rodapé informativo amarelo passa a mostrar "Informe o IMEI instalado no veículo e clique em Aprovar para validar." quando `precisaValidarImei && !validado`.

## Mensagens de erro (literais)
- Caso B: `"IMEI {imei} está vinculado à placa {placaOutra}, não bate com a placa {placaAtual} desta cotação"`
- Caso C: `"IMEI não encontrado na Softruck nem na Rede Veículos"`
- Caso D: `"Não foi possível validar o IMEI agora. Tente novamente em alguns minutos."`
- Validação local de formato: `"IMEI inválido. Deve ter 14 a 16 dígitos numéricos."`

## Fora de escopo (não tocar)
- Regra `exigeInstalacaoTecnica` / `fn_veiculo_precisa_rastreador`.
- Edge `efetivar-troca-titularidade` e Fase 4 (Hinova, Softruck associations/users, Rede Veículos).
- `VincularRastreadorExistenteCard` (continua sendo usado em Aprovação de Associados).
- Fluxo em veículos não elegíveis.
- Sem migração de banco e sem nova edge function.

## Validação manual
1. Troca com veículo elegível + IMEI correto → Aprovar valida (badge Softruck) → mutação roda.
2. IMEI de outro veículo ativo → Aprovar bloqueia com a placa concorrente.
3. IMEI inexistente nas duas fontes → Aprovar bloqueia (caso C).
4. Softruck e Rede ambas com erro (simular via Network throttle/edge erro) → caso D.
5. Veículo não elegível → card não aparece, Aprovar funciona como hoje.
