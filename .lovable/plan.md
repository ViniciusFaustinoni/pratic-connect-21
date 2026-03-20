

# Plano: Completar Caminho 3 da Reativação — Contrato + Carência de Vidros

## Estado Atual

O `ReativacaoWizard.tsx` tem o Caminho 3 funcional nas etapas visuais, mas no `handleFinalizar`:
- **Grava** histórico em `associados_historico` com `caminho: 3`
- **Grava** pontuação do consultor via `pontuacao_eventos`
- **Chama** `reativarAssociado(associadoId)` que apenas muda status para `ativo`
- **NÃO** atualiza o contrato com `tipo_entrada: 'reativacao'`
- **NÃO** recalcula carência de vidros e faróis
- **NÃO** recalcula carência geral

O `reativarAssociado` em `useAssociados.ts` é genérico — muda status e ativa na Rede Veículos. Não toca no contrato.

A `OrigemCadastroCard` já busca dados de reativação do histórico e exibe caminho/dias, mas depende de `tipo_entrada` do contrato ser `'reativacao'` para entrar nesse bloco.

---

## Implementação

### 1. Atualizar contrato no Caminho 3 (`ReativacaoWizard.tsx`)

Dentro de `handleFinalizar`, quando `caminho === 3`, após o insert no histórico e antes de chamar `reativarAssociado`:

- Se `contratoId` existe, fazer UPDATE no contrato:
  ```
  tipo_entrada: 'reativacao'
  data_carencia_inicio: hoje
  data_carencia_fim: hoje + carencia_dias_padrao
  data_carencia_vidros_inicio: hoje
  data_carencia_vidros_fim: hoje + carencia_beneficio_vidros_dias
  carencia_vidros_isenta: false
  carencia_vidros_motivo_isencao: null
  carencia_isenta: false
  carencia_motivo_isencao: null
  ```
- Se `contratoId` não existe (caso raro), criar novo contrato com `tipo_entrada: 'reativacao'` vinculado ao `associadoId`

Ambos os prazos (geral e vidros) lidos da tabela `configuracoes` no momento da finalização.

O `vendedor_id` do contrato será atualizado com o usuário logado (auth.uid), representando o consultor que processou a reativação. Se não houver consultor vinculado, o campo não é alterado.

### 2. Ler configurações no wizard

Adicionar no componente os hooks:
- `useCarenciaDiasPadrao()` (já existe em `useConteudosSistema.ts`)
- `useCarenciaVidrosDias()` (já existe em `useConteudosSistema.ts`)

Usar os valores retornados para calcular as datas no momento do UPDATE.

### 3. Registrar consultor responsável

Buscar `user.id` via `useAuth()` e gravar como `vendedor_id` no contrato atualizado, se disponível.

### 4. OrigemCadastroCard — incluir carência de vidros na seção de reativação

Atualmente a seção de reativação mostra `novaCarencia` com as datas gerais. Adicionar exibição das datas de carência de vidros (`data_carencia_vidros_inicio`, `data_carencia_vidros_fim`, `carencia_vidros_isenta`) quando o caminho é 3/nova_adesao.

---

## Arquivos afetados

- `src/components/associados/reativacao/ReativacaoWizard.tsx` — UPDATE no contrato com tipo_entrada, carência geral e vidros
- `src/components/associados/detalhe/OrigemCadastroCard.tsx` — exibir carência de vidros na seção reativação

## Resultado

- Contrato fica com `tipo_entrada = 'reativacao'` após Caminho 3
- Carência geral e de vidros recalculadas a partir da data de conclusão
- Ficha do associado exibe "Reativação — Nova adesão completa" com datas de carência de vidros
- Consultor responsável registrado no contrato
- Valores de carência sempre lidos da configuração, nunca hardcoded

