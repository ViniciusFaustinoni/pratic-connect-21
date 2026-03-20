

# Calcular carência automaticamente no contrato-gerar para inclusão

## Problema
A edge function `contrato-gerar` não lê `tipo_entrada` da cotação e não calcula `data_carencia_inicio` / `data_carencia_fim` quando a operação é inclusão. Os campos ficam nulos no contrato.

## Diagnóstico
- A cotação já armazena `tipo_entrada` (gravado pelo Cotador via `useCotacao.ts`)
- O contrato já tem as colunas `tipo_entrada`, `data_carencia_inicio`, `data_carencia_fim`
- A configuração `carencia_dias_padrao` já existe na tabela `configuracoes` com valor `120`
- O `contrato-gerar` (linha 648-718) cria o contrato mas **nunca** define `tipo_entrada`, `data_carencia_inicio` nem `data_carencia_fim`

## Solução

### Arquivo: `supabase/functions/contrato-gerar/index.ts`

1. **Importar o config-helper** existente (`../_shared/config-helper.ts`)

2. **Antes de criar o contrato** (~linha 640), ler a configuração de carência:
   ```typescript
   const carenciaDias = await getConfiguracaoNumero(supabase, 'carencia_dias_padrao', 120);
   ```

3. **Calcular as datas de carência** quando `tipo_entrada` for `inclusao` (ou qualquer tipo que exija carência — `nova` e `inclusao`):
   ```typescript
   const tipoEntrada = cotacao.tipo_entrada || 'nova';
   const hoje = new Date().toISOString().split('T')[0];
   let dataCarenciaInicio: string | null = null;
   let dataCarenciaFim: string | null = null;
   
   if (['nova', 'inclusao'].includes(tipoEntrada)) {
     dataCarenciaInicio = hoje;
     const fim = new Date();
     fim.setDate(fim.getDate() + carenciaDias);
     dataCarenciaFim = fim.toISOString().split('T')[0];
   }
   ```

4. **Adicionar os campos no insert** do contrato (dentro do `.insert({...})` na linha 648):
   ```typescript
   tipo_entrada: tipoEntrada,
   data_carencia_inicio: dataCarenciaInicio,
   data_carencia_fim: dataCarenciaFim,
   ```

### Impacto
- Contratos de inclusão e nova adesão terão carência calculada automaticamente
- A ficha do associado (`OrigemCadastroCard`) já lê esses campos — passará a exibi-los corretamente
- Migrações aprovadas continuam com carência isenta (lógica já existente em `useSolicitacoesMigracaoAdmin`)
- Nenhum valor fixo no código — prazo vem de `carencia_dias_padrao` na tabela `configuracoes`

