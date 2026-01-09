import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Loader2, Save, Mail, Phone, User, Trash2, Calendar, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import { maskTelefone } from '@/lib/validations';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export default function MeuPerfil() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Sync state when profile changes
  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setTelefone(profile.telefone || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  // Atualizar perfil
  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) {
        throw new Error('Nome é obrigatório');
      }
      if (!user?.id) {
        throw new Error('Usuário não encontrado');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          telefone: telefone || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Perfil atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['auth-user'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar perfil')
  });

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
      queryClient.invalidateQueries({ queryKey: ['auth-user'] });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingAvatar(false);
    }
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
      queryClient.invalidateQueries({ queryKey: ['auth-user'] });
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleTelefoneChange = (value: string) => {
    setTelefone(maskTelefone(value));
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Meu Perfil</h2>
        <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais</p>
      </div>

      {/* Foto de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Foto de Perfil
          </CardTitle>
          <CardDescription>Sua foto será exibida em todo o sistema</CardDescription>
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
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
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

      {/* Informações Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>Atualize seus dados de contato</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(); }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nome completo
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={profile?.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Informações da Conta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Informações da Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Tipo de Conta</Label>
              <p className="font-medium capitalize">{profile?.tipo || '-'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">CPF</Label>
              <p className="font-medium">{profile?.cpf || '-'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <div>
                <Badge 
                  variant={profile?.ativo ? 'default' : 'secondary'}
                  className={profile?.ativo ? 'bg-green-600' : ''}
                >
                  {profile?.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Membro desde
              </Label>
              <p className="font-medium">
                {formatDate(profile?.created_at)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={selectedImage || ''}
        onClose={() => {
          setCropDialogOpen(false);
          setSelectedImage(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
