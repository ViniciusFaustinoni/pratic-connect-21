## Diagnóstico

O fluxo solicitado **já existe parcialmente** — vou listar o que está pronto e exatamente o que falta:

### Já existe (não vou recriar)
- **Cron de suspensão automática**: `cron-suspender-cobertura-autovistoria-hourly` rodando todo minuto 7 de cada hora, chama `cron-suspender-cobertura-inativacao`, que suspende cobertura de qualquer contrato assinado/ativo cuja instalação não foi concluída no prazo.
- **Configuração editável** pela diretoria: já há a chave `prazo_instalacao_autovistoria_horas` (default 72h) na categoria `operacional`, e a tela `Diretoria > Configurações > Operacional` (`src/pages/diretoria/Configuracoes.tsx`) já renderiza qualquer chave dessa categoria automaticamente.
- **Reativação automática pós-instalação**: trigger `trg_reativar_cobertura_pos_instalacao` em `servicos` já devolve `cobertura_total/roubo_furto = true` quando o serviço de instalação fecha como `concluida`.
- **Notificação WhatsApp** para o associado quando suspenso.

### Problemas encontrados (causa raiz)

1. **Duplicação de chaves de configuração** (risco de divergência): existem hoje na tabela `configuracoes`:
   - `prazo_instalacao_autovistoria_horas` = 72 (usada pelo cron)
   - `operacional_prazo_instalacao` = 72 (aparece na UI da diretoria mas ninguém lê)
   
   Quem editar pela tela hoje muda a chave errada.

2. **Não há prazo por UF**: hoje é um número global. Precisa ser RJ=48h, SP=72h, e um default para o resto.

3. **Não há botão de fallback** para o Analista de Monitoramento ou Coordenador marcar manualmente "suspenso por não-instalação". O `SuspenderVeiculoDialog` existente é genérico (cancelamento/venda/férias) e grava motivo fora do padrão que o trigger e o wizard de reativação reconhecem.

4. **Wizard de Reativação cai no caminho errado** (a tela do print): quando o associado tem `dias === 0` mas o `cobertura_suspensa_motivo` não casa exatamente com a regex de detecção, ele cai em "Pagamento Simples". A regra precisa priorizar suspensão por instalação sempre que `cobertura_suspensa=true` e não existir instalação concluída.

## Plano de correção (sem rotas alternativas)

### 1. Consolidar a chave de configuração (1 SQL)

- Migrar valor de `operacional_prazo_instalacao` para `prazo_instalacao_autovistoria_horas` (caso difiram) e **remover** `operacional_prazo_instalacao`.
- Renomear visualmente: descrição da chave canônica fica "Prazo padrão de instalação após assinatura (horas)".

### 2. Prazo por região

Adicionar duas chaves novas em `configuracoes` (categoria `operacional`), editáveis pela mesma tela da diretoria sem mudar uma linha de UI:

| Chave | Valor inicial | Descrição |
|---|---|---|
| `prazo_instalacao_horas_rj` | 48 | Prazo (h) para associados com UF = RJ |
| `prazo_instalacao_horas_sp` | 72 | Prazo (h) para associados com UF = SP |
| `prazo_instalacao_autovistoria_horas` | 72 | Prazo padrão (h) para demais UFs |

A função `cron-suspender-cobertura-inativacao` passa a:
- Carregar as 3 chaves uma vez no início.
- Para cada contrato candidato, ler `associados.cliente_uf` (ou via join com `associados`) e escolher o prazo adequado (RJ→48, SP→72, demais→default).
- O `limite` deixa de ser único: passa a ser calculado por contrato. Implementação simples: buscar contratos `data_assinatura <= now() - menor_prazo` e dentro do loop comparar com o prazo específico daquela UF.
- Mensagem WhatsApp inclui o prazo correto aplicado.

### 3. Botão de fallback manual na ficha do associado

Em `src/pages/cadastro/AssociadoDetalhe.tsx`, dentro do bloco de status do veículo, adicionar botão **"Suspender por não instalação"** que:
- Aparece **apenas para perfis** Analista de Monitoramento, Coordenador de Monitoramento e Diretoria.
- Aparece **apenas quando** o veículo está em estado consistente para isso: contrato assinado/ativo, sem instalação concluída/dispensada, e `veiculos.cobertura_suspensa = false`.
- Abre diálogo curto pedindo motivo (texto opcional) e ao confirmar chama nova edge function `suspender-cobertura-instalacao-manual` (espelha exatamente o cron, mas para 1 contrato e registra `usuario_id` no log).
- A edge function grava `cobertura_suspensa_motivo` no **mesmo formato canônico** do cron (`Instalação não realizada no prazo de Xh após assinatura`) para o trigger de reativação automática e o wizard reconhecerem.

### 4. Wizard de Reativação — corrigir detecção do caminho

Em `src/components/associados/reativacao/ReativacaoWizard.tsx`:
- A query `suspensaoInstalacao` ganha um fallback: se `cobertura_suspensa = true` e **não existe instalação concluída/dispensada** para o contrato, considera caminho 4, mesmo que o motivo gravado esteja fora do padrão.
- A escolha do `caminho` passa a priorizar `4` sobre `1/2/3` quando há suspensão por instalação, independente de dívida (porque pagar boleto não devolve cobertura suspensa por não-instalação — só a instalação devolve).
- Mantém as mensagens existentes; só corrige a árvore de decisão.

### 5. Auditoria

- Tanto o cron existente quanto a nova função manual passam a inserir em `associados_historico` (tipo `suspensao_cobertura_instalacao`) com operador, prazo aplicado, UF e motivo. Hoje o cron só faz `console.log`.

## Arquivos afetados

**Migração SQL (1 arquivo):**
- Inserir `prazo_instalacao_horas_rj` e `prazo_instalacao_horas_sp`.
- Migrar e remover `operacional_prazo_instalacao` (consolidação).

**Edge functions:**
- `supabase/functions/cron-suspender-cobertura-inativacao/index.ts` — passar a usar prazo por UF + gravar histórico.
- `supabase/functions/suspender-cobertura-instalacao-manual/index.ts` (novo) — versão chamada manualmente pelo analista, com validação de role, mesmo update do cron, mesmo formato de motivo, mesmo WhatsApp.

**Frontend:**
- `src/pages/cadastro/AssociadoDetalhe.tsx` — novo botão condicionado a role + estado.
- `src/components/veiculos/SuspenderPorNaoInstalacaoDialog.tsx` (novo, pequeno) — diálogo de confirmação + motivo.
- `src/hooks/useSuspenderPorNaoInstalacao.ts` (novo) — chama a edge function.
- `src/components/associados/reativacao/ReativacaoWizard.tsx` — fallback de detecção do caminho 4.

## Sem mudanças invasivas

- Nenhuma coluna nova em `veiculos` ou `contratos`.
- Trigger existente `trg_reativar_cobertura_pos_instalacao` continua sendo a única forma de devolver a cobertura → "a proteção só volta mediante a instalação do rastreador" já é regra de banco.
- UI de configuração da diretoria não muda — as novas chaves aparecem automaticamente na aba "Operacional".

## Memória a atualizar (`mem://logic/operations/suspensao-cobertura-48h`)

- Prazo agora é por UF: RJ 48h, SP 72h, demais via `prazo_instalacao_autovistoria_horas`.
- Chave canônica é `prazo_instalacao_autovistoria_horas` (a `operacional_prazo_instalacao` foi removida).
- Existe fallback manual via edge function `suspender-cobertura-instalacao-manual` para Analista/Coordenador de Monitoramento e Diretoria.
- Reativação só pela instalação concluída (trigger).

## Como o usuário verá depois

- **Diretor**: na aba `Diretoria > Configurações > Operacional` aparecem 3 campos de prazo (RJ, SP, padrão), todos editáveis.
- **Cron**: continua rodando de hora em hora, agora respeitando o prazo da UF do associado.
- **Analista/Coordenador de Monitoramento**: ao abrir a ficha de um associado cuja instalação venceu o prazo mas o cron ainda não pegou (ou foi marcado como não instalado por outro motivo), aparece o botão **"Suspender por não instalação"** que faz exatamente o mesmo efeito do automático.
- **Associado com cobertura suspensa por não-instalação**: o wizard de reativação sempre cai no Caminho 4 ("Liberar Reagendamento"), mesmo com 0 dias de dívida ou motivo fora do padrão antigo.
- **Quando a instalação é concluída**: o trigger atual devolve a cobertura automaticamente, sem nenhum passo manual extra.