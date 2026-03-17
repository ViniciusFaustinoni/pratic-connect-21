

## Plano: Ficha do associado com condições dinâmicas de "Regras de Venda"

### Contexto atual

- A ficha do associado (`AssociadoDetalhe.tsx`) tem 6 abas (Resumo, Dados, Veículos, Documentos, Financeiro, Histórico, WhatsApp) mas **não exibe** carência, situação de inadimplência detalhada, coberturas suspensas, multa de rastreador dinâmica, nem pontuação do consultor vinculado.
- A tabela `associados` não tem colunas para `tipo_entrada`, `data_carencia_inicio`, `data_carencia_fim`, nem `config_snapshot`.
- A tabela `contratos` tem `tipo_venda` (ex: `nova`) e `tipo_atendimento` (ex: `volante`) mas não tem `tipo_entrada` (migração, reativação, etc).
- Hooks existentes: `useCarenciaDiasPadrao`, `useMigracaoConfig`, `usePrazoReativacaoDias`, `useMultaRastreador` — todos lendo de configurações dinâmicas.
- O conceito de "snapshot de configuração no momento do registro" não existe ainda.

### Alterações necessárias

#### 1. Migration: Novas colunas em `contratos` e nova tabela `operacao_config_snapshot`

**contratos** — adicionar:
- `tipo_entrada` varchar (nova, migracao, reativacao, troca_titularidade, substituicao)
- `data_carencia_inicio` date
- `data_carencia_fim` date  
- `carencia_isenta` boolean default false
- `carencia_motivo_isencao` text

**Nova tabela `operacao_config_snapshot`** — armazena snapshot das configurações aplicadas no momento do registro:
- `id` uuid PK
- `contrato_id` uuid FK contratos
- `associado_id` uuid FK associados
- `tipo_operacao` varchar (adesao, reativacao, migracao, etc)
- `config_data` jsonb (snapshot completo das regras vigentes)
- `created_at` timestamptz

Isso garante que operações já registradas mantêm os valores vigentes no momento.

#### 2. Novo componente: `AssociadoSituacaoCard.tsx`

Card dedicado para a aba Resumo exibindo:

**Carência:**
- Se `contrato.carencia_isenta` → "Isento de carência (migração aprovada)"
- Senão → Início/Fim da carência, com badge "Em carência" ou "Carência concluída"
- Se reativação: verifica `prazo_reativacao_dias` vs dias de inadimplência para determinar se nova carência foi aplicada

**Inadimplência:**
- Calcula dias de atraso com base em `cobrancasData`
- Compara com prazos configurados (usar `comissoes_parametros`): 
  - Dentro do prazo sem revistoria → "Inadimplente - regularização simples"
  - Acima do prazo de revistoria → "Inadimplente - revistoria necessária"  
  - Acima do prazo máximo → "Inadimplente - nova adesão obrigatória"
- Esses prazos serão lidos de `comissoes_parametros` (novas chaves: `inadimplencia_prazo_sem_revistoria`, `inadimplencia_prazo_revistoria`, `inadimplencia_prazo_nova_adesao`)

**Coberturas:**
- Se inadimplente → exibir badges "Suspensa" em cada cobertura
- Se ativo → exibir coberturas com status normal

**Multa rastreador:**
- Se `associado.pendencia_rastreador` → exibir valor da multa via `useMultaRastreador()` (dinâmico)

**Consultor vinculado:**
- Buscar `vendedor_original_id` do associado + `pontuacao_eventos` do contrato
- Exibir nome do consultor e pontuação gerada nessa operação

#### 3. Novos hooks

**`useConteudosSistema.ts`** — adicionar:
- `useInadimplenciaPrazos()` → lê 3 chaves de `comissoes_parametros` (prazo sem revistoria, revistoria, nova adesão)

**`useAssociadoSituacao.ts`** — novo hook que agrega:
- Dados de carência do contrato
- Cálculo de inadimplência vs prazos configurados
- Status das coberturas (ativo/suspenso)
- Pontuação do consultor vinculado

#### 4. Inserir novas chaves em `comissoes_parametros`

| Chave | Valor | Descrição |
|---|---|---|
| `inadimplencia_prazo_sem_revistoria` | `30` | Dias de atraso sem necessidade de revistoria |
| `inadimplencia_prazo_revistoria` | `90` | Dias de atraso que exigem revistoria |
| `inadimplencia_prazo_nova_adesao` | `180` | Dias de atraso que exigem nova adesão completa |

#### 5. Integrar card na ficha

- Inserir `AssociadoSituacaoCard` na aba "Resumo" (entre métricas e grid de info)
- Atualizar `AssociadoResumoTab` para receber e exibir o novo card

#### 6. Salvar snapshot na criação de contrato

- Alterar o fluxo de criação de contrato (edge functions e hooks existentes) para:
  1. Buscar configurações vigentes
  2. Calcular e salvar `data_carencia_inicio`, `data_carencia_fim`, `carencia_isenta`
  3. Inserir registro em `operacao_config_snapshot` com JSON das regras aplicadas

### Resumo de arquivos

| Arquivo | Alteração |
|---|---|
| Migration SQL | +colunas em `contratos`, +tabela `operacao_config_snapshot`, +chaves em `comissoes_parametros` |
| `src/components/associados/detalhe/AssociadoSituacaoCard.tsx` | Novo componente |
| `src/hooks/useConteudosSistema.ts` | +`useInadimplenciaPrazos()` |
| `src/hooks/useAssociadoSituacao.ts` | Novo hook agregador |
| `src/components/associados/detalhe/AssociadoResumoTab.tsx` | Integrar `AssociadoSituacaoCard` |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Passar dados ao ResumoTab |
| `src/hooks/useMinhasCoberturasApp.ts` | Ler inadimplência para suspender coberturas no app |

