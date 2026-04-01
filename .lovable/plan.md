
# Pre-preencher endereço no agendamento de instalação (link público)

## Problema
O componente `AgendamentoInstalacaoContrato` inicia com todos os campos de endereço vazios. O associado já tem CEP, logradouro, bairro, cidade e UF cadastrados (vindo da cotação), mas **número** e **complemento** não são pré-preenchidos porque:
1. O componente não recebe dados de endereço como prop
2. O componente não tem campo de complemento

## Correções

### Arquivo 1: `src/components/associado/AgendamentoInstalacaoContrato.tsx`
- Adicionar prop opcional `enderecoInicial` com campos `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`
- Adicionar estado `complemento` (campo que não existe hoje)
- No `useEffect` inicial, pré-preencher todos os campos com os dados do `enderecoInicial`
- Adicionar campo de **Complemento** na UI (entre logradouro/número e bairro/cidade)
- Incluir `complemento` no payload enviado ao confirmar

### Arquivo 2: `src/pages/public/AssociadoVistoria.tsx`
- Na chamada `<AgendamentoInstalacaoContrato>`, passar o endereço do associado como prop:
```tsx
<AgendamentoInstalacaoContrato
  contratoId={contrato.id}
  enderecoInicial={{
    cep: contrato.associados?.cep || '',
    logradouro: contrato.associados?.logradouro || '',
    numero: contrato.associados?.numero || '',
    complemento: contrato.associados?.complemento || '',
    bairro: contrato.associados?.bairro || '',
    cidade: contrato.associados?.cidade || '',
    estado: contrato.associados?.uf || '',
  }}
  onConfirmar={...}
/>
```

## Impacto
- 2 arquivos alterados
- Campos pré-preenchidos ao abrir a tela de agendamento
- Novo campo "Complemento" visível na UI
- Associado pode editar se necessário
