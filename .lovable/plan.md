## Objetivo

No `OutrasEntradasMenu` (Substituição / Migração / Inclusão), quando o associado é detectado como inadimplente no SGA, a UI atual mostra apenas uma lista resumida (marca, modelo, placa, total) — **sem linha digitável** e **sem botão de verificar pagamento**. O usuário precisa esperar até a meia-noite (cron) para o sistema reconhecer o pagamento.

Vamos reaproveitar o `DebitosCard` (que já tem linha digitável visível, copiar linha, abrir boleto, **Verificar pagamento** por boleto e **Verificar todos**) nos três fluxos.

## Onde mexer

Arquivo único: `src/components/vendas/OutrasEntradasMenu.tsx`

### 1. Import

Adicionar:
```ts
import { DebitosCard } from '@/components/cotacao/DebitosCard';
```

### 2. Bloco Migração (linha ~417-431)

Substituir a renderização manual dos débitos (loop atual mostrando só `marca/modelo/placa/total`) por:

```tsx
<DebitosCard
  debitos={migracaoDebitos!.debitosPorVeiculo}
  saldoTotal={migracaoDebitos!.saldoTotal}
  bloqueante
  cpf={migracaoAssociadoId}
  titulo="Débitos pendentes"
  descricao="Este CPF possui débitos que precisam ser quitados antes de qualquer nova filiação."
/>
```

(mantém o `<Alert>` externo se quisermos preservar título/ícone, mas o card já carrega seu próprio Alert; melhor remover o wrapper `Alert` e usar só o `DebitosCard`.)

### 3. Bloco Substituição (linha ~487-506)

Onde hoje renderiza `<Alert variant="destructive">` com lista resumida quando `bloqueado && temDebitos`, manter o Alert para a mensagem geral, mas trocar o `.map(...)` por `<DebitosCard>` quando `temDebitos`. Para evitar duplo Alert, simplificar: quando `bloqueado && temDebitos` renderizar o `<DebitosCard>` no lugar do `<Alert>`, e quando `bloqueado` por outro motivo (sem débito) mantém o Alert atual.

```tsx
{temDebitos ? (
  <DebitosCard
    debitos={debitosData!.debitosPorVeiculo}
    saldoTotal={debitosData!.saldoTotal}
    bloqueante
    cpf={selectedAssociadoId!}
    titulo="Substituição bloqueada — associado inadimplente"
    descricao={
      repasseConfig?.repasse_maior_percentual
        ? `Repasse maior: ${repasseConfig.repasse_maior_percentual}%${repasseConfig.repasse_maior_descricao ? ` — ${repasseConfig.repasse_maior_descricao}` : ''}`
        : undefined
    }
  />
) : (
  // Alert atual para outros bloqueios
)}
```

### 4. Bloco Inclusão (linha ~588-609)

Mesma lógica do bloco Substituição: quando `bloqueado && temDebitos`, renderizar o `<DebitosCard>` com `cpf={selectedAssociadoId}`. Quando bloqueado por status/limite, manter o Alert original com a mensagem específica (sem o loop manual de débitos, que vira responsabilidade do card quando aplicável).

### 5. Comportamento

- O `DebitosCard` já recebe UUID do associado e resolve o CPF via cache do hook `useVerificarDebitosAssociado` (já consumido no mesmo componente). Não precisa de prop nova.
- Ao clicar **Verificar pagamento** (em um boleto) ou **Verificar todos**: invalida `['sga-busca', cpf, '']` e refaz a consulta. Como esse mesmo componente também consome `useVerificarDebitosAssociado`, o `bloqueado` recalcula automaticamente e libera o botão de prosseguir quando o saldo zerar.

## Já existe? — confirmação

Verifiquei: no `OutrasEntradasMenu` os débitos são renderizados manualmente (sem linha digitável, sem botão de verificar). O `DebitosCard` já existe e já tem todos os recursos necessários (implementados na rodada anterior). Vamos apenas reaproveitá-lo nos três pontos.

## Critérios de aceite

- Nos três fluxos (Substituição, Migração, Inclusão), quando há débito pendente, aparece a linha digitável de cada boleto + botões **Copiar linha**, **Boleto**, **Verificar pagamento** e, no rodapé, **Verificar todos**.
- Após o pagamento ser confirmado pelo SGA via clique no botão, o bloqueio cai imediatamente e o botão "Prosseguir / Iniciar / Confirmar" é liberado, sem precisar esperar a rotina noturna.
