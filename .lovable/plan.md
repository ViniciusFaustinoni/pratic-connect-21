

# Plano: Registro de Resultado da Visita Técnica (MAN-4)

## Banco de dados

Adicionar colunas em `manutencao_tratativas` para persistir o resultado:

- `visita_data_hora` (timestamptz) — data/hora real da visita
- `visita_tecnico_id` (uuid, FK profiles) — técnico que compareceu
- `visita_resultado` (text) — enum: rastreador_trocado, fiacao_reparada, chip_substituido, violacao_corrigida, sem_problema_rastreador, resolvido_remotamente
- `visita_descricao` (text) — descrição técnica
- `rastreador_trocado` (boolean, default false) — toggle troca
- `imei_novo` (text) — IMEI do novo equipamento
- `imei_retirado` (text) — IMEI do retirado
- `voltou_pontuar` (text) — 'sim', 'nao', 'aguardando'

Atualizar CHECK constraint de `status` para incluir `visita_realizada` e `acompanhamento`.

## Hook `useTratativaDrawer.ts`

Nova mutation `registrarVisita`:
1. Atualiza `manutencao_tratativas` com todos os campos da visita
2. Atualiza `servicos` correspondente (via `servico_id`) para `status = 'concluido'`
3. Insere log com ação `visita_realizada` e dados resumidos
4. Define status: `voltou_pontuar === 'sim'` → `visita_realizada`, senão → `acompanhamento`

Nova mutation `abrirNovaTratativa`:
1. Cria nova tratativa para o mesmo veículo/associado com status `aguardando_contato`
2. Toast + invalidar queries

## Componente `ResultadoVisitaForm.tsx` (novo)

Formulário com:
- DateTimePicker (data/hora da visita, default agora)
- Select técnico (pré-preenchido do agendado, editável, + "Não identificado")
- Select resultado (6 opções)
- Textarea descrição técnica (obrigatório)
- Toggle troca de rastreador → campos IMEI novo/retirado
- Card amarelo taxa R$ 50,00 com toggle + campo motivo condicional
- 3 botões exclusivos "Voltou a pontuar?" (Sim/Não/Aguardando)
- Botão "Encerrar manutenção" — desabilitado até obrigatórios preenchidos

## Componente `CardEncerramentoVisita.tsx` (novo)

Card pós-registro:
- Fundo verde se `voltou_pontuar = sim`, laranja se não/aguardando
- Resumo: data, técnico, resultado, descrição (120 chars), IMEI se trocou, taxa se aplicada
- Botão "Abrir nova tratativa" no card laranja

## Integração no `TratativaDrawer.tsx`

Lógica condicional após o card de confirmação do agendamento:
- Se `status === 'agendado'` e `temServico` e `!visita_resultado` → mostrar `ResultadoVisitaForm`
- Se `status in ('visita_realizada', 'acompanhamento')` → mostrar `CardEncerramentoVisita`

Modo leitura: quando status é final, todo o drawer fica read-only (etapas colapsadas em timeline, sem formulários editáveis).

## Integração no `ManutencaoRastreadoresTab.tsx`

- Botão "Registrar visita" ao lado de "Continuar tratativa" para status `agendado` com `servico_id`
- Novos status no `statusConfig`: `acompanhamento` (laranja) e atualizar `visita_realizada` (verde "Concluído")
- Novos filtros no Select: "Concluído" e "Acompanhamento"
- Ao clicar "Registrar visita": abre drawer e rola até a seção resultado

## Arquivos

- **Criado**: migration SQL (colunas + CHECK)
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/ResultadoVisitaForm.tsx`
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/CardEncerramentoVisita.tsx`
- **Modificado**: `src/hooks/useTratativaDrawer.ts`
- **Modificado**: `src/components/monitoramento/manutencao-rastreadores/TratativaDrawer.tsx`
- **Modificado**: `src/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab.tsx`

