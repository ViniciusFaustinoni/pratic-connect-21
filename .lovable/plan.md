

# Corrigir preenchimento automático do bairro via CEP

## Problema
Quando o associado preenche os dados na etapa de dados pessoais (via OCR do comprovante de residência), o bairro pode não ser extraído corretamente. O CEP e outros campos ficam preenchidos, mas o bairro fica vazio no banco de dados. Isso acontece porque:

1. A extração OCR do comprovante de residência nem sempre retorna o bairro
2. Nenhum componente faz auto-complete via ViaCEP ao carregar com CEP preexistente

Confirmado no banco: a cotação com CEP 22730-541 tem `cliente_bairro` vazio, apesar de ter logradouro, numero, cidade e UF preenchidos.

## Solução
Adicionar auto-complete via ViaCEP em dois pontos-chave para preencher campos faltantes quando já existe um CEP:

### 1. `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`
Adicionar um `useEffect` que, após a extração OCR do comprovante de residência, verifica se tem CEP mas falta bairro (ou logradouro/cidade/uf). Se faltar, busca no ViaCEP e completa os campos vazios.

Isso garante que os dados salvos no banco já terão o bairro.

### 2. `src/components/cotacao-publica/AgendamentoVistoria.tsx`
Adicionar um `useEffect` no mount que verifica se o `enderecoInicial` tem CEP mas falta bairro. Se faltar, faz busca no ViaCEP e preenche os campos vazios. Isso corrige cotações que já estão no banco sem bairro.

### Detalhes da implementação

Em ambos os componentes, a logica é a mesma:

```ts
useEffect(() => {
  // Se tem CEP válido mas falta bairro, buscar via ViaCEP
  const cep = endereco.cep?.replace(/\D/g, '');
  if (cep?.length === 8 && !endereco.bairro) {
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(r => r.json())
      .then(data => {
        if (!data.erro) {
          setEndereco(prev => ({
            ...prev,
            bairro: prev.bairro || data.bairro || '',
            logradouro: prev.logradouro || data.logradouro || '',
            cidade: prev.cidade || data.localidade || '',
            estado: prev.estado || data.uf || '',
          }));
        }
      })
      .catch(() => {});
  }
}, []); // Apenas no mount
```

No `EtapaDadosPessoaisDocumentos`, a mesma logica se aplica ao `dadosExtraidos` — apos extrair dados do comprovante de residencia, se tem CEP mas falta bairro, complementar via ViaCEP antes de exibir o resumo ao usuario.

2 arquivos alterados, adicionando 1 useEffect em cada.

