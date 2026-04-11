

## Plano: Melhorar Layout Visual do Laudo de Vistoria PDF

### Contexto
O PDF atual ja contem cabecalho, dados do associado/veiculo/vistoriador e fotos por categoria, porem com layout basico (texto simples, fotos em coluna unica de 350px). O objetivo e tornar o documento mais profissional e visual.

### Alteracoes em `supabase/functions/gerar-laudo-vistoria/index.ts`

**1. Cabecalho visual com faixa colorida**
- Faixa azul no topo com titulo "LAUDO DE VISTORIA VEICULAR" em branco
- Subtitulo "PRATICCAR Protecao Veicular" abaixo
- Protocolo e data na mesma faixa, alinhados a direita

**2. Secoes de dados em cards com fundo e bordas**
- Cada secao (Associado, Veiculo, Vistoria) dentro de um retangulo com fundo cinza claro e borda
- Labels em negrito e valores em fonte normal, organizados em 2 colunas lado a lado
- Icone simulado (quadrado colorido) antes do titulo de cada secao

**3. Grid de fotos em 2 colunas**
- Alterar `COLS` de 1 para 2
- Reduzir `IMG_WIDTH` para ~240px e `IMG_HEIGHT` para ~170px
- Isso permite 2 fotos por linha, aproveitando melhor o espaco e cabendo mais fotos por pagina
- Aumentar `MAX_FOTOS_TOTAL` de 12 para 20

**4. Dados do vistoriador mais destaque**
- Mover secao "Vistoriador" para o cabecalho, ao lado do protocolo
- Incluir nome do vistoriador de forma visivel no topo

**5. Linha separadora entre secoes**
- Adicionar linhas horizontais finas entre cada bloco de dados

### Resultado visual esperado
```text
┌──────────────────────────────────────────┐
│  ██ LAUDO DE VISTORIA VEICULAR           │  (faixa azul)
│     PRATICCAR Protecao Veicular          │
│  Protocolo: VIST-XXX    Data: dd/mm/yyyy │
│  Vistoriador: Fulano                     │
├──────────────────────────────────────────┤
│  ┌─ DADOS DO ASSOCIADO ────────────────┐ │
│  │ Nome: Joao        CPF: 123.456...   │ │
│  │ Endereco: Rua...                    │ │
│  └─────────────────────────────────────┘ │
│  ┌─ DADOS DO VEICULO ─────────────────┐ │
│  │ Marca: Toyota     Ano: 2023/2023   │ │
│  │ Placa: ABC1D23    Chassi: 9BR...   │ │
│  │ Cor: Prata        KM: 45.000 km    │ │
│  └─────────────────────────────────────┘ │
│  [APROVADO]                              │
├──────────────────────────────────────────┤
│  IDENTIFICACAO E MOTOR (3 fotos)         │
│  ┌──────────┐  ┌──────────┐             │
│  │  Motor   │  │  Chassi  │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐                            │
│  │  Placa   │                            │
│  └──────────┘                            │
│  EXTERIOR 360 (4 fotos)                  │
│  ┌──────────┐  ┌──────────┐             │
│  │  Frente  │  │ Traseira │             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

### Arquivos
- **Editar**: `supabase/functions/gerar-laudo-vistoria/index.ts` (layout visual)
- **Deploy**: edge function `gerar-laudo-vistoria`

