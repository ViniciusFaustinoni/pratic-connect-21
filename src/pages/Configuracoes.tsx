import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Bell, Building, Loader2, Camera, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { maskTelefone } from '@/lib/validations';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';

export default function Configuracoes() {
  const { profile, user } = useAuth();

  // Profile form state
  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Arquivo muito grande. Máximo 2MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Convert to base64 and open crop dialog
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

      // Upload cropped file (upsert to replace existing)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile
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
      // List files in user folder
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id);

      // Delete all avatar files for this user
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(filePaths);
      }

      // Update profile
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>Suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar Upload Section */}
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-4">
              <UserAvatar src={avatarUrl} name={nome || profile?.nome} size="xl" />
              <div className="flex flex-wrap justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
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

            <Separator />

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
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Altere sua senha de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
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
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Configure como deseja receber notificações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos leads</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificação quando um novo lead for atribuído
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Documentos pendentes</p>
                  <p className="text-sm text-muted-foreground">
                    Alerta quando houver documentos para análise
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Resumo diário</p>
                  <p className="text-sm text-muted-foreground">
                    Receber resumo das atividades por email
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informações da Empresa
            </CardTitle>
            <CardDescription>Dados da associação (somente leitura)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Razão Social</Label>
              <Input value="Associação de Proteção Veicular PRATIC" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value="00.000.000/0001-00" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Versão do Sistema</Label>
              <Input value="SGA PRATIC 2.0" disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>
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
