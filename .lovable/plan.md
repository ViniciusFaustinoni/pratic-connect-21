

# Plano: Conectar `cotacao_pdf_config` ao gerador de PDF

## Resumo

Modificar `src/lib/gerarPdfCotacao.ts` para buscar configurações da tabela `cotacao_pdf_config` antes de gerar o PDF, substituindo valores hardcoded quando existir registro salvo.

## Abordagem

Criar uma função auxiliar `carregarConfigPdf()` que busca o primeiro registro de `cotacao_pdf_config`. Retorna um objeto tipado com todos os campos ou `null` (sem registro = comportamento original).

Ambas as funções exportadas (`gerarPdfCotacao` e `gerarPdfCotacaoComparativa`) chamam essa função no início e passam o resultado para as subfunções de desenho.

## Alterações em `src/lib/gerarPdfCotacao.ts`

### 1. Import do Supabase client + interface de config

Adicionar import do `supabase` client e definir interface `PdfConfig` com os campos da tabela.

### 2. Nova função `carregarConfigPdf()`

```typescript
async function carregarConfigPdf(): Promise<PdfConfig | null> {
  const { data } = await supabase
    .from('cotacao_pdf_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  return data;
}
```

### 3. Função auxiliar `hexToRgb(hex)`

Converte cor hex (ex: `#14376E`) para `{ r, g, b }` usado pelo jsPDF.

### 4. Substituições condicionais nas duas funções principais

No início de `gerarPdfCotacao()` e `gerarPdfCotacaoComparativa()`:

```typescript
const config = await carregarConfigPdf();
const corPrimaria = config ? hexToRgb(config.cor_primaria) : brandBlue;
const corSecundaria = config ? hexToRgb(config.cor_secundaria) : brandRed;
const nomeEmpresa = config?.nome_empresa || 'PRATICCAR Proteção Veicular';
const mensagemEncerramento = config?.mensagem_encerramento || 'Será um prazer...';
const logoUrl = config?.logo_url || '/logos/logo-full-light.png';
```

### 5. Mapeamento de substituições

| Valor hardcoded | Campo config | Locais afetados |
|---|---|---|
| `brandBlue` | `cor_primaria` → `corPrimaria` | Card valor mensal (l.568), gradientes, header de seção |
| `brandRed` | `cor_secundaria` → `corSecundaria` | Gradientes (`drawGradientRect` calls com `brandRed`) |
| `/logos/logo-full-light.png` | `logo_url` | `loadImageWithDimensions` (l.309, l.1310) |
| `'PRATICCAR'` no header/footer | `nome_empresa` | Header (l.358), footer (l.653), header compacto (l.330), rodapé compacto (l.748) |
| `'Proteção Veicular'` | Parte do `nome_empresa` | Footer (l.658, l.753) |
| Texto "Será um prazer..." | `mensagem_encerramento` | Mensagem institucional (l.623-624) |

### 6. Blocos condicionais (toggles)

Envolver cada seção em `if` verificando a config:

- **Barra de validade** (`mostrar_validade`): linhas 370-385 em `gerarPdfCotacao`, linhas 898-913 em `desenharPaginaCapa`
- **Dados do solicitante** (`mostrar_dados_solicitante`): linhas 387-428 em `gerarPdfCotacao`, linhas 915-932 em `desenharPaginaCapa`
- **Dados do veículo** (`mostrar_dados_veiculo`): linhas 430-466 em `gerarPdfCotacao`, linhas 934-947 em `desenharPaginaCapa`
- **Mensagem institucional** (`mostrar_mensagem_encerramento`): linhas 613-629 em `gerarPdfCotacao`
- **WhatsApp no rodapé** (`mostrar_whatsapp_rodape`): linhas 696-727 em `desenharRodapeCompacto`

Regra: se `config` é `null`, todos os blocos são desenhados (comportamento original). Se `config` existe, verifica cada flag.

### 7. Propagação para subfunções do comparativo

As funções `desenharPaginaCapa`, `desenharRodapeCompacto` e `desenharPaginaDetalhesPlano` recebem um parâmetro adicional `config: PdfConfig | null` para aplicar as mesmas substituições de cores, nome e toggles.

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/lib/gerarPdfCotacao.ts` | Buscar config, aplicar cores/textos/toggles dinamicamente |

Nenhuma nova tabela ou migração necessária — a tabela já existe.

