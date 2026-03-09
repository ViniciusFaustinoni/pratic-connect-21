

# O Sistema NÃO Entende — Despacho é Exclusivo para Reboque/Guincho

## Problema Identificado

Existem **2 travas hardcoded** que impedem o despacho automático para outros tipos de assistência:

### Trava 1 — `criar-chamado-assistencia` (linha 335)
```
if (['reboque', 'guincho'].includes(payload.tipo_assistencia)) {
  // só dispara despacho para reboque/guincho
}
```
Chamados de `chaveiro`, `troca_pneu`, `pane_seca`, `bateria`, `outros` são criados mas **nenhum prestador é notificado**.

### Trava 2 — `despacho-reboque-disparar` (linhas 117-118)
```
const atendeReboque = p.tipos_servico?.some((t: string) =>
  ["reboque", "guincho"].includes(t.toLowerCase())
);
```
Mesmo se o despacho fosse disparado, só buscaria prestadores que atendem reboque/guincho.

### Trava 3 — Valores do prestador (linha 151)
```
if (v.tipo_servico === "reboque" || v.tipo_servico === "guincho" || ...)
```
Prioriza valores de reboque/guincho ao montar o mapa de preços.

---

## Plano de Correção

### 1. Generalizar o auto-despacho em `criar-chamado-assistencia`
- Remover o filtro `['reboque', 'guincho']` da linha 335
- Disparar despacho para **todos** os tipos de assistência
- Passar o `tipo_servico` do chamado para a função de despacho

### 2. Generalizar o filtro de prestadores em `despacho-reboque-disparar`
- Receber o `tipo_servico` do chamado como parâmetro (ou buscar do chamado)
- Filtrar prestadores cujo `tipos_servico` inclua o tipo do chamado (ex: `chaveiro` busca prestadores que atendem `chaveiro`)
- Buscar valores da tabela `prestadores_assistencia_valores` filtrando pelo `tipo_servico` correto

### 3. Adaptar a mensagem WhatsApp
- Já está parcialmente pronto: `tipoLabel` usa `chamado.tipo_servico` para montar o título
- Ajustar o texto da mensagem para ser genérico (ex: "NOVO CHAMADO - Chaveiro" ao invés de sempre "Reboque")

### Arquivos a editar
- `supabase/functions/criar-chamado-assistencia/index.ts` — remover filtro de tipo na linha 335
- `supabase/functions/despacho-reboque-disparar/index.ts` — generalizar filtro de prestadores e valores

Nenhuma mudança de banco de dados é necessária — as tabelas `prestadores_assistencia`, `prestadores_assistencia_valores` e `despacho_reboque` já suportam qualquer tipo de serviço.

