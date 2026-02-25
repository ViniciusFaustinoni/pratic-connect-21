

# Alterar Trajeto: de "4h antes do evento" para "1h antes da comunicacao"

## Resumo

Substituir a referencia temporal do trajeto exibido ao analista. Em vez de mostrar o percurso do veiculo nas 4 horas anteriores a data da ocorrencia (`data_ocorrencia`), mostrar o percurso de 1 hora antes da comunicacao ate o momento da comunicacao (`etapa1_completada_em` do link do evento).

## Logica

- **Antes**: `dataRef = sinistro.data_ocorrencia`, janela = 4h antes
- **Depois**: `dataRef = link.etapa1_completada_em` (momento em que o associado completou a comunicacao), janela = 1h antes
- Se `etapa1_completada_em` nao existir (comunicacao ainda nao concluida), usar `link.created_at` como fallback

## Alteracoes

### 1. `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Alterar o bloco do trajeto (linhas 279-291):

- Titulo: de "Trajeto do Veiculo (4h antes)" para "Trajeto do Veiculo (1h antes da comunicacao)"
- Props do `TrajetoLocalCard`:
  - `dataOcorrencia` passa a receber `link?.etapa1_completada_em || link?.created_at || sinistro.data_ocorrencia`
  - `horasAnteriores` muda de `4` para `1`

### 2. `src/pages/eventos/SinistroAnalise.tsx`

Alterar o bloco do trajeto (linhas 897-911):

- Titulo: de "Trajeto do Veiculo (4h antes)" para "Trajeto do Veiculo (1h antes da comunicacao)"
- Props do `TrajetoLocalCard`:
  - `dataOcorrencia` passa a receber `linkEvento?.etapa1_completada_em || linkEvento?.created_at || sinistro.data_ocorrencia`
  - `horasAnteriores` muda de `4` para `1`

### 3. `src/components/sinistros/TrajetoLocalCard.tsx`

Alterar a mensagem de fallback (linha 140):

- De "Sem dados de posicao nas ultimas {horasAnteriores}h antes do evento"
- Para "Sem dados de posicao na 1h anterior a comunicacao do evento"

Nenhuma alteracao estrutural no componente -- ele ja suporta `dataOcorrencia` como data de referencia e `horasAnteriores` como janela.

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Titulo + props do TrajetoLocalCard |
| `src/pages/eventos/SinistroAnalise.tsx` | Titulo + props do TrajetoLocalCard |
| `src/components/sinistros/TrajetoLocalCard.tsx` | Mensagem de fallback |

