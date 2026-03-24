

# Limitar datas de agendamento de instalação pelo prazo do estado

## Resumo

Atualmente o agendamento de instalação exibe sempre 7 dias disponíveis, independente do estado. O correto é limitar as datas ao prazo configurado por estado (ex: RJ = 48h = ~2 dias uteis, SP = 72h = ~3 dias uteis). O componente deve ler o estado informado no endereço e buscar o prazo na tabela `configuracoes` (chave `instalacao_prazos_por_estado`).

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/components/associado/AgendamentoInstalacaoContrato.tsx` | **Editar** |

## Detalhes

1. Adicionar query ao Supabase para buscar a configuração `instalacao_prazos_por_estado` (JSON com array `[{estado, prazo_horas}]`).

2. Quando o associado preencher o CEP e o campo `estado` for preenchido automaticamente, calcular quantos dias uteis correspondem ao prazo daquele estado (48h = 2 dias, 72h = 3 dias, etc). Fallback: 48h se o estado nao estiver configurado.

3. Gerar `datasDisponiveis` dinamicamente com base nesse calculo, em vez do fixo `7`. As datas devem comecar a partir de amanha e respeitar o limite do prazo (ex: para 48h, mostrar ate 2 dias uteis; para 72h, ate 3 dias uteis).

4. Se o estado ainda nao foi preenchido, mostrar uma mensagem orientando o associado a preencher o endereco primeiro, antes de selecionar a data. A secao de datas fica desabilitada ate o endereco estar completo.

5. Reordenar o formulario: **Endereco primeiro, depois Data/Horario**, para que o prazo esteja calculado antes da selecao de data.

