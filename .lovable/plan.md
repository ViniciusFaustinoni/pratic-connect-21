

# Consulta de Placa com número de portas + restrito a Analista de Cadastro

## Alterações

### 1. Edge function `plate-lookup/index.ts`
Adicionar `numero_portas` ao `vehicleData` retornado — a API FipePlacas retorna esse campo como `quantidade_passageiros` ou `qt_portas`. Mapear o campo disponível:
```ts
numero_portas: veiculo.qt_portas || veiculo.quantidade_passageiros || '',
cambio: veiculo.cambio || '',
```

### 2. `src/pages/configuracoes/Sistema.tsx`
Adicionar o card "Consulta de Veículo por Placa" com:
- Input de placa + botão Consultar
- Resultado em grid organizado por seções (Identificação, Veículo, Mecânica, Registro, FIPE)
- Incluir **Número de Portas** e **Câmbio** na seção Veículo
- **Condição de visibilidade**: o card só aparece se `hasPerm('canManageCadastro')` — que é a permissão do analista de cadastro
- Importar `usePermissions` para o check

### 3. Campos exibidos

| Seção | Campos |
|-------|--------|
| Identificação | Placa, Chassi, Renavam |
| Veículo | Marca, Modelo, Ano, Cor, Tipo, **Nº Portas** |
| Mecânica | Motor, Potência, Cilindradas, Combustível, **Câmbio** |
| Registro | Município, UF, Categoria, Procedência |
| FIPE | Código, Valor, Mês referência |

## Impacto
- 1 edge function: +2 campos no retorno
- 1 página: card condicional com permissão `canManageCadastro`
- Deploy da edge function necessário

