import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIntegracaoCredenciais, IntegracaoTipo } from '@/hooks/useIntegracaoCredenciais';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Save, TestTube, Trash2, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfigurarIntegracaoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integracao: IntegracaoTipo;
  nomeExibicao: string;
  onSuccess?: () => void;
  initialValues?: Record<string, string>;
  onValuesChange?: (values: Record<string, string>) => void;
}

// Campos por integração (fallback caso o schema não carregue)
const camposPorIntegracao: Record<IntegracaoTipo, { nome: string; label: string; tipo: 'text' | 'password'; obrigatorio: boolean }[]> = {
  hinova: [
    { nome: 'token', label: 'Token Bearer (gerado no SGA)', tipo: 'password', obrigatorio: true },
    { nome: 'usuario', label: 'Usuário do SGA', tipo: 'text', obrigatorio: true },
    { nome: 'senha', label: 'Senha do SGA', tipo: 'password', obrigatorio: true },
    { nome: 'codigo_conta', label: 'Código da Conta (se mais de uma)', tipo: 'text', obrigatorio: false },
    { nome: 'codigo_voluntario', label: 'Código Voluntário', tipo: 'text', obrigatorio: false },
  ],
  softruck: [
    { nome: 'public_key', label: 'Public Key', tipo: 'password', obrigatorio: true },
    { nome: 'username', label: 'Usuário', tipo: 'text', obrigatorio: true },
    { nome: 'password', label: 'Senha', tipo: 'password', obrigatorio: true },
    { nome: 'enterprise_id', label: 'Enterprise ID (opcional)', tipo: 'text', obrigatorio: false },
  ],
  rede_veiculos: [
    { nome: 'bearer_token', label: 'Token Bearer', tipo: 'password', obrigatorio: true },
  ],
  asaas: [
    { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
    { nome: 'ambiente', label: 'Ambiente (production/sandbox)', tipo: 'text', obrigatorio: false },
  ],
  autentique: [
    { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
  ],
  resend: [
    { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
  ],
  whatsapp: [
    { nome: 'api_key', label: 'API Key Evolution', tipo: 'password', obrigatorio: true },
    { nome: 'api_url', label: 'URL da API Evolution', tipo: 'text', obrigatorio: true },
  ],
};

export function ConfigurarIntegracaoSheet({
  open,
  onOpenChange,
  integracao,
  nomeExibicao,
  onSuccess,
  initialValues = {},
  onValuesChange,
}: ConfigurarIntegracaoSheetProps) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [camposVisiveis, setCamposVisiveis] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    schema,
    status,
    isLoading,
    configurado,
    salvar,
    isSaving,
    remover,
    isRemoving,
    testar,
    isTesting,
  } = useIntegracaoCredenciais({ integracao });

  // Usar schema do servidor ou fallback local
  const campos = schema?.campos || camposPorIntegracao[integracao] || [];

  // Carregar initialValues quando o sheet abrir ou a integração mudar
  useEffect(() => {
    if (open) {
      // Carregar valores iniciais do rascunho (se houver)
      setValores(initialValues);
      setCamposVisiveis({});
    }
  }, [open, integracao, initialValues]);

  const handleChange = useCallback((campo: string, valor: string) => {
    setValores(prev => {
      const novosValores = { ...prev, [campo]: valor };
      // Notificar o componente pai sobre a mudança
      onValuesChange?.(novosValores);
      return novosValores;
    });
  }, [onValuesChange]);

  const toggleVisibilidade = (campo: string) => {
    setCamposVisiveis(prev => ({ ...prev, [campo]: !prev[campo] }));
  };

  const handleSalvar = async () => {
    try {
      // Enviar apenas campos que têm valor (para suportar update parcial)
      const credenciaisParaEnviar: Record<string, string> = {};
      for (const [key, value] of Object.entries(valores)) {
        if (value && value.trim() !== '') {
          credenciaisParaEnviar[key] = value;
        }
      }
      await salvar(credenciaisParaEnviar);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  const handleTestar = async () => {
    await testar(valores);
  };

  const handleRemover = async () => {
    try {
      await remover();
      setDeleteDialogOpen(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  // Verificar se pode salvar
  // Se NÃO está configurado: exigir todos os obrigatórios
  // Se JÁ está configurado: permitir salvar se ao menos 1 campo preenchido (update parcial)
  const podeSalvar = (() => {
    const temAlgumValor = Object.values(valores).some(v => v && v.trim() !== '');
    
    if (!configurado) {
      // Nova configuração: todos obrigatórios precisam estar preenchidos
      return campos
        .filter(c => c.obrigatorio)
        .every(c => valores[c.nome]?.trim());
    } else {
      // Update: basta ter ao menos um campo com valor
      return temAlgumValor;
    }
  })();

  // Verificar se os campos estão vazios (para mostrar mensagem de update parcial)
  const camposVazios = !Object.values(valores).some(v => v && v.trim() !== '');

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configurar {nomeExibicao}</SheetTitle>
            <SheetDescription>
              Preencha as credenciais para conectar com {nomeExibicao}
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Status atual */}
              {status && (
                <div className={cn(
                  "p-4 rounded-lg border",
                  status.teste_sucesso 
                    ? "bg-green-500/10 border-green-500/30" 
                    : status.teste_sucesso === false
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-muted border-border"
                )}>
                  <div className="flex items-center gap-2">
                    {status.teste_sucesso ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : status.teste_sucesso === false ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : null}
                    <div>
                      <p className="font-medium text-sm">
                        {status.teste_sucesso 
                          ? 'Conexão testada com sucesso!' 
                          : status.teste_sucesso === false
                            ? 'Última tentativa falhou'
                            : 'Credenciais salvas, teste pendente'}
                      </p>
                      {status.testado_em && (
                        <p className="text-xs text-muted-foreground">
                          Último teste: {formatDistanceToNow(new Date(status.testado_em), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                      {status.teste_mensagem && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {status.teste_mensagem}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensagem de update parcial quando já configurado e campos vazios */}
              {configurado && camposVazios && (
                <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-blue-600 dark:text-blue-400">
                        Credenciais já salvas
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Para alterar, digite apenas o(s) campo(s) que deseja atualizar e clique em Salvar. 
                        Os demais campos serão mantidos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulário de campos */}
              <div className="space-y-4">
                {campos.map((campo) => (
                  <div key={campo.nome} className="space-y-2">
                    <Label htmlFor={campo.nome}>
                      {campo.label}
                      {campo.obrigatorio && !configurado && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        id={campo.nome}
                        type={campo.tipo === 'password' && !camposVisiveis[campo.nome] ? 'password' : 'text'}
                        value={valores[campo.nome] || ''}
                        onChange={(e) => handleChange(campo.nome, e.target.value)}
                        placeholder={configurado ? '••••••••' : `Digite ${campo.label.toLowerCase()}`}
                        className="pr-10"
                      />
                      {campo.tipo === 'password' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => toggleVisibilidade(campo.nome)}
                        >
                          {camposVisiveis[campo.nome] ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dica de segurança */}
              <p className="text-xs text-muted-foreground">
                🔒 As credenciais são criptografadas com AES-256-GCM antes de serem armazenadas.
              </p>

              {/* Ações */}
              <div className="flex flex-col gap-3 pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleTestar}
                    disabled={isTesting || isSaving || (!configurado && !podeSalvar)}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSalvar}
                    disabled={!podeSalvar || isSaving || isTesting}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>

                {configurado && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isRemoving}
                  >
                    {isRemoving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Remover Credenciais
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação para remover */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover credenciais?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover as credenciais de {nomeExibicao} do sistema. 
              A integração deixará de funcionar até que novas credenciais sejam configuradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemover}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
