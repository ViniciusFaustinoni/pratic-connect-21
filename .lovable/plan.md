
# Revisao: Atribuicao de Fornecedores, Cotacoes e Aprovacao

## Resultado da Verificacao

### 1. Modal de Atribuicao — OK parcial

| Item | Status |
|---|---|
| Botao "Atribuir Fornecedores" quando pronto_para_oficina | OK |
| Modal com dados do veiculo (marca, modelo, placa) | OK |
| Resumo do orcamento no topo | OK |

### 2. Secao Oficina — 2 BUGS

| Item | Status |
|---|---|
| Filtra por marca OU GLOBAL | OK |
| Filtra por status ativo | OK |
| **Filtra por especialidades compativeis com etapas** | **FALTANDO** |
| Card: nome, cidade/estado, especialidades (badges) | OK |
| Card: nota media | OK |
| **Card: endereco completo** | **FALTANDO** (so mostra cidade-estado) |
| **Card: qtd veiculos atual, tempo medio** | **FALTANDO** (colunas nao existem no DB) |
| Selecao via radio (1 oficina) | OK |
| Mensagem se nenhuma compativel | OK |

### 3. Secao Prestadores — OK

| Item | Status |
|---|---|
| Filtra por marca OU GLOBAL | OK |
| Checkboxes multiplos | OK |
| Selecao OPCIONAL | OK |
| Cards com nome, cidade, especialidades | OK |

### 4. Secao Auto Centers — 1 BUG

| Item | Status |
|---|---|
| Filtra por marca OU GLOBAL | OK |
| WhatsApp visivel | OK |
| Checkboxes multiplos | OK |
| Recomendado minimo 3 | OK (texto) |
| Preview da mensagem | OK |
| **Filtra por especialidades compativeis com tipos de peca** | **FALTANDO** |

### 5. Confirmacao — OK

| Item | Status |
|---|---|
| Botao "Confirmar Atribuicao" | OK |
| Vincula oficina a OS | OK |
| Registra prestadores | OK |
| Para cada auto center: envia WhatsApp via edge function | OK |

### 6. Mensagem de Cotacao (IA -> Auto Center) — OK

| Item | Status |
|---|---|
| Saudacao com nome | OK |
| Dados do veiculo | OK |
| Lista APENAS pecas (sem MO) | OK |
| Prazo 24h | OK |
| Referencia do evento | OK |

### 7. Aba Cotacoes Recebidas — 1 BUG

| Item | Status |
|---|---|
| Resumo dos pedidos (auto center, data, status) | OK |
| Apos 24h sem resposta: status expirado | OK |
| Botao Reenviar quando expirado | OK |
| **Botao "Registrar Cotacao Recebida"** | **BUG — so aparece quando status=enviado, deveria incluir expirado** |
| Modal com seletor de auto center | OK |
| Para cada peca: descricao (readonly), qtd (readonly), valor, prazo, disponibilidade | OK |
| Total calculado automaticamente | OK |
| Observacoes e prazo geral | OK |

### 8. Comparativo de Cotacoes — OK

| Item | Status |
|---|---|
| Com 2+ cotacoes: comparativo lado a lado | OK |
| Cada peca x cada auto center | OK |
| Total por auto center no rodape | OK |
| Menor preco em verde | OK |
| Indisponiveis em vermelho | OK |

### 9. Aprovacao de Cotacao — OK

| Item | Status |
|---|---|
| Botao "Aprovar esta Cotacao" em cada card | OK |
| APENAS 1 aprovada por evento | OK |
| Modal de confirmacao irreversivel | OK |
| Aprovada: badge verde, imutavel | OK |
| Demais: badge cinza "nao selecionada" | OK |
| Aprovada em destaque no topo | OK |
| Gera OS automaticamente (edge function gerar-os-cotacao-aprovada) | OK |
| WhatsApp ao associado confirmando pecas | OK |

---

## 4 Correcoes Necessarias

### Correcao 1 — Filtrar oficinas por especialidades compativeis (AtribuirFornecedoresDialog.tsx)

**Problema:** O modal busca oficinas filtrando apenas por marca, sem considerar se a oficina tem especialidades compativeis com as etapas de reparo do orcamento.

**Correcao:** Adicionar filtragem client-side (pos-query) das oficinas, mantendo apenas as que possuem pelo menos 1 especialidade em comum com as etapas de reparo. Exemplo: se as etapas incluem "Funilaria / Lanternagem" e "Pintura Automotiva", so exibir oficinas que tenham pelo menos uma dessas especialidades.

Adicionar um `useMemo` apos a query de oficinas:

```text
const oficinasCompativeis = useMemo(() => {
  if (!oficinas || etapasReparo.length === 0) return oficinas || [];
  return oficinas.filter((o: any) => {
    if (!o.especialidades?.length) return false;
    return etapasReparo.some((etapa: string) =>
      o.especialidades.some((esp: string) =>
        esp.toLowerCase().includes(etapa.toLowerCase()) ||
        etapa.toLowerCase().includes(esp.toLowerCase())
      )
    );
  });
}, [oficinas, etapasReparo]);
```

Usar `oficinasCompativeis` no lugar de `oficinas` no render.

### Correcao 2 — Filtrar auto centers por especialidades compativeis com tipos de peca (AtribuirFornecedoresDialog.tsx)

**Problema:** Auto centers sao filtrados apenas por marca. Se o orcamento tem pecas de "Vidros e Farois", auto centers sem essa especialidade nao deveriam aparecer (ou pelo menos as compativeis deveriam ter destaque).

**Correcao:** Como auto centers vendem pecas diversas e a filtragem rigida poderia excluir fornecedores uteis, a abordagem mais pratica e: manter todos visiveis mas **ordenar** os compativeis por especialidade primeiro, e adicionar um badge "Compativel" nos que tem match.

### Correcao 3 — Botao "Registrar Cotacao" tambem para expiradas (CotacoesRecebidasTab.tsx)

**Problema:** Linha 62: `const temPendentes = cotacoesComStatus.some((c) => c.status === 'enviado')`. O botao "Registrar Cotacao Recebida" so aparece se ha cotacoes com status `enviado`. Quando todas expiram, o botao desaparece, impedindo o registro de respostas tardias.

**Correcao:** Alterar para incluir tambem `expirado`:

```text
const temRegistraveis = cotacoesComStatus.some(
  (c) => (c.status === 'enviado' || c.status === 'expirado') && !c.aprovada
);
```

E no `RegistrarCotacaoDialog`, linha 99, alterar o filtro de `pendentes` para incluir expiradas:

```text
const pendentes = cotacoesEnviadas.filter((c) => c.status === 'enviado' || c.status === 'expirado');
```

### Correcao 4 — Exibir endereco completo nos cards de oficina (AtribuirFornecedoresDialog.tsx)

**Problema:** Os cards de oficina mostram apenas cidade-estado (linha 335). Falta logradouro, numero e bairro para o operador avaliar a proximidade.

**Correcao:** Alterar a linha 334-336 para exibir endereco mais completo:

```text
<p className="text-sm text-muted-foreground">
  {[oficina.logradouro, oficina.numero, oficina.bairro].filter(Boolean).join(', ')}
  {oficina.cidade && ` — ${oficina.cidade}`}
  {oficina.estado && `/${oficina.estado}`}
</p>
```

**Nota sobre "qtd veiculos atual" e "tempo medio":** Estes campos nao existem na tabela `oficinas` do banco de dados. Adiciona-los requer: (1) criar colunas ou views calculadas, (2) logica de atualizacao baseada em OS ativas. Como a instrucao e "NAO crie nada novo", esses campos serao omitidos nesta correcao. Podem ser adicionados em uma iteracao futura quando o modulo de OS tiver maturidade suficiente para calcular essas metricas.

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/sinistros/AtribuirFornecedoresDialog.tsx` — filtro especialidades oficinas, ordenacao auto centers, endereco completo |
| Modificar | `src/components/sinistros/CotacoesRecebidasTab.tsx` — botao registrar para expiradas |
| Modificar | `src/components/sinistros/RegistrarCotacaoDialog.tsx` — filtro inclui expiradas |
