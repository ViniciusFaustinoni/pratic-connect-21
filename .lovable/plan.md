
# Plano de Implementacao: Gerador de Termo de Filiacao em PDF

## Resumo Executivo

Criar uma pagina interna no sistema para geracao de PDFs do Termo de Filiacao, reutilizando o template existente em `supabase/functions/_shared/termo-afiliacao-template.ts` e adaptando-o para uso no frontend. Incluir tambem o Termo de Responsabilidade do Rastreador (ainda nao existente no sistema).

---

## Analise do Estado Atual

### O que ja existe:
1. **Template HTML completo** em `supabase/functions/_shared/termo-afiliacao-template.ts`
   - 9 secoes conforme especificacao
   - Termo Aditivo de Veiculo 0KM (condicional)
   - Funcao `generateTermoAfiliacao()` que gera HTML completo

2. **Utilitarios** em `supabase/functions/_shared/termo-afiliacao-utils.ts`
   - Interfaces: `ClienteData`, `VeiculoData`, `PlanoData`, etc.
   - Formatadores: `formatCPF`, `formatCurrency`, `formatDate`, etc.
   - Mapeador: `mapearDadosParaTemplate()`

3. **jsPDF** - Biblioteca de PDF ja instalada (nao html2pdf.js)
   - Exemplo em `src/lib/gerarPdfCotacao.ts`

### O que falta:
1. Pagina `GerarTermo.tsx` no frontend
2. Componente `TermoFiliacaoTemplate.tsx` (adaptacao do template existente)
3. Funcao `gerarTermoPDF.ts` usando jsPDF com HTML
4. Termo de Responsabilidade do Rastreador (nova secao)
5. Rota no `App.tsx`

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/cadastro/GerarTermo.tsx` | CRIAR | Pagina principal com busca, preview e geracao |
| `src/components/cadastro/TermoFiliacaoTemplate.tsx` | CRIAR | Componente React do template HTML |
| `src/lib/gerarTermoPDF.ts` | CRIAR | Funcao para gerar PDF a partir do HTML |
| `src/types/termo-filiacao.ts` | CRIAR | Interfaces TypeScript para o frontend |
| `src/App.tsx` | MODIFICAR | Adicionar rota /cadastro/gerar-termo |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | MODIFICAR | Adicionar Termo Rastreador |

---

## Detalhamento Tecnico

### 1. Pagina GerarTermo.tsx

**Rota:** `/cadastro/gerar-termo`

**Layout:**
```text
+----------------------------------------------------------+
| Home > Cadastro > Gerar Termo de Filiacao                |
|                                                          |
| GERAR TERMO DE FILIACAO                                  |
|----------------------------------------------------------|
|                                                          |
| +------------------------------------------------------+ |
| | Buscar associado:                                    | |
| | [Digite CPF ou nome do associado...]                 | |
| +------------------------------------------------------+ |
|                                                          |
| +------------------------------------------------------+ |
| | DADOS DO ASSOCIADO                   Card bg-card    | |
| | Nome: ESTEFANI BOTELHO DA SILVA                      | |
| | CPF: 123.456.789-00                                  | |
| | Veiculo: HONDA CG 160 START - SEM PLACA              | |
| | Plano: ADVANCED ESPECIAL                             | |
| | Valor FIPE: R$ 18.083,00                             | |
| +------------------------------------------------------+ |
|                                                          |
| +------------------------------------------------------+ |
| | DOCUMENTOS A GERAR                   Card bg-card    | |
| | [x] Proposta de Filiacao (sempre)        disabled    | |
| | [x] Termo Aditivo 0KM         Badge: Veiculo sem placa|
| | [x] Termo Responsabilidade Rastreador                | |
| |     Badge: Moto com valor FIPE > R$ 9.000            | |
| +------------------------------------------------------+ |
|                                                          |
|         [Preview]  [Gerar PDF]  [Enviar Autentique]     |
+----------------------------------------------------------+
```

**Estado:**
```typescript
interface EstadoGerarTermo {
  busca: string;
  associadoSelecionado: AssociadoCompleto | null;
  previewAberto: boolean;
  gerando: boolean;
}
```

**Logica de documentos condicionais:**
```typescript
// Verifica se eh 0KM
const ehZeroKm = !veiculo.placa || veiculo.placa === '' || 
                  veiculo.placa.startsWith('000') ||
                  veiculo.procedencia === 'Novo (zero km)';

// Verifica se rastreador eh obrigatorio
const exigeRastreador = (veiculo: VeiculoData): boolean => {
  const { tipo, valorFipe, combustivel } = veiculo;
  
  // Diesel sempre exige
  if (combustivel?.toLowerCase() === 'diesel') return true;
  
  // Carro > R$ 20.000
  if (tipo === 'carro' && valorFipe > 20000) return true;
  
  // Moto > R$ 9.000
  if (tipo === 'moto' && valorFipe > 9000) return true;
  
  return false;
};
```

### 2. Componente TermoFiliacaoTemplate.tsx

Componente React que renderiza o HTML do documento para conversao em PDF.

**Props:**
```typescript
interface TermoFiliacaoTemplateProps {
  dados: TermoAfiliacaoData;
  incluirTermo0km: boolean;
  incluirTermoRastreador: boolean;
}
```

**Estrutura:**
- Adaptar o template existente de `termo-afiliacao-template.ts` para React
- Manter os mesmos estilos CSS inline
- Adicionar nova secao: Termo de Responsabilidade do Rastreador

### 3. Funcao gerarTermoPDF.ts

Usar jsPDF para converter o HTML em PDF.

**Abordagem:**
O jsPDF nao suporta HTML diretamente de forma nativa, entao temos duas opcoes:
1. **html2canvas + jsPDF** - Renderizar HTML como imagem e adicionar ao PDF
2. **Usar o template existente via Edge Function** - Chamar autentique-create que ja gera o HTML

**Recomendacao:** Usar a abordagem 1 com html2canvas (ja disponivel no jsPDF moderno):

```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function gerarTermoPDF(elementId: string, nomeArquivo: string): Promise<Blob> {
  const elemento = document.getElementById(elementId);
  if (!elemento) throw new Error('Elemento nao encontrado');
  
  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  const imgWidth = 210; // A4 width
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  
  return pdf.output('blob');
}
```

**Dependencia adicional:**
```bash
npm install html2canvas
```

### 4. Termo de Responsabilidade do Rastreador (Nova Secao)

Adicionar ao template a secao condicional:

```typescript
const generateSecaoRastreador = (data: TermoAfiliacaoData): string => {
  // Apenas se rastreador for obrigatorio
  if (!exigeRastreador(data.veiculo)) return '';
  
  return `
<div class="section page-break">
  <h2 class="section-title" style="color: #7c3aed;">
    TERMO DE RESPONSABILIDADE - EQUIPAMENTO RASTREADOR
  </h2>
  
  <p class="intro-text">
    Pelo presente termo, o(a) associado(a) abaixo qualificado(a) declara ter 
    recebido em regime de COMODATO o equipamento rastreador para instalacao 
    no veiculo cadastrado, assumindo inteira responsabilidade pela sua guarda 
    e conservacao.
  </p>
  
  <div class="declaracao">
    <p class="declaracao-titulo">1. DO EQUIPAMENTO</p>
    <p class="declaracao-texto">
      O equipamento rastreador e de propriedade exclusiva da ${data.empresa.nome}, 
      sendo cedido em comodato ao associado durante a vigencia da filiacao.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">2. DO RASTREAMENTO</p>
    <p class="declaracao-texto">
      O associado tem ciencia e autoriza o rastreamento 24 (vinte e quatro) horas 
      do veiculo cadastrado, para fins de monitoramento e recuperacao em caso de sinistro.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">3. DA DEVOLUCAO</p>
    <p class="declaracao-texto">
      O associado compromete-se a devolver o equipamento em perfeito estado de 
      funcionamento quando do desligamento do PSM, no prazo maximo de 15 (quinze) dias.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">4. DA MULTA</p>
    <p class="declaracao-texto">
      A nao devolucao do equipamento no prazo estipulado acarretara multa de 
      R$ 400,00 (quatrocentos reais), valor que podera ser cobrado judicialmente.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">5. DO TITULO EXECUTIVO</p>
    <p class="declaracao-texto">
      O presente termo tem forca de titulo executivo extrajudicial, nos termos 
      do Art. 784 do Codigo de Processo Civil.
    </p>
  </div>
  
  <div class="assinatura-box">
    <p>Local: ${data.cliente.cidade}/${data.cliente.uf}</p>
    <p>Data: _____/_____/__________</p>
    <div class="linha-assinatura"></div>
    <p class="nome-assinatura">${data.cliente.nome}</p>
    <p class="cpf-assinatura">CPF: ${formatCPF(data.cliente.cpf)}</p>
  </div>
</div>
`;
};
```

### 5. Tipos TypeScript

```typescript
// src/types/termo-filiacao.ts

export interface ClienteData {
  nome: string;
  cpf: string;
  rg?: string;
  rgOrgao?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  email: string;
  telefone: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

export interface VeiculoData {
  tipo: 'carro' | 'moto';
  marca: string;
  modelo: string;
  anoFab: number;
  anoMod: number;
  cor: string;
  placa: string;
  renavam: string;
  chassi: string;
  combustivel: string;
  valorFipe: number;
  codigoFipe: string;
  procedencia?: string;
}

export interface PlanoData {
  nome: string;
  coberturas: string[];
  valorMensal: number;
  taxaAdesao: number;
  diaVencimento: number;
}

export interface IndicadorData {
  nome: string;
  cpf: string;
}

export interface DadosTermoFiliacao {
  cliente: ClienteData;
  veiculo: VeiculoData;
  plano: PlanoData;
  indicador?: IndicadorData;
}
```

---

## Rota a Adicionar

```typescript
// src/App.tsx
import GerarTermo from "./pages/cadastro/GerarTermo";

// Dentro das rotas de cadastro:
<Route path="/cadastro/gerar-termo" element={<GerarTermo />} />
```

---

## Fluxo de Uso

```text
1. Usuario acessa /cadastro/gerar-termo
2. Busca por CPF ou nome do associado
3. Sistema carrega dados do associado + veiculo + plano
4. Sistema calcula automaticamente:
   - Se eh 0KM (placa vazia ou "000*" ou procedencia "Novo")
   - Se rastreador eh obrigatorio (diesel, ou FIPE > limite)
5. Exibe checkboxes dos documentos que serao gerados
6. Usuario clica em "Preview" para visualizar
7. Usuario clica em "Gerar PDF" para download
8. Usuario clica em "Enviar Autentique" para assinatura digital
```

---

## Dados Mock (Fase Inicial)

Para a primeira implementacao, usar dados mock conforme especificado:

```typescript
const mockAssociado = {
  cliente: {
    nome: 'ESTEFANI BOTELHO DA SILVA',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    rgOrgao: 'SSP/SP',
    dataNascimento: '1990-05-15',
    estadoCivil: 'Solteira',
    profissao: 'Empresaria',
    email: 'estefani@email.com',
    telefone: '(11) 99999-1111',
    endereco: {
      cep: '01310-100',
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Apto 45',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'SP',
    },
  },
  veiculo: {
    tipo: 'moto',
    marca: 'HONDA',
    modelo: 'CG 160 START',
    anoFab: 2026,
    anoMod: 2026,
    cor: 'VERMELHA',
    placa: '', // vazio = 0KM
    renavam: '12345678901',
    chassi: '9C2KC1670NR123456',
    combustivel: 'GASOLINA',
    valorFipe: 18083.00,
    codigoFipe: '811064-8',
  },
  plano: {
    nome: 'ADVANCED ESPECIAL',
    coberturas: ['Roubo', 'Furto'],
    valorMensal: 89.90,
    taxaAdesao: 99.90,
    diaVencimento: 10,
  },
  indicador: {
    nome: 'Maria Santos',
    cpf: '987.654.321-00',
  },
};
```

---

## Componentes UI a Reutilizar

| Componente | Uso |
|------------|-----|
| `Card, CardHeader, CardContent` | Containers de secoes |
| `Button` | Acoes: Preview, Gerar PDF, Enviar |
| `Input` | Campo de busca |
| `Checkbox` | Selecao de documentos |
| `Badge` | Indicadores condicionais |
| `Dialog` | Modal de preview |
| `toast` (sonner) | Feedback de acoes |

---

## Checklist de Implementacao

- [ ] Criar `src/types/termo-filiacao.ts` com interfaces
- [ ] Criar `src/lib/gerarTermoPDF.ts` com funcao de geracao
- [ ] Criar `src/components/cadastro/TermoFiliacaoTemplate.tsx`
- [ ] Criar `src/pages/cadastro/GerarTermo.tsx`
- [ ] Adicionar Termo Rastreador ao template existente
- [ ] Adicionar rota no `App.tsx`
- [ ] Instalar html2canvas se necessario
- [ ] Testar geracao de PDF com dados mock
- [ ] Testar preview do documento
- [ ] Verificar quebras de pagina

---

## Observacoes Importantes

1. **Nao integrar com Supabase** nesta fase - usar dados mock
2. **Nao integrar com Autentique** - apenas botao placeholder com toast
3. **Usar padrao dark premium** do sistema existente
4. **Manter consistencia** com outros componentes de cadastro
5. **Dependencia adicional:** html2canvas para converter HTML em imagem

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Tipos e interfaces | 15 min |
| Funcao gerarTermoPDF | 30 min |
| Componente TermoFiliacaoTemplate | 1h |
| Pagina GerarTermo | 1h |
| Termo Rastreador | 30 min |
| Testes e ajustes | 30 min |
| **Total** | **3h 45min** |
