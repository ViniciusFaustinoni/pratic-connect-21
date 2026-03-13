

## Plano: Pré-preencher endereço no agendamento com dados do comprovante de residência

### Problema
O formulário de agendamento (presencial no cliente) começa com todos os campos de endereço vazios, mesmo quando a IA já coletou o endereço do associado a partir do comprovante de residência (salvo na cotação como `cliente_cep`, `cliente_logradouro`, `cliente_numero`, `cliente_bairro`, `cliente_cidade`, `cliente_complemento`).

### Solução

Passar o endereço da cotação como prop até o componente `AgendamentoVistoria` e usá-lo como valor inicial do formulário.

### Alterações

**1. `AgendamentoVistoria.tsx`** — Adicionar prop `enderecoInicial?: Partial<EnderecoForm>` e usá-lo no `useState` inicial:
```typescript
const [endereco, setEndereco] = useState<EnderecoForm>({
  cep: enderecoInicial?.cep || '',
  logradouro: enderecoInicial?.logradouro || '',
  numero: enderecoInicial?.numero || '',
  complemento: enderecoInicial?.complemento || '',
  bairro: enderecoInicial?.bairro || '',
  cidade: enderecoInicial?.cidade || '',
  estado: enderecoInicial?.estado || ''
});
```

**2. `AgendamentoVistoriaCompleta.tsx`** — Adicionar prop `enderecoInicial` e repassar para `AgendamentoVistoria`.

**3. `EtapaVistoria.tsx`** — Adicionar prop `enderecoInicial` e repassar para `AgendamentoCotacao` e `AgendamentoVistoriaCompleta`.

**4. `CotacaoContratacao.tsx`** — Montar o objeto de endereço a partir dos campos `cliente_*` da cotação e passá-lo para `EtapaVistoria` e `AgendamentoVistoriaCompleta`:
```typescript
enderecoInicial={{
  cep: cotacao?.cliente_cep || '',
  logradouro: cotacao?.cliente_logradouro || '',
  numero: cotacao?.cliente_numero || '',
  complemento: cotacao?.cliente_complemento || '',
  bairro: cotacao?.cliente_bairro || '',
  cidade: cotacao?.cliente_cidade || '',
  estado: cotacao?.cliente_uf || '',
}}
```

**5. `AgendamentoCotacao.tsx`** — Repassar `enderecoInicial` para `AgendamentoVistoria`.

Nenhuma migração SQL necessária — os dados já existem na tabela `cotacoes`.

