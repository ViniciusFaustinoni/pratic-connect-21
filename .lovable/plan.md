

# Corrigir erro "Edge Function returned a non-2xx status code" na localizacao

## Causa raiz

A edge function `atribuir-proxima-tarefa` busca o perfil do profissional com:
```
.from('profiles').select(...).eq('id', profissionalId).single()
```

Mas `profissionalId` vem de `user.id` (auth), e para o Rafael (e possivelmente outros usuarios), `profiles.id != auth.user.id`. O campo correto e `profiles.user_id`.

Isso causa o erro 400 "Perfil nao encontrado no sistema" que aparece como "Edge Function returned a non-2xx status code" no app.

## Correcao

**Arquivo**: `supabase/functions/atribuir-proxima-tarefa/index.ts`

Linha 184: trocar `.eq('id', profissionalId)` por `.eq('user_id', profissionalId)`.

Alem disso, verificar todas as outras queries na mesma funcao que usam `profissionalId` como `profiles.id` — especialmente as queries em `vistoriadores_localizacao`, `turnos_profissionais`, `servicos`, e `alocacoes_diarias` — para garantir que o campo correto (`vistoriador_id` ou `profissional_id`) corresponda ao `user_id` e nao ao `profiles.id`.

Tambem precisa ajustar o `profile.id` retornado para que o restante da funcao (que usa `profissionalId` para queries em servicos, turnos, etc.) use o valor correto conforme o schema de cada tabela.

