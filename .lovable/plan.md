

## Plano: Relaxar filtro tipo_uso para APP + deságio na linha Select

### Alteração

**Arquivo: `src/hooks/usePlanosCotacao.ts` (linha 397)**

Substituir a linha 397 por uma verificação que permite planos `passeio` da linha `select` passarem quando APP + deságio estão ativos:

```typescript
// Linha 397 atual:
if (params.usoApp && tipoUsoPlano !== 'aplicativo' && tipoUsoPlano !== 'ambos') continue;

// Substituir por:
if (params.usoApp && tipoUsoPlano !== 'aplicativo' && tipoUsoPlano !== 'ambos') {
  // APP + deságio: planos 'passeio' da linha select passam (preço será de deságio, não APP)
  const appComDesagioAtivo = !!categoria && categoria !== 'nenhuma'
    && categoriasQueSobrepoeApp.includes(categoria);
  const isLinhaSelect = plProductLine?.slug?.toLowerCase()?.startsWith('select');
  if (!(appComDesagioAtivo && tipoUsoPlano === 'passeio' && isLinhaSelect)) {
    continue;
  }
}
```

A variável `plProductLine` já está disponível na linha 391. A variável `categoriasQueSobrepoeApp` já existe no escopo. O filtro de EXCLUSIVE na linha 432 continua funcionando e oculta o Exclusive mesmo após passar por aqui. O SELECT ONE com `tipo_uso = 'ambos'` já passa normalmente.

Nenhum outro arquivo é alterado.

