
# Correções: Agendamento de Vistoria e Area do Regulador

## Problema 1 — Notificacao ao regulador apos agendamento

A edge function `agendar-vistoria-evento` cria a vistoria com sucesso mas nao notifica nenhum regulador. Apos o associado confirmar o agendamento, o regulador deveria receber uma notificacao (sistema interno + opcionalmente WhatsApp) informando sobre a nova vistoria.

### Solucao

Adicionar chamada ao `disparar-notificacao` (edge function centralizada existente) na edge function `agendar-vistoria-evento`, apos criar a vistoria com sucesso. A notificacao sera enviada a todos os usuarios com role `regulador`.

Modificar: `supabase/functions/agendar-vistoria-evento/index.ts`

Apos a linha que faz update do `sinistro_evento_links` (etapa4_completada_em), adicionar:

1. Buscar dados do sinistro (associado nome, veiculo placa) para compor a mensagem
2. Buscar usuarios com role `regulador` da tabela `user_roles`
3. Para cada regulador, inserir notificacao na tabela de notificacoes do sistema (se existir) ou chamar `disparar-notificacao`
4. A mensagem sera: "Nova vistoria de evento agendada para [data] as [horario] - [Associado] - [Placa] - [Endereco]"

---

## Problema 2 — Fallback de tipo hardcoded "Colisao"

No arquivo `src/pages/regulador/ReguladorVistorias.tsx`, linha 112, o fallback do tipo do evento e `'Colisao'` quando deveria ser generico.

### Solucao

Modificar: `src/pages/regulador/ReguladorVistorias.tsx`

Trocar:
```text
{v.sinistro?.tipo || 'Colisão'}
```
Por:
```text
{v.sinistro?.tipo?.replace(/_/g, ' ') || 'Evento'}
```

Isso alinha com a correcao ja feita no `EventoColisao.tsx` e garante que tipos como `fenomeno_natural` aparecem como "fenomeno natural".

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `supabase/functions/agendar-vistoria-evento/index.ts` — adicionar notificacao ao regulador |
| Modificar | `src/pages/regulador/ReguladorVistorias.tsx` — corrigir fallback do tipo |

## Detalhes Tecnicos

Na edge function, apos o bloco de update do link (linha ~158), sera adicionado:

```text
// Buscar dados do sinistro para a notificacao
const { data: sinistroData } = await supabase
  .from("sinistros")
  .select("protocolo, associado:associados(nome), veiculo:veiculos(placa)")
  .eq("id", link.sinistro_id)
  .single();

// Buscar reguladores
const { data: reguladores } = await supabase
  .from("user_roles")
  .select("user_id")
  .eq("role", "regulador");

// Inserir notificacao para cada regulador
if (reguladores?.length) {
  const notificacoes = reguladores.map(r => ({
    user_id: r.user_id,
    titulo: "Nova Vistoria de Evento Agendada",
    mensagem: `${sinistroData?.associado?.nome} - ${sinistroData?.veiculo?.placa} - ${data_agendada} as ${horario_agendado} - ${endereco?.rua}, ${endereco?.bairro}`,
    tipo: "vistoria_evento",
    lida: false,
  }));
  await supabase.from("notificacoes").insert(notificacoes);
}
```

Se a tabela `notificacoes` nao existir, sera usada a edge function `disparar-notificacao` existente como alternativa.
