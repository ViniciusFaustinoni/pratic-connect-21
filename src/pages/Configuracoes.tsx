import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, Lock, Bell, Building, Settings, Loader2, Camera, Trash2, Check,
  Save, Monitor, Smartphone, Mail, MessageCircle, Globe, FileText, Shield,
  Eye, EyeOff, Circle, CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { maskTelefone } from '@/lib/validations';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import { ConfiguracaoEvolutionURL, WhatsAppStatusCard } from '@/components/whatsapp';

type NotifType = 'notif_novos_leads' | 'notif_documentos_pendentes' | 'notif_resumo_diario';

interface Tab {
  id: string;
  nome: string;
  icon: React.ComponentType<{ className?: string }>;
  descricao: string;
}

const abas: Tab[] = [
  { id: 'perfil', nome: 'Meu Perfil', icon: User, descricao: 'Dados pessoais e foto' },
  { id: 'seguranca', nome: 'Segurança', icon: Lock, descricao: 'Senha e autenticação' },
  { id: 'notificacoes', nome: 'Notificações', icon: Bell, descricao: 'Alertas e avisos' },
  { id: 'whatsapp', nome: 'WhatsApp', icon: MessageCircle, descricao: 'Conexão e integração' },
  { id: 'empresa', nome: 'Empresa', icon: Building, descricao: 'Dados da associação' },
  { id: 'sistema', nome: 'Sistema', icon: Settings, descricao: 'Preferências gerais' },
];

export default function Configuracoes() {
  const { profile, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('perfil');

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Profile form state
  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences state
  const [notifNovosLeads, setNotifNovosLeads] = useState(false);
  const [notifDocumentos, setNotifDocumentos] = useState(false);
  const [notifResumoDiario, setNotifResumoDiario] = useState(false);
  const [savingNotif, setSavingNotif] = useState<NotifType | null>(null);

  // Load notification preferences from profile
  useEffect(() => {
    if (profile) {
      setNotifNovosLeads((profile as any).notif_novos_leads ?? false);
      setNotifDocumentos((profile as any).notif_documentos_pendentes ?? false);
      setNotifResumoDiario((profile as any).notif_resumo_diario ?? false);
    }
  }, [profile]);

  const toggleNotificacao = async (
    tipo: NotifType,
    valorAtual: boolean,
    setValor: (v: boolean) => void
  ) => {
    if (!user?.id) return;
    
    setSavingNotif(tipo);
    const novoValor = !valorAtual;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [tipo]: novoValor, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setValor(novoValor);
      toast.success(novoValor ? 'Notificação ativada' : 'Notificação desativada');
    } catch (error) {
      console.error('Erro ao salvar preferência:', error);
      toast.error('Erro ao salvar preferência');
    } finally {
      setSavingNotif(null);
    }
  };

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Arquivo muito grande. Máximo 2MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropDialogOpen(false);
    setSelectedImage(null);

    if (!user?.id) {
      toast.error('Usuário não encontrado');
      return;
    }

    setUploadingAvatar(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCropDialogClose = () => {
    setCropDialogOpen(false);
    setSelectedImage(null);
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id || !avatarUrl) return;

    setRemovingAvatar(true);
    try {
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(filePaths);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      setAvatarUrl(null);
      toast.success('Foto removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não encontrado');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          telefone: telefone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!novaSenha || !confirmarSenha) {
      toast.error('Preencha todos os campos de senha');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast.error(error?.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleTelefoneChange = (value: string) => {
    setTelefone(maskTelefone(value));
  };

  // Password validation helpers
  const hasMinLength = novaSenha.length >= 6;
  const hasUppercase = /[A-Z]/.test(novaSenha);
  const hasNumber = /[0-9]/.test(novaSenha);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      {/* Mobile: Horizontal tabs */}
      <div className="md:hidden flex overflow-x-auto gap-2 pb-2 -mx-4 px-4">
        {abas.map(aba => {
          const Icon = aba.icon;
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                abaAtiva === aba.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon className="h-4 w-4" />
              {aba.nome}
            </button>
          );
        })}
      </div>

      {/* Main container */}
      <div className="flex gap-6">
        {/* Desktop: Sidebar navigation */}
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="sticky top-4 space-y-1 rounded-lg bg-muted/30 p-2">
            {abas.map(aba => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    abaAtiva === aba.id 
                      ? 'bg-background shadow-sm border border-border text-primary' 
                      : 'hover:bg-background/50 text-muted-foreground'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${abaAtiva === aba.id ? 'text-primary' : ''}`} />
                  <div>
                    <p className={`font-medium text-sm ${abaAtiva === aba.id ? 'text-foreground' : ''}`}>
                      {aba.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">{aba.descricao}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tab content */}
        <main className="flex-1 min-w-0">
          {/* Aba Perfil */}
          {abaAtiva === 'perfil' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Meu Perfil</h2>
                <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais</p>
              </div>

              {/* Photo Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Foto de Perfil</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <UserAvatar src={avatarUrl} name={nome || profile?.nome} size="xl" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                        disabled={uploadingAvatar || removingAvatar}
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar || removingAvatar}
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="mr-2 h-4 w-4" />
                          )}
                          {uploadingAvatar ? 'Enviando...' : 'Alterar foto'}
                        </Button>
                        {avatarUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemoveAvatar}
                            disabled={uploadingAvatar || removingAvatar}
                            className="text-destructive hover:text-destructive"
                          >
                            {removingAvatar ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            {removingAvatar ? 'Removendo...' : 'Remover'}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou WebP. Máximo 2MB.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Personal Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações Pessoais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome completo</Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={(e) => handleTelefoneChange(e.target.value)}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={profile?.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar alterações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aba Segurança */}
          {abaAtiva === 'seguranca' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Segurança</h2>
                <p className="text-sm text-muted-foreground">Gerencie sua senha e configurações de acesso</p>
              </div>

              {/* Change Password Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">Alterar Senha</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">Última alteração há 30 dias</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="senha-atual">Senha atual</Label>
                    <div className="relative">
                      <Input
                        id="senha-atual"
                        type={showSenhaAtual ? 'text' : 'password'}
                        value={senhaAtual}
                        onChange={(e) => setSenhaAtual(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nova-senha">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="nova-senha"
                        type={showNovaSenha ? 'text' : 'password'}
                        value={novaSenha}
                        onChange={(e) => setNovaSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNovaSenha(!showNovaSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                    <Input
                      id="confirmar-senha"
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                    />
                  </div>

                  {/* Password requirements */}
                  {novaSenha && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">A senha deve conter:</p>
                      <div className="grid gap-1 text-xs">
                        <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {hasMinLength ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          Mínimo 6 caracteres
                        </div>
                        <div className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {hasUppercase ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          Uma letra maiúscula
                        </div>
                        <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {hasNumber ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          Um número
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />
                  <div className="flex justify-end">
                    <Button onClick={handleChangePassword} disabled={savingPassword}>
                      {savingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Alterar senha
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Active Sessions Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Sessões Ativas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current session */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Monitor className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Este dispositivo</p>
                        <p className="text-xs text-muted-foreground">Chrome • Windows • Agora</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Atual
                    </Badge>
                  </div>

                  {/* Other session example */}
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">iPhone 12</p>
                        <p className="text-xs text-muted-foreground">Safari • iOS • Há 2 dias</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      Encerrar
                    </Button>
                  </div>

                  <Separator />
                  <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                    Encerrar todas as outras sessões
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aba Notificações */}
          {abaAtiva === 'notificacoes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Notificações</h2>
                <p className="text-sm text-muted-foreground">Configure como deseja receber alertas</p>
              </div>

              {/* System Notifications Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notificações do Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* Novos leads */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Novos leads</p>
                        <p className="text-xs text-muted-foreground">
                          Receber notificação quando um novo lead for atribuído
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifNovosLeads}
                      onCheckedChange={() => toggleNotificacao('notif_novos_leads', notifNovosLeads, setNotifNovosLeads)}
                      disabled={savingNotif === 'notif_novos_leads'}
                    />
                  </div>
                  <Separator />

                  {/* Documentos pendentes */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <FileText className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Documentos pendentes</p>
                        <p className="text-xs text-muted-foreground">
                          Alerta quando houver documentos para análise
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifDocumentos}
                      onCheckedChange={() => toggleNotificacao('notif_documentos_pendentes', notifDocumentos, setNotifDocumentos)}
                      disabled={savingNotif === 'notif_documentos_pendentes'}
                    />
                  </div>
                  <Separator />

                  {/* Resumo diário */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Mail className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Resumo diário</p>
                        <p className="text-xs text-muted-foreground">
                          Receber resumo das atividades por email
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifResumoDiario}
                      onCheckedChange={() => toggleNotificacao('notif_resumo_diario', notifResumoDiario, setNotifResumoDiario)}
                      disabled={savingNotif === 'notif_resumo_diario'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notification Channels Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Canais de Notificação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Push</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Email</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">WhatsApp</span>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aba WhatsApp */}
          {abaAtiva === 'whatsapp' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Configurações WhatsApp</h2>
                <p className="text-sm text-muted-foreground">Configure a integração com WhatsApp via Evolution API</p>
              </div>

              <ConfiguracaoEvolutionURL />
              
              <WhatsAppStatusCard />
            </div>
          )}

          {/* Aba Empresa */}
          {abaAtiva === 'empresa' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Informações da Empresa</h2>
                <p className="text-sm text-muted-foreground">Dados da associação (somente leitura)</p>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {/* Company header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                      P
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">PRATIC</h3>
                      <p className="text-sm text-muted-foreground">Associação de Proteção Veicular</p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Company data */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Razão Social</Label>
                      <p className="font-medium">Associação de Proteção Veicular PRATIC</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">CNPJ</Label>
                      <p className="font-medium">00.000.000/0001-00</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Endereço</Label>
                      <p className="font-medium">Av. Brasil, 1000 - Centro</p>
                      <p className="text-sm text-muted-foreground">Uberlândia - MG, 38400-000</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Telefone</Label>
                      <p className="font-medium">(34) 3222-1111</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="font-medium">contato@praticcar.org</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aba Sistema */}
          {abaAtiva === 'sistema' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Sistema</h2>
                <p className="text-sm text-muted-foreground">Preferências gerais do sistema</p>
              </div>

              {/* Language Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Idioma e Região</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">🇧🇷 Português (Brasil)</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Fuso horário</Label>
                      <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Brasília (GMT-3)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* About Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sobre o Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Versão</Label>
                      <p className="font-medium">SGA PRATIC 2.0.1</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Última atualização</Label>
                      <p className="font-medium">03/01/2026</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Ambiente</Label>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Produção
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Termos de Uso
                    </Button>
                    <Button variant="outline" size="sm">
                      <Shield className="mr-2 h-4 w-4" />
                      Privacidade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={selectedImage}
        onClose={handleCropDialogClose}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
