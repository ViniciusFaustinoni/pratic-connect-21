

## Plano: Coberturas Únicas por Plano + Correção da Duplicação

### Problema Confirmado no Banco

As coberturas são **compartilhadas** entre planos via `planos_coberturas`. Exemplos reais:

| Cobertura | Planos que usam |
|-----------|----------------|
| Colisão - Select | 11 planos (Basic, Deságio 70%, 75%, One, One APP...) |
| Colisão - Lançamento | 18 planos (todos da linha Lançamento) |
| Alagamento - Select | 11 planos |
| Taxa Administrativa Select | 6 planos |

A cobertura "Colisão - Select" tem regra `combustivel: include [flex]` e `regiao: include [RJ]`. Quando o plano "Select Basic - Deságio 70%" usa essa MESMA cobertura, ela passa na elegibilidade de um veículo Flex normal — porque a cobertura não tem regra de `tipo_placa`. E não pode ter, porque quebraria o plano normal que também a usa.

Além disso, `useDuplicatePlan()` (linha 300 de `usePlansAdmin.ts`) **não duplica coberturas** — só copia benefícios e regiões. Coberturas ficam de fora.

### Regra do Usuário
> "Não existe cobertura compartilhada entre planos. Se um plano foi duplicado, suas coberturas devem ser duplicadas também, podendo ser configuradas separadamente."

### Solução em 2 Partes

#### Parte 1 — Corrigir `useDuplicatePlan` (código)

Alterar `src/hooks/usePlansAdmin.ts`, função `useDuplicatePlan()`:

1. Buscar `planos_coberturas` do plano original
2. Para cada cobertura vinculada:
   - Clonar o registro na tabela `coberturas` (novo ID, nome com sufixo do plano)
   - Clonar as `entity_eligibility_rules` da cobertura original para o novo ID
   - Inserir vínculo em `planos_coberturas` com o novo plano e a nova cobertura
3. Manter a duplicação de benefícios e regiões como já está

Isso garante que a partir de agora, todo plano duplicado terá coberturas independentes.

#### Parte 2 — Corrigir dados existentes (script de migração)

Criar um script que percorre todas as coberturas compartilhadas (as que aparecem em mais de 1 plano):

1. Para cada cobertura compartilhada, manter o original no PRIMEIRO plano encontrado
2. Para cada plano adicional que usa a mesma cobertura:
   - Clonar a cobertura (novo registro em `coberturas`)
   - Clonar as regras de elegibilidade
   - Atualizar `planos_coberturas` para apontar para a cópia
3. Após a migração, cada plano terá coberturas exclusivas

O nome das cópias seguirá o padrão existente (ex: se "Colisão - Select" é clonada para o plano "Select Basic - Deságio 70%", o nome fica "Colisão - Select Deságio" ou mantém o original — o administrador pode renomear depois).

### Impacto nos Motores

Após a migração:
- Cada cobertura de um plano de deságio pode ter sua própria regra `tipo_placa: include [leilao, chassi_remarcado]`
- O motor de cotação (`usePlanosCotacao.ts`) funciona corretamente sem precisar de lógica de "remoção estrutural"
- A correção já feita na linha 264 de `useEntityEligibilityRules.ts` (`isInclude ? false : true`) continua válida
- O check de `coberturasDoPlano.length === 0` continua como safety net

### Arquivos Alterados
- `src/hooks/usePlansAdmin.ts` — `useDuplicatePlan()`: adicionar clonagem de coberturas + regras
- Script de migração (executado via `code--exec`): descompartilhar coberturas existentes

### Não Alterado
- Motor de cotação (`usePlanosCotacao.ts`) — já funciona com coberturas únicas
- Motor de regras (`useEntityEligibilityRules.ts`) — já corrigido
- UI de gestão comercial — já suporta a estrutura
- `useDuplicateCobertura()` — já existe e funciona bem para duplicação individual no catálogo

### Resultado
- Cada plano passa a ter coberturas exclusivas e configuráveis individualmente
- Duplicar um plano clona automaticamente suas coberturas com todas as regras
- O administrador pode então configurar regras de `tipo_placa`, `combustivel` etc. em cada cobertura sem afetar outros planos
- O motor de cotação filtra corretamente sem gambiarras de "detecção estrutural"

