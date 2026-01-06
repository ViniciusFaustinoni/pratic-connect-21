import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUsuario, useUsuarioActions } from '@/hooks/useUsuarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Save, Lock, AlertCircle } from 'lucide-react';
import { TIPO_USUARIO_LABELS, type TipoUsuario } from '@/types/auth';

// ============================================
// SCHEMA DE VALIDAÇÃO
// ============================================
const usuarioSchema = z.object({
  nome: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(255, 'Nome muito longo'),
  email: z
    .string()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  telefone: z
    .string()
    .max(20, 'Telefone muito longo')
    .optional()
    .or(z.literal('')),
  tipo: z.enum(['funcionario', 'associado', 'prestador'], {
    required_error: 'Selecione o tipo de usuário',
  }),
  ativo: z.boolean(),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

// ============================================
// UTILITÁRIOS
// ============================================
const maskCPF = (cpf: string | null) => {
  if (!cpf) return '—';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length >= 6) {
    return `***.${cleaned.slice(3, 6)}.***-**`;
  }
  return '***.***.***-**';
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function UsuarioEditarPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Buscar usuário
  const { data: usuario, isLoading, error } = useUsuario(id);
  
  // Ações
  const { atualizarUsuario, isUpdating } = useUsuarioActions();

  // Form
  const form = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      tipo: 'funcionario',
      ativo: true,
    },
  });

  // Preencher form quando usuário carregar
  useEffect(() => {
    if (usuario) {
      form.reset({
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone || '',
        tipo: usuario.tipo as TipoUsuario,
        ativo: usuario.ativo,
      });
    }
  }, [usuario, form]);

  // ============================================
  // HANDLERS
  // ============================================
  const onSubmit = (data: UsuarioFormData) => {
    if (!id) return;

    atualizarUsuario(
      { 
        id, 
        data: {
          nome: data.nome,
          email: data.email,
          telefone: data.telefone || null,
          tipo: data.tipo,
          ativo: data.ativo,
        }
      },
      {
        onSuccess: () => {
          navigate(`/diretoria/usuarios/${id}`);
        },
      }
    );
  };

  const handleCancel = () => {
    navigate(`/diretoria/usuarios/${id}`);
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !usuario) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Usuário não encontrado</h2>
          <p className="text-muted-foreground">
            O usuário solicitado não existe ou foi removido.
          </p>
          <Button onClick={() => navigate('/diretoria/usuarios')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* BREADCRUMB */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/diretoria">Diretoria</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/diretoria/usuarios">Usuários</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/diretoria/usuarios/${id}`}>{usuario.nome}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Editar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* BOTÃO VOLTAR */}
      <div>
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/diretoria/usuarios/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Editar Usuário</h1>
        <p className="text-muted-foreground">
          Atualize as informações do usuário
        </p>
      </div>

      {/* FORMULÁRIO */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* CARD: INFORMAÇÕES PESSOAIS */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Dados básicos do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Nome */}
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email e Telefone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="email@exemplo.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* CPF (somente leitura) */}
              <div className="space-y-2">
                <FormLabel>CPF (somente leitura)</FormLabel>
                <div className="flex items-center gap-2">
                  <Input 
                    value={maskCPF(usuario.cpf)} 
                    disabled 
                    className="bg-muted"
                  />
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  O CPF não pode ser alterado após o cadastro
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CARD: CONFIGURAÇÕES DA CONTA */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Conta</CardTitle>
              <CardDescription>
                Tipo e status do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Tipo de usuário */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de usuário *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TIPO_USUARIO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status ativo/inativo */}
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Usuário ativo</FormLabel>
                      <FormDescription>
                        {field.value 
                          ? 'O usuário pode acessar o sistema' 
                          : 'O usuário não pode acessar o sistema'}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* AÇÕES */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-end gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
