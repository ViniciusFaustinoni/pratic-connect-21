
Diagnóstico encontrado: o filtro de `visivel_gestao` já está aplicado no hook principal, então esse não é mais o problema.

Causa raiz mais provável:
1. O motor de cotação em `src/hooks/usePlanosCotacao.ts` só exclui categorias bloqueadas quando `categoria !== 'aplicativo'`.
2. Para uso app, a UI frequentemente manda `usoApp = true` e também `categoria = 'aplicativo'`.
3. Com isso, o gate de `blocked_categories` é pulado justamente no cenário de aplicativo:
   ```ts
   if (categoria && categoria !== 'nenhuma' && categoria !== 'aplicativo' ...)
   ```
4. Resultado: planos como Select/Select One continuam aparecendo mesmo quando a linha deveria ser barrada para a categoria especial do veículo, porque “aplicativo” está sendo tratado como exceção global em vez de categoria real de bloqueio.

Evidências lidas:
- O hook principal já faz `.eq('visivel_gestao', true)`.
- A própria rede mostra `planos?...visivel_gestao=eq.true`, então a correção anterior está ativa.
- O form e o cotador continuam convertendo a seleção da categoria “aplicativo” em `usoApp=true`.
- O banco mostra `blocked_categories` nas `product_lines`, mas o código ignora esse gate para `aplicativo`.

Também identifiquei um segundo ponto que mantém a percepção de “filtro errado”:
- Em `verificarElegibilidadeModelo`, se não houver regra específica para o plano/modelo, o retorno é `aprovado`.
- Isso significa que a elegibilidade hoje funciona como lista de exceções, não whitelist estrita.
- Se a expectativa de vocês é “mostrar só planos explicitamente cadastrados para aquele modelo”, a lógica atual nunca vai atender, porque ausência de regra = aceita.

Plano de correção:
1. Ajustar o gate de categoria em `src/hooks/usePlanosCotacao.ts`
   - Separar “uso do veículo” de “categoria do veículo”.
   - Não tratar `aplicativo` como exceção automática no bloqueio por `blocked_categories`.
   - Aplicar o bloqueio sempre que a categoria vier preenchida e não for `nenhuma`.

2. Revisar a semântica do parâmetro `categoria`
   - Hoje ele mistura “situação especial” (leilão, ex-táxi, chassi) com “uso do veículo” (aplicativo).
   - Padronizar:
     - `usoApp` controla precificação/app.
     - `categoria` controla bloqueios e exclusões.
   - Isso evita que app destrave filtros indevidamente.

3. Corrigir os pontos de entrada da UI
   - `Cotador.tsx`
   - `Cotacao.tsx`
   - `CotacaoFormDialog.tsx`
   Verificar onde “aplicativo” está sendo gravado como categoria e onde deve ser apenas modalidade/uso.

4. Validar elegibilidade por modelo conforme a regra de negócio desejada
   - Se vocês querem lista de exceção: manter como está.
   - Se querem whitelist estrita por plano/modelo: mudar `if (!regra) return 'aprovado'` para comportamento restritivo quando houver regras cadastradas para aquele plano.

5. Fazer uma checagem final dos cenários críticos
   - passeio + nenhuma
   - aplicativo
   - leilão
   - ex-táxi / táxi
   - chassi remarcado
   - modelo com regra limitada/negada

Arquivos a ajustar:
- `src/hooks/usePlanosCotacao.ts`
- `src/pages/vendas/Cotador.tsx`
- `src/pages/vendas/Cotacao.tsx`
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Observação importante:
Pelo código atual, a causa não parece ser “o filtro não foi salvo”, e sim “o motor está interpretando aplicativo como exceção e deixando passar planos que deveriam cair no gate de bloqueio”.
