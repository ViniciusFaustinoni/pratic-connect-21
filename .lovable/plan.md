## Diagnóstico — motivo raiz

Confirmado in-loco no banco e no código.

### O que a UI deveria mostrar
Para o plano `Select One - Passeio 5%` (e o `Aplicativo - 5%`), a configuração de carência por item está assim:

- **Vidros e Faróis** → `carencia_ativa = true`, `carencia_dias = 120` ✅ (único item realmente configurado)
- Todos os demais (Kit Gás, Danos a Terceiros, Carro Reserva, Assistência 24h, Reboque Excedente, Rastreador, Clube Gás, Colisão, Furto, 100% FIPE, Roubo, Chuva de Granizo, Alagamento, Perda Total, Taxa Administrativa, Incêndio) → `carencia_ativa = false`

Então a UI deveria listar **só Vidros e Faróis** em "Carências por item" (ou nada para os outros).

### O que a UI mostra (errado)
Todos os 17 itens aparecem com "Em carência" / "114d restantes / até 24/08/2026".

### Onde está o bug
Arquivo: `src/hooks/useAssociadoSituacao.ts`, linhas 201–233.

A lógica atual faz:

```ts
if (item.carenciaAtiva && item.dias > 0) {
  // usa carência específica do item
} else {
  // HERDA o período geral do contrato (data_carencia_inicio → data_carencia_fim)
  fim = new Date(carenciaFim!);
  dias = ...;
}
```

Resultado: se o **contrato** tem carência geral preenchida (e tem, porque é o padrão), todo item com `carencia_ativa=false` é renderizado como "Em carência" usando o período do contrato. Isso quebra a promessa da configuração ("desliguei carência desse item, mas continua aparecendo em carência").

### Por que aparece para 17 itens
A query do hook (`planos_coberturas` + `planos_beneficios`) puxa **todos** os itens do plano, e o mapper inclui todos. Como nenhum tem `carencia_ativa=true` exceto Vidros, o `else` herda contrato → renderiza 17 cards "Em carência".

---

## Correção (raiz)

Em `src/hooks/useAssociadoSituacao.ts`, substituir o `map` por um `filter` + `map`:

- Só entram no array `carenciasItens` os itens com `carencia_ativa === true` E `carencia_dias > 0`.
- Remover o branch que herda o período geral do contrato.
- Resultado: o card "Carências por item" mostra exatamente o que foi configurado em "Configurações de Benefícios e Coberturas". Para o caso da tela enviada, vai aparecer **apenas** "Vidros e Faróis – 120 dias".

A carência geral do contrato (badge "Em carência" + "Início/Término" no topo do card) continua funcionando como hoje — não mexo nela. O ajuste é só no detalhamento por item.

### Patch resumido

```ts
const allCarenciaItems = [...(carenciasBeneficios || []), ...(carenciasCoberturas || [])];
const carenciasItens: CarenciaItem[] = (carenciaInicio && allCarenciaItems.length > 0)
  ? allCarenciaItems
      .filter(item => item.carenciaAtiva === true && (item.dias || 0) > 0)
      .map(item => {
        const inicio = new Date(carenciaInicio!);
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + item.dias);
        return {
          nome: item.nome,
          tipo: item.tipo,
          carenciaTipo: item.carenciaTipo,
          dias: item.dias,
          multiplicador: item.multiplicador,
          inicio: carenciaInicio!,
          fim: fim.toISOString().split('T')[0],
          emCarencia: fim > new Date(),
        };
      })
  : [];
```

---

## Impacto / Compatibilidade

- **Onde é usado**: hook `useAssociadoSituacao` → `AssociadoSituacaoCard` (ficha do associado). Não afeta cálculo de elegibilidade de evento, Hinova/SGA, regras de cobertura efetiva — esses caminhos têm suas próprias funções e não consomem `carenciasItens`.
- **Para os planos que de fato configurarem carência item-a-item** (ex.: ative `carencia_ativa=true` em algumas coberturas), o card continua mostrando esses itens corretamente, com os dias específicos.
- **Para planos com carência só geral** (sem nenhum item ativo), o bloco "Carências por item" simplesmente não renderiza (o componente já tem o `length > 0` guard) — a info de carência geral continua no topo do card.

## Fora do escopo (sugestões de follow-up, não nesta entrega)

- O App do Associado (`src/pages/app/AppPlano.tsx`) tem lógica própria de "Em carência — N dias restantes". Vale auditar depois se ele também herda período do contrato indevidamente. Posso abrir como tarefa separada.
- Considerar mostrar uma legenda ("Itens sem carência configurada são liberados desde a ativação") no card para deixar explícito ao atendimento.

## Arquivos editados

- `src/hooks/useAssociadoSituacao.ts` — única alteração.

## Como validar depois do deploy

1. Abrir a ficha do associado da tela enviada (consultora TAIANY, plano `Select One - Passeio 5%`).
2. Card "Carência" → bloco "Carências por item" deve listar **só** "Vidros e Faróis · Liberação · 120d · até 24/08/2026 · Em carência".
3. Os demais 16 itens não aparecem mais lá.
4. A badge "Em carência" do topo + datas Início/Término continuam aparecendo (carência geral do contrato).
