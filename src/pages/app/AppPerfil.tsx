import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Car,
  Shield,
  CalendarDays,
  Lock,
  LogOut,
  ChevronRight,
  Edit,
  Loader2,
  Eye,
  EyeOff,
  MessageCircle,
  Cake,
  Camera,
  Trash2,
  Bell,
  Moon,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAssociado, useMyVehicles, useUpdateAssociado } from '@/hooks/useMyData';
import { supabase } from '@/integrations/supabase/client';
import { CardPlano } from '@/components/app';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import { useUploadAvatar, useRemoveAvatar } from '@/hooks/useUploadAvatar';

const STATUS_VEICULO: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ativo: { label: 'Ativo', variant: 'default' },
  em_analise: { label: 'Em Análise', variant: 'secondary' },
  suspenso: { label: 'Suspenso', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'outline' },
  instalacao_pendente: { label: 'Instalação Pendente', variant: 'secondary' },
  sinistrado: { label: 'Sinistrado', variant: 'destructive' },
  aprovado: { label: 'Aprovado', variant: 'default' },
};

const COBERTURAS_RESUMIDAS = [
  'Roubo/Furto',
  'Colisão',
  'Assistência 24h',
  'Vidros',
  'Incêndio',
  'Alagamento'
];

export default function AppPerfil() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: associado, isLoading: associadoLoading, error: associadoError } = useMyAssociado();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const updateAssociado = useUpdateAssociado();

  // Proteção de rota adicional - redireciona se não autenticado
  useEffect(() => {
    if (!user && !associadoLoading) {
      navigate('/app/login');
    }
  }, [user, associadoLoading, navigate]);

  const [modalDadosPessoais, setModalDadosPessoais] = useState(false);
  const [modalEndereco, setModalEndereco] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);
  const [modalLogout, setModalLogout] = useState(false);
  const [notificacoes, setNotificacoes] = useState(true);
  
  // Estados para upload de avatar
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const isLoading = associadoLoading || vehiclesLoading;

  // Handler para seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    
    // Limpar input para permitir reselecionar mesmo arquivo
    e.target.value = '';
  };

  // Handler após crop
  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      await uploadAvatar.mutateAsync(croppedBlob);
      toast.success('Foto atualizada com sucesso!');
      setCropDialogOpen(false);
      setSelectedImage(null);
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      toast.error('Erro ao atualizar foto');
    }
  };

  // Handler para remover avatar
  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar.mutateAsync();
      toast.success('Foto removida com sucesso!');
      setConfirmRemoveAvatar(false);
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const getIniciais = (nome: string) => {
    const partes = nome.split(' ');
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.**-$4');
  };

  const formatDataAdesao = (data: string) => {
    try {
      return format(new Date(data), "MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return 'Data não disponível';
    }
  };

  const formatDataNascimento = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy');
    } catch {
      return data;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/app/login');
  };

  if (isLoading) {
    return <PerfilLoading />;
  }

  if (!associado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="bg-muted/30 rounded-full p-6 mb-4">
          <User className="h-16 w-16 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">Dados não encontrados</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Não foi possível carregar seus dados. Sua sessão pode ter expirado.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => {
              await signOut();
              navigate('/app/login');
            }}
          >
            Fazer login novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header com Avatar */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                {associado.avatar_url && (
                  <AvatarImage 
                    src={associado.avatar_url} 
                    alt={associado.nome}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                  {getIniciais(associado.nome)}
                </AvatarFallback>
              </Avatar>
              
              {/* Menu dropdown para avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="absolute -bottom-1 -right-1 p-1.5 bg-primary rounded-full 
                               text-primary-foreground cursor-pointer shadow-md
                               hover:bg-primary/90 transition-colors"
                    disabled={uploadAvatar.isPending || removeAvatar.isPending}
                  >
                    {(uploadAvatar.isPending || removeAvatar.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <label htmlFor="avatar-upload" className="cursor-pointer flex items-center">
                      <Camera className="h-4 w-4 mr-2" />
                      Alterar foto
                    </label>
                  </DropdownMenuItem>
                  {associado.avatar_url && (
                    <DropdownMenuItem 
                      onClick={() => setConfirmRemoveAvatar(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover foto
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Input file oculto */}
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploadAvatar.isPending}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground truncate">
                {associado.nome.split(' ').slice(0, 2).join(' ')}
              </h2>
              <p className="text-sm text-muted-foreground">
                CPF: {formatCpf(associado.cpf)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Associado desde {formatDataAdesao(associado.created_at)}
              </p>
            </div>
          </div>
          {associado.planos && (
            <div className="mt-4">
              <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                <Shield className="h-3 w-3 mr-1" />
                {associado.planos.nome}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Dados Pessoais */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Dados Pessoais
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setModalDadosPessoais(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={Mail} label="E-mail" value={associado.email} />
          <InfoRow icon={Phone} label="Telefone" value={associado.telefone || 'Não informado'} />
          <InfoRow icon={MessageCircle} label="WhatsApp" value={associado.whatsapp || associado.telefone || 'Não informado'} />
          {associado.data_nascimento && (
            <InfoRow icon={Cake} label="Data de Nascimento" value={formatDataNascimento(associado.data_nascimento)} />
          )}
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Endereço
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setModalEndereco(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {associado.logradouro ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {associado.logradouro}, {associado.numero}
              </p>
              {associado.complemento && (
                <p className="text-muted-foreground">{associado.complemento}</p>
              )}
              <p className="text-muted-foreground">{associado.bairro}</p>
              <p className="text-muted-foreground">
                {associado.cidade} - {associado.uf}
              </p>
              <p className="text-muted-foreground">CEP: {associado.cep}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Endereço não cadastrado</p>
          )}
        </CardContent>
      </Card>

      {/* Veículos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            Meus Veículos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {vehicles && vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <div 
                key={vehicle.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate(`/app/veiculos/${vehicle.id}`)}
              >
                <div>
                  <p className="text-lg font-bold tracking-wider text-foreground">
                    {vehicle.placa}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.marca} {vehicle.modelo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ano {vehicle.ano_fabricacao}/{vehicle.ano_modelo}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VEICULO[vehicle.status || 'em_analise']?.variant || 'secondary'}>
                    {STATUS_VEICULO[vehicle.status || 'em_analise']?.label || vehicle.status}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum veículo cadastrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plano */}
      {associado.planos ? (
        <Card 
          className="border-0 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => navigate('/app/plano')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Meu Plano
              </CardTitle>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium text-foreground">{associado.planos.nome}</p>
              <p className="text-sm text-muted-foreground capitalize">
                Tipo: {associado.planos.tipo_uso}
              </p>
          {associado.contratos && associado.contratos.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Mensalidade: R$ {(associado.contratos.find(c => c.status === 'ativo') || associado.contratos[0]).valor_mensal.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-sm text-muted-foreground">
                Associado desde: {formatDataAdesao((associado.contratos.find(c => c.status === 'ativo') || associado.contratos[0]).data_inicio)}
              </p>
            </>
          )}
            </div>
            
            {/* Coberturas Resumidas */}
            <div className="pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Coberturas incluídas:</p>
              <div className="flex flex-wrap gap-1">
                {COBERTURAS_RESUMIDAS.slice(0, 4).map((cobertura) => (
                  <Badge key={cobertura} variant="secondary" className="text-xs">
                    {cobertura}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs">
                  + mais
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center text-muted-foreground">
            Plano não definido
          </CardContent>
        </Card>
      )}

      {/* Segurança */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <button
            onClick={() => setModalSenha(true)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">Alterar Senha</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notificações</span>
            </div>
            <Switch checked={notificacoes} onCheckedChange={setNotificacoes} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Modo escuro</span>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      {/* Links de Ajuda */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 divide-y">
          <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Central de Ajuda</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Termos de Uso</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Política de Privacidade</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Botão Sair */}
      <Button
        variant="outline"
        className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => setModalLogout(true)}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair da Conta
      </Button>

      {/* Versão do App */}
      <p className="text-xs text-center text-muted-foreground py-4">
        Versão 2.0.0 • PRATIC Proteção Veicular
      </p>

      {/* Modal Editar Dados Pessoais */}
      <ModalEditarDadosPessoais
        open={modalDadosPessoais}
        onOpenChange={setModalDadosPessoais}
        associado={associado}
        onSave={updateAssociado.mutateAsync}
      />

      {/* Modal Editar Endereço */}
      <ModalEditarEndereco
        open={modalEndereco}
        onOpenChange={setModalEndereco}
        associado={associado}
        onSave={updateAssociado.mutateAsync}
      />

      {/* Modal Alterar Senha */}
      <ModalAlterarSenha
        open={modalSenha}
        onOpenChange={setModalSenha}
      />

      {/* Dialog Confirmar Logout */}
      <AlertDialog open={modalLogout} onOpenChange={setModalLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará fazer login novamente para acessar o app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Crop do Avatar */}
      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={selectedImage}
        onClose={() => {
          setCropDialogOpen(false);
          setSelectedImage(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Dialog Confirmar Remoção de Avatar */}
      <AlertDialog open={confirmRemoveAvatar} onOpenChange={setConfirmRemoveAvatar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover foto de perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua foto será removida e as iniciais do seu nome serão exibidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveAvatar}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeAvatar.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Componente auxiliar para linhas de informação
function InfoRow({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// Modal Editar Dados Pessoais
function ModalEditarDadosPessoais({ 
  open, 
  onOpenChange,
  associado,
  onSave
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: any;
  onSave: (data: any) => Promise<void>;
}) {
  const [nome, setNome] = useState(associado.nome);
  const [email, setEmail] = useState(associado.email);
  const [telefone, setTelefone] = useState(associado.telefone || '');
  const [whatsapp, setWhatsapp] = useState(associado.whatsapp || '');
  const [dataNascimento, setDataNascimento] = useState<Date | undefined>(
    associado.data_nascimento 
      ? new Date(associado.data_nascimento) 
      : undefined
  );
  const [salvando, setSalvando] = useState(false);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSalvar = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }

    if (!isValidEmail(email.trim())) {
      toast.error('E-mail inválido');
      return;
    }

    setSalvando(true);
    try {
      await onSave({ 
        nome, 
        email, 
        telefone, 
        whatsapp,
        data_nascimento: dataNascimento 
          ? format(dataNascimento, 'yyyy-MM-dd') 
          : null
      });
      toast.success('Dados atualizados com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Dados Pessoais</DialogTitle>
          <DialogDescription>
            Atualize suas informações de contato
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataNascimento && "text-muted-foreground"
                  )}
                >
                  <Cake className="mr-2 h-4 w-4" />
                  {dataNascimento 
                    ? format(dataNascimento, "dd/MM/yyyy") 
                    : "Selecione uma data"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataNascimento}
                  onSelect={setDataNascimento}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Modal Editar Endereço
function ModalEditarEndereco({ 
  open, 
  onOpenChange,
  associado,
  onSave
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: any;
  onSave: (data: any) => Promise<void>;
}) {
  const [cep, setCep] = useState(associado.cep || '');
  const [logradouro, setLogradouro] = useState(associado.logradouro || '');
  const [numero, setNumero] = useState(associado.numero || '');
  const [complemento, setComplemento] = useState(associado.complemento || '');
  const [bairro, setBairro] = useState(associado.bairro || '');
  const [cidade, setCidade] = useState(associado.cidade || '');
  const [uf, setUf] = useState(associado.uf || '');
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const buscarCep = async (cepValue: string) => {
    const cepLimpo = cepValue.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setLogradouro(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setUf(data.uf || '');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSalvar = async () => {
    if (!logradouro.trim() || !numero.trim() || !cidade.trim() || !uf.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSalvando(true);
    try {
      await onSave({ cep, logradouro, numero, complemento, bairro, cidade, uf });
      toast.success('Endereço atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao atualizar endereço');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Endereço</DialogTitle>
          <DialogDescription>
            Atualize seu endereço de correspondência
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <div className="relative">
              <Input
                id="cep"
                value={cep}
                onChange={(e) => {
                  const value = e.target.value;
                  setCep(value);
                  if (value.replace(/\D/g, '').length === 8) {
                    buscarCep(value);
                  }
                }}
                placeholder="00000-000"
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logradouro">Logradouro</Label>
            <Input
              id="logradouro"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Modal Alterar Senha
function ModalAlterarSenha({ 
  open, 
  onOpenChange 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSalvar = async () => {
    setErro('');

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setErro('Preencha todos os campos');
      return;
    }

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem');
      return;
    }

    setSalvando(true);
    
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      
      if (error) throw error;
      
      toast.success('Senha alterada com sucesso!');
      onOpenChange(false);
      
      // Limpar campos
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      setErro(error.message || 'Erro ao alterar senha');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Digite sua senha atual e a nova senha
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {erro && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {erro}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="senhaAtual">Senha Atual</Label>
            <div className="relative">
              <Input
                id="senhaAtual"
                type={mostrarSenhas ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="novaSenha">Nova Senha</Label>
            <Input
              id="novaSenha"
              type={mostrarSenhas ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
            <Input
              id="confirmarSenha"
              type={mostrarSenhas ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mostrarSenhas"
              checked={mostrarSenhas}
              onChange={(e) => setMostrarSenhas(e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="mostrarSenhas" className="text-sm font-normal cursor-pointer">
              Mostrar senhas
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Alterar Senha'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Loading state
function PerfilLoading() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
