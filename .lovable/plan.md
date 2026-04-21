

## Bloqueio de datas no calendário — permitir bloquear dias do próximo mês visíveis no grid

### Causa da falha (confirmada no código)

Em `src/pages/monitoramento/CalendarioInstalacoes.tsx`, linha 384, o botão de cadeado só é renderizado quando `dia.mesAtual === true`:

```tsx
{podeBloquear && dia.mesAtual && ( <button … cadeado … /> )}
```

`mesAtual` aqui significa "pertence ao mês exibido no grid". Resultado: os dias do mês seguinte que aparecem na última linha do calendário (no caso, **1 a 9 de maio enquanto exibimos abril**) ficam sem o botão de cadeado. O usuário vê "01" no grid de abril, clica e nada acontece — daí a percepção de que "só dá pra bloquear o mês atual".

Importante: a navegação `>` para maio funciona, mas o usuário espera bloquear direto pelo dia já visível. Faz sentido permitir.

### Mudança

Em `src/pages/monitoramento/CalendarioInstalacoes.tsx`:

1. **Remover** o gate `dia.mesAtual` da renderização do botão de cadeado (linha 384).
2. **Adicionar** um único guarda: não mostrar o cadeado para datas **no passado** (anteriores a hoje, comparando por `yyyy-MM-dd`). Bloquear o passado não tem efeito operacional.
3. Manter o gate `podeBloquear` (Diretor / Coordenador de Monitoramento / Admin Master / Desenvolvedor).
4. **Ajuste visual menor**: quando o dia pertence ao próximo/anterior mês (`!dia.mesAtual`) e está bloqueado, manter o hachurado vermelho atual — já funciona porque `bloqueada` é calculado por `dataStr`, independente de `mesAtual`.
5. Aplicar a mesma regra ao indicador "🔒 motivo" (linhas 404-408): já é renderizado independente de `mesAtual`, então nada a mudar.

### Critérios de aceitação

1. Estando em **abril**, com hoje = 21/04, o ícone de cadeado aparece em **todos os dias visíveis a partir de hoje** — incluindo os dias 1 a 9 de **maio** que aparecem na última linha do grid de abril.
2. Clicar em "1" (maio) abre o `BloquearDataDialog` com a data correta `2026-05-01` e permite gravar o motivo "Feriado do Trabalho".
3. Após bloquear, o dia 1 de maio fica hachurado em vermelho tanto na visão de abril (overflow) quanto na visão de maio.
4. Dias no passado (anteriores a hoje) **não** mostram o botão de cadeado.
5. Datas já bloqueadas no passado continuam exibindo o hachurado e o motivo, mas sem botão para alterar.
6. Permissão continua restrita a Diretor, Coordenador de Monitoramento, Admin Master e Desenvolvedor.

### Fora de escopo

- Limitar a janela máxima de bloqueio futuro (ex.: "no máximo 6 meses à frente"). Hoje já é livre via navegação; manter assim.
- Bloqueio em massa de intervalo de datas (seleção de range).
- Bloqueio recorrente anual para feriados fixos.

