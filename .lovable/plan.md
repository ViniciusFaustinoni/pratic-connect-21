
# Plano: Diagnóstico e Correção do Erro de Token Bearer SGA Hinova

## ✅ IMPLEMENTADO

### Alterações Realizadas

#### 1. Backend: `supabase/functions/sga-hinova-sync/index.ts`

- **Logging melhorado**: Adicionado log dos primeiros 10 caracteres do Token Bearer para debug
- **Detecção de erro de Token Bearer**: Quando a autenticação do usuário funciona (retorna `token_usuario`) mas o cadastro falha com "Login ou senha inválido", o sistema agora detecta que o problema é o Token Bearer no header
- **Resposta específica**: Retorna `action_required: 'update_bearer_token'` para que o frontend possa mostrar orientação clara ao usuário

#### 2. Frontend: `src/components/ativacao/BotaoEnviarSGA.tsx`

- **Tratamento amigável**: Quando recebe `action_required: 'update_bearer_token'`, mostra toast com mensagem clara direcionando o usuário para Configurações > Integrações

---

## Próximos Passos (Ação do Usuário)

1. Acesse o **Painel Administrativo do SGA Hinova**
2. Navegue até **Configurações > API / Tokens**
3. **Gere um novo Token Bearer** com permissões completas
4. No sistema, acesse **Configurações > Integrações > SGA Hinova > Editar**
5. Cole o novo token no campo **Token**
6. Clique em **Salvar** e depois **Testar Conexão**
7. Tente novamente **Enviar para SGA** na tela de Ativações
