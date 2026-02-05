

## Plano de Implementação: Sincronização Segura de Email e Telefone do Associado

### Análise do Código Atual

**Arquivo:** `supabase/functions/contrato-gerar/index.ts`

**Situação identificada:**
- Linhas 174-178: Query que busca associado por CPF seleciona APENAS `id` (sem email/telefone)
- Linhas 180-183: Quando encontra associado existente, não sincroniza dados de contato
- Linhas 232-241: Mesmo problema quando busca por email

**Impacto:** Email antigo persiste no registro do associado, bloqueando login correto no formulário de criação de conta.

### Solução Implementada

#### 1. **Expandir Select do Associado Existente**

**Linhas 174-178** — Modificar para buscar também email e telefone:
```typescript
const { data: associadoExistente } = await supabase
  .from('associados')
  .select('id, email, telefone')  // ← Adicionar campos
  .eq('cpf', cpfLimpo)
  .maybeSingle();
```

Mesmo padrão para busca por email (linhas 233-237).

#### 2. **Adicionar Bloco de Sincronização Segura**

**Após linha 182** — Inserir lógica que:
- Cria objeto `updateData` vazio
- Valida se `emailFinal` é diferente e não-vazio → adiciona ao update
- Valida se `telefoneFinal` é diferente e não-vazio → adiciona ao update
- Executa `.update()` se houver mudanças
- Registra logs de auditoria
- **NÃO interrompe fluxo** se falhar

**Após linha 241** — Repetir mesma lógica para busca por email.

#### 3. **Dados Sincronizados**

| Campo | Ação | Motivo |
|-------|------|--------|
| Email | ✅ Atualiza | Crítico para login. Cliente acabou de preencher. |
| Telefone | ✅ Atualiza | Dado de contato direto. Cliente preencheu. |
| Endereço | ❌ Protegido | Pode ter sido preenchido por terceiro (corretor). |
| Data nasc. | ❌ Protegido | Dado imutável — não deve ser alterado. |

#### 4. **Validações de Segurança**

- Nunca sobrescreve com valores vazios (`trim() !== ''`)
- Apenas atualiza se valor novo é diferente do atual
- Todas alterações logadas com valores anteriores e novos
- Erros na atualização apenas logam, não quebram contrato

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/contrato-gerar/index.ts` | Expandir select + adicionar sincronização (linhas 174-178, 182-231, 233-289) |

### Fluxo Corrigido

```
1. Cliente cotação: viniciusfaustinoni@gmail.com
2. Sistema gera contrato
3. Encontra associado existente (CPF match)
4. ✅ Compara email anterior ≠ novo
5. ✅ Atualiza email do associado automaticamente
6. ✅ Registra log de auditoria
7. Associado ativado com email CORRETO
8. Formulário exibe email correto
9. Login funciona ✅
```

### Resultados Esperados

- ✅ Email sempre atualizado com cotação mais recente
- ✅ Telefone sempre atualizado com cotação mais recente
- ✅ Formulário de criação de conta exibe dados corretos
- ✅ Login do associado funciona
- ✅ Auditoria completa das alterações
- ✅ Sem risco de corrupção de endereço
- ✅ Fluxo de contrato não é interrompido

