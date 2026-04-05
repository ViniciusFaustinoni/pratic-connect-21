

# Validar formato de placa antes de vincular veículo

## Problema
Se a planilha contiver um valor na coluna "Placa" que não é uma placa válida (texto aleatório, número solto, etc.), o sistema tenta buscar no banco e gera um aviso desnecessário. O correto é: se não for reconhecido como placa brasileira, ignorar silenciosamente e criar o rastreador sem vínculo.

## Alteração

### Arquivo: `src/components/monitoramento/estoque/ImportarRastreadoresDialog.tsx`

Na função `validarDados`, adicionar validação de formato de placa brasileira (antiga `ABC-1234` e Mercosul `ABC1D23`) **antes** de tentar resolver o veículo:

```typescript
// Regex para placa brasileira (antiga e Mercosul)
const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

if (row.placa) {
  const placaNorm = row.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!placaRegex.test(placaNorm)) {
    // Não é uma placa válida — ignorar, criar sem vínculo
    row.placa = undefined;
  } else {
    const vid = veiculosMap.get(placaNorm);
    if (vid) {
      veiculo_id = vid;
      veiculo_encontrado = true;
    } else {
      avisos.push('Placa não encontrada no sistema');
    }
  }
}
```

Também ajustar o filtro de placas únicas (linha 89) para só incluir placas com formato válido, evitando buscas desnecessárias no banco.

## Resultado
- Placa ausente ou inválida → rastreador criado com status `estoque`, sem vínculo
- Placa válida encontrada → vínculo automático, status `instalado`
- Placa válida não encontrada → aviso, sem vínculo, status `estoque`

