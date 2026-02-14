import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUsuario, useUsuarioActions } from '@/hooks/useUsuarios';
import { GerenciarPerfisModal } from '@/components/usuarios/GerenciarPerfisModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar,
  Shield,
  User,
  Clock,
  KeyRound,
  UserX,
  UserCheck,
  Ban,
  Unlock,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPO_USUARIO_LABELS, PERFIL_ACESSO_LABELS, type PerfilAcesso } from '@/types/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================
// CORES DOS BADGES DE PERFIL
// ============================================
const PERFIL_COLORS: Record<PerfilAcesso, string> = {
  diretor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  gerente_comercial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  supervisor_vendas: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  vendedor_clt: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vendedor_externo: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  analista_cadastro: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  coordenador_monitoramento: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  analista_plataforma: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  instalador_vistoriador: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  vistoriador_base: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  associado: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  analista_marketing: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  analista_juridico: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  regulador: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  analista_eventos: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
};

// ============================================
// HELPER: Obter iniciais do nome
// ============================================
const getInitials = (nome: string) => {
  return nome
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

// ============================================
// HELPER: Mascarar CPF
// ============================================
const maskCPF = (cpf: string | null) => {
  if (!cpf) return '-';
  // Remove caracteres não numéricos e mascara
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length >= 7) {
    return `***.${numbers.slice(3, 6)}.***-**`;
  }
  return '***.***.***-**';
};

export default function UsuarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: usuario, isLoading, error } = useUsuario(id);
  const { 
    desativarUsuario, 
    ativarUsuario, 
    bloquearUsuario,
    desbloquearUsuario,
    resetarSenhaEmail,
    isLoading: actionLoading 
  } = useUsuarioActions();

  // Estado do dialog de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'desativar' | 'ativar' | 'bloquear' | 'desbloquear' | 'resetar';
  }>({ open: false, type: 'desativar' });

  // Estado do modal de perfis
  const [showPerfisModal, setShowPerfisModal] = useState(false);

  const handleConfirmAction = () => {
    if (!usuario) return;

    switch (confirmDialog.type) {
      case 'desativar':
        desativarUsuario(usuario.id);
        break;
      case 'ativar':
        ativarUsuario(usuario.id);
        break;
      case 'bloquear':
        bloquearUsuario({ profileId: usuario.id });
        break;
      case 'desbloquear':
        desbloquearUsuario(usuario.id);
        break;
      case 'resetar':
        resetarSenhaEmail(usuario.email);
        break;
    }

    setConfirmDialog({ open: false, type: 'desativar' });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !usuario) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">Usuário não encontrado</p>
            <Button variant="outline" onClick={() => navigate('/diretoria/usuarios')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusBadge = () => {
    if (usuario.bloqueado) {
      return <Badge variant="destructive" className="text-sm">Bloqueado</Badge>;
    }
    if (!usuario.ativo) {
      return <Badge variant="secondary" className="text-sm">Inativo</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm">Ativo</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
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
            <BreadcrumbPage>{usuario.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/diretoria/usuarios')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Avatar className="h-14 w-14">
            {usuario.avatar_url && <AvatarImage src={usuario.avatar_url} />}
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {getInitials(usuario.nome)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{usuario.nome}</h1>
            <p className="text-muted-foreground">Detalhes do usuário</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setConfirmDialog({ open: true, type: 'resetar' })}
            disabled={actionLoading}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Resetar Senha
          </Button>
          
          {usuario.ativo ? (
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: true, type: 'desativar' })}
              disabled={actionLoading}
              className="text-orange-600 hover:text-orange-700"
            >
              <UserX className="h-4 w-4 mr-2" />
              Desativar
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: true, type: 'ativar' })}
              disabled={actionLoading}
              className="text-green-600 hover:text-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Ativar
            </Button>
          )}

          {usuario.bloqueado ? (
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: true, type: 'desbloquear' })}
              disabled={actionLoading}
              className="text-green-600 hover:text-green-700"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Desbloquear
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={() => setConfirmDialog({ open: true, type: 'bloquear' })}
              disabled={actionLoading}
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados Principais */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <p className="text-lg font-medium">{usuario.nome}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tipo de Usuário</label>
                <p className="text-lg">
                  <Badge variant="outline">{TIPO_USUARIO_LABELS[usuario.tipo]}</Badge>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </label>
                <p>{usuario.email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone
                </label>
                <p>{usuario.telefone || '-'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">CPF</label>
                <p>{maskCPF(usuario.cpf)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">{getStatusBadge()}</div>
              </div>
            </div>

            {usuario.bloqueado && usuario.motivo_bloqueio && (
              <>
                <Separator />
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <label className="text-sm font-medium text-destructive">Motivo do Bloqueio</label>
                  <p className="text-destructive">{usuario.motivo_bloqueio}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data de Cadastro
                </label>
                <p className="text-sm">{formatDate(usuario.created_at)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Último Acesso
                </label>
                <p className="text-sm">{formatDate(usuario.data_ultimo_acesso)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perfis de Acesso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Perfis de Acesso
            </CardTitle>
            <CardDescription>
              Permissões atribuídas a este usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usuario.roles.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum perfil atribuído</p>
            ) : (
              <div className="space-y-2">
                {usuario.roles.map((perfil) => (
                  <div 
                    key={perfil} 
                    className={cn(
                      'p-3 rounded-lg',
                      PERFIL_COLORS[perfil]
                    )}
                  >
                    <p className="font-medium">{PERFIL_ACESSO_LABELS[perfil]}</p>
                  </div>
                ))}
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => setShowPerfisModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Gerenciar Perfis
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Gerenciamento de Perfis */}
      {usuario && (
        <GerenciarPerfisModal
          open={showPerfisModal}
          onOpenChange={setShowPerfisModal}
          usuario={usuario}
        />
      )}

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'desativar' && 'Desativar usuário'}
              {confirmDialog.type === 'ativar' && 'Ativar usuário'}
              {confirmDialog.type === 'bloquear' && 'Bloquear usuário'}
              {confirmDialog.type === 'desbloquear' && 'Desbloquear usuário'}
              {confirmDialog.type === 'resetar' && 'Resetar senha'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'desativar' && (
                <>Tem certeza que deseja desativar <strong>{usuario.nome}</strong>? O usuário não poderá mais acessar o sistema.</>
              )}
              {confirmDialog.type === 'ativar' && (
                <>Tem certeza que deseja ativar <strong>{usuario.nome}</strong>? O usuário poderá acessar o sistema novamente.</>
              )}
              {confirmDialog.type === 'bloquear' && (
                <>Tem certeza que deseja bloquear <strong>{usuario.nome}</strong>? O acesso será revogado imediatamente.</>
              )}
              {confirmDialog.type === 'desbloquear' && (
                <>Tem certeza que deseja desbloquear <strong>{usuario.nome}</strong>? O acesso será restaurado.</>
              )}
              {confirmDialog.type === 'resetar' && (
                <>Um email será enviado para <strong>{usuario.email}</strong> com instruções para redefinir a senha.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={actionLoading}>
              {actionLoading ? 'Aguarde...' : (
                <>
                  {confirmDialog.type === 'desativar' && 'Desativar'}
                  {confirmDialog.type === 'ativar' && 'Ativar'}
                  {confirmDialog.type === 'bloquear' && 'Bloquear'}
                  {confirmDialog.type === 'desbloquear' && 'Desbloquear'}
                  {confirmDialog.type === 'resetar' && 'Enviar email'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
