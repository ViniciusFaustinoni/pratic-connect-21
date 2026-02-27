
# Checklist e Local de Instalacao diferenciados por tipo de veiculo

## Resumo

Diferenciar os itens de checklist e as opcoes de local de instalacao entre carro e moto no arquivo `src/pages/instalador/InstaladorChecklist.tsx`.

## Alteracoes

### 1. Criar constante CHECKLIST_ITEMS_MOTO (apos linha 79)

Nova constante com itens especificos para moto:

```typescript
const CHECKLIST_ITEMS_MOTO = [
  { id: 'veiculo_confere', label: 'Moto corresponde aos dados cadastrados' },
  { id: 'placa_confere', label: 'Placa confere com o documento' },
  { id: 'chassi_confere', label: 'Chassi visível e confere' },
  { id: 'condicoes_veiculo', label: 'Condições gerais da moto adequadas' },
  { id: 'local_seguro', label: 'Local de instalação seguro' },
  { id: 'eletrica_ok', label: 'Sistema elétrico funcionando' },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento' },
];
```

### 2. Criar arrays de locais de instalacao (constantes no topo)

```typescript
const LOCAIS_INSTALACAO_CARRO = [
  { value: 'painel', label: 'Painel' },
  { value: 'sob_banco', label: 'Sob o banco' },
  { value: 'parachoque_dianteiro', label: 'Para-choque dianteiro' },
  { value: 'parachoque_traseiro', label: 'Para-choque traseiro' },
  { value: 'caixa_roda', label: 'Caixa de roda' },
  { value: 'vao_motor', label: 'Vão do motor' },
  { value: 'console_central', label: 'Console central' },
  { value: 'porta_malas', label: 'Porta-malas' },
  { value: 'outro', label: 'Outro' },
];

const LOCAIS_INSTALACAO_MOTO = [
  { value: 'sob_banco', label: 'Sob o banco' },
  { value: 'carenagem_lateral', label: 'Carenagem lateral' },
  { value: 'caixa_filtro_ar', label: 'Caixa do filtro de ar' },
  { value: 'compartimento_ferramentas', label: 'Compartimento de ferramentas' },
  { value: 'sob_tanque', label: 'Sob o tanque' },
  { value: 'rabeta', label: 'Rabeta/Cola' },
  { value: 'paralama', label: 'Paralama' },
  { value: 'outro', label: 'Outro' },
];
```

### 3. Criar variavel checklistItems dinamica (dentro do componente)

Adicionar `useMemo` que seleciona a lista correta:

```typescript
const checklistItems = useMemo(() =>
  tipoVeiculo === 'moto' ? CHECKLIST_ITEMS_MOTO : CHECKLIST_ITEMS
, [tipoVeiculo]);
```

Tambem criar `locaisInstalacao` dinamico:

```typescript
const locaisInstalacao = useMemo(() =>
  tipoVeiculo === 'moto' ? LOCAIS_INSTALACAO_MOTO : LOCAIS_INSTALACAO_CARRO
, [tipoVeiculo]);
```

### 4. Atualizar referencias

Substituir todas as 4 ocorrencias de `CHECKLIST_ITEMS` dentro do componente por `checklistItems`:

- **Linha 97** (useState init): `checklistItems.reduce(...)` -- este precisa de tratamento especial pois roda antes do useMemo. Solucao: inicializar com array generico e reinicializar via useEffect quando tipoVeiculo mudar.
- **Linha 211** (checklistCompleto): `checklistItems.every(...)`
- **Linha 790** (renderizacao): `checklistItems.map(...)`

Para o estado inicial do checklist (linha 96-98), como `tipoVeiculo` depende de `servico` que e async, a abordagem sera:
- Manter init com `CHECKLIST_ITEMS` (fallback carro)
- Adicionar `useEffect` que reinicializa o checklist quando `tipoVeiculo` muda e nao ha checklist salvo

### 5. Atualizar Select de local de instalacao (linhas 1287-1297)

Substituir os `SelectItem` hardcoded por mapeamento dinamico:

```tsx
<SelectContent>
  {locaisInstalacao.map(local => (
    <SelectItem key={local.value} value={local.value}>{local.label}</SelectItem>
  ))}
</SelectContent>
```

## Arquivo alterado

| Arquivo | Alteracao |
|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | Adicionar constantes CHECKLIST_ITEMS_MOTO, LOCAIS_INSTALACAO_CARRO, LOCAIS_INSTALACAO_MOTO; criar useMemos dinamicos; atualizar referencias e Select |

## Pontos de atencao

- IDs dos itens de checklist de moto sao compativeis com os de carro (mesmo id = mesmo campo no banco), exceto `chassi_confere` que e novo e `bateria_ok` que e removido para motos
- Se ja houver checklist salvo no banco (servico restaurado), ele sera preservado
- O `localInstalacao` reseta se o usuario trocar... mas isso nao acontece pois o tipo de veiculo e fixo por servico
