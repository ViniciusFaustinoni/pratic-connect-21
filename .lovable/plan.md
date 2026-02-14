
# Fluxo Simplificado de Vidros e Farois

## Contexto Atual

O tipo "vidros" ja existe como opcao no registro de sinistro, mas segue exatamente o mesmo fluxo generico de colisao. Nao existe nenhuma logica especifica: sem validacao de carencia, sem verificacao de beneficio contratado, sem selecao de peca, sem limite de utilizacao, sem opcao de reembolso.

### O que ja existe no banco:
- Cobertura `COB-VID` na tabela `coberturas` (carencia_dias = 15, precisa atualizar para 120)
- Campo `data_adesao` na tabela `associados` (para calcular carencia)
- Tabela `planos_coberturas` (estrutura existe, mas sem dados vinculando planos a coberturas)
- Tabela `sinistros` -- SEM campos para peca danificada ou opcao de reparo

### O que falta:
- Campos na tabela `sinistros` para dados especificos de vidros
- Nova tabela para controlar historico de utilizacao por peca
- Validacoes automaticas no registro (carencia, limite, beneficio)
- Selecao de peca danificada com lista fixa
- Fluxo simplificado de documentacao (2 etapas)
- Logica de reparo com 2 opcoes (via Pratic 60/40 ou reembolso)
- Analise simplificada sem vistoria presencial

---

## Alteracoes no Banco de Dados

### Migracoes SQL

**1. Adicionar campos especificos de vidros na tabela `sinistros`:**

```sql
ALTER TABLE sinistros 
  ADD COLUMN peca_danificada TEXT,
  ADD COLUMN opcao_reparo TEXT CHECK (opcao_reparo IN ('via_pratic', 'reembolso')),
  ADD COLUMN valor_reembolso NUMERIC,
  ADD COLUMN nf_reembolso_url TEXT;
```

- `peca_danificada`: qual peca da lista fixa (para-brisa, farol_esquerdo, etc.)
- `opcao_reparo`: se o reparo sera via auto center credenciado ou reembolso
- `valor_reembolso`: valor solicitado de reembolso (60% do total)
- `nf_reembolso_url`: URL da nota fiscal DANFE para reembolso

**2. Criar tabela de historico de utilizacao de vidros:**

```sql
CREATE TABLE sinistro_vidros_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id),
  peca TEXT NOT NULL,
  data_utilizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Essa tabela permite verificar se uma peca especifica ja foi utilizada nos ultimos 12 meses.

**3. Atualizar carencia da cobertura COB-VID para 120 dias:**

```sql
UPDATE coberturas SET carencia_dias = 120 WHERE codigo = 'COB-VID';
```

---

## Alteracoes em Codigo

### 1. NovoSinistroModal.tsx -- Validacoes e campos especificos

Quando o tipo selecionado for `vidros`, o modal deve:

**Antes de permitir o submit (validacoes automaticas):**

- **Carencia 120 dias**: Buscar `data_adesao` do associado e calcular se tem 120+ dias. Se nao, exibir mensagem com a data de liberacao.
- **Beneficio contratado**: Verificar se o plano do associado inclui a cobertura `COB-VID` na tabela `planos_coberturas`. Se nao tem, bloquear com mensagem.
- **Limite 12 meses por peca**: Consultar `sinistro_vidros_historico` para a peca selecionada nos ultimos 12 meses. Se ja foi acionada, bloquear apenas aquela peca.

**Campos adicionais no formulario (apenas para tipo vidros):**

- Seletor de peca danificada (lista fixa com 14 opcoes)
- Opcao de reparo: "Via Pratic" ou "Reembolso"
- Ocultar toggle de reboque (nao se aplica)
- Descricao minima reduzida (20 caracteres em vez de 50)

**No insert do sinistro:**

- Salvar `peca_danificada` e `opcao_reparo`
- Apos sucesso, inserir registro em `sinistro_vidros_historico`

**Lista fixa de pecas:**

```
- Para-brisa
- Vidro vigia (traseiro)
- Vidro lateral dianteiro esquerdo
- Vidro lateral dianteiro direito
- Vidro lateral traseiro esquerdo
- Vidro lateral traseiro direito
- Vidro fixo lateral esquerdo
- Vidro fixo lateral direito
- Farol esquerdo
- Farol direito
- Lanterna esquerda
- Lanterna direita
- Espelho retrovisor esquerdo
- Espelho retrovisor direito
```

### 2. EventoLinkCard.tsx -- Etapas simplificadas para vidros

Para tipo `vidros`, as etapas do link devem ser apenas 2:
- Etapa 1: Fotos do dano (2-5 fotos)
- Etapa 2: Relato simples

Sem B.O. obrigatorio, sem agendamento de vistoria.

### 3. SinistroDetalhe.tsx -- Card de detalhes de vidros

Adicionar um card especifico para sinistros de vidros mostrando:
- Peca danificada
- Opcao de reparo escolhida (via Pratic ou reembolso)
- Custo dividido: 60% Pratic / 40% associado
- Se reembolso: campo para upload de NF e valor
- Status da NF (pendente/aprovada)

### 4. Novo componente: CardVidrosDetalhe.tsx

Card lateral no detalhe do sinistro que exibe:
- Peca danificada selecionada
- Opcao de reparo
- Calculo 60/40 (quando houver valor)
- Para "via Pratic": botao para acionar auto center (filtrando por especialidade "Vidros")
- Para "reembolso": upload de NF DANFE + campo valor + botao aprovar reembolso
- Observacoes sobre pecas especificas (farois: so a peca, sem instalacao; retrovisores: so o espelho)

### 5. DOCUMENTOS_OBRIGATORIOS -- Atualizar para vidros

Reduzir documentos para vidros:
```
vidros: [
  { tipo: 'foto_dano', nome: 'Fotos do Dano (2-5)', obrigatorio: true },
  { tipo: 'relato', nome: 'Relato do Ocorrido', obrigatorio: true },
  { tipo: 'bo', nome: 'Boletim de Ocorrencia', obrigatorio: false },  // so se tentativa de furto
  { tipo: 'nf_danfe', nome: 'Nota Fiscal DANFE', obrigatorio: false },  // so para reembolso
]
```

---

## Resumo dos Arquivos

| Acao | Arquivo |
|---|---|
| Migracoes | Adicionar colunas em `sinistros` + criar `sinistro_vidros_historico` + atualizar `coberturas` |
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` (validacoes + campos vidros) |
| Modificar | `src/components/eventos/EventoLinkCard.tsx` (etapas simplificadas) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (incluir CardVidrosDetalhe) |
| Criar | `src/components/sinistros/CardVidrosDetalhe.tsx` (card lateral com logica 60/40) |

## Ordem de Implementacao

1. Migracoes SQL (colunas + tabela historico + atualizar carencia)
2. NovoSinistroModal -- validacoes automaticas + seletor de peca + opcao de reparo
3. EventoLinkCard -- etapas simplificadas para vidros
4. CardVidrosDetalhe -- componente novo com logica 60/40 e acoes
5. SinistroDetalhe -- integrar o CardVidrosDetalhe na coluna lateral
