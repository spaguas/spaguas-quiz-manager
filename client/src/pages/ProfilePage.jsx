import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const ProfilePage = () => {
  const { user, updateProfile, changePassword, fetchProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name ?? '', email: user.email ?? '' });
    }
  }, [user]);

  useEffect(() => {
    fetchProfile().catch(() => {});
  }, [fetchProfile]);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    const trimmedName = profileForm.name.trim();
    const trimmedEmail = profileForm.email.trim();

    if (trimmedName.length < 3) {
      setProfileError('Informe um nome com ao menos 3 caracteres.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError('Informe um e-mail válido.');
      return;
    }

    try {
      setProfileLoading(true);
      await updateProfile({ name: trimmedName, email: trimmedEmail });
      await fetchProfile();
      setProfileMessage('Perfil atualizado com sucesso!');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Não foi possível atualizar o perfil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('A confirmação deve ser igual à nova senha.');
      return;
    }

    try {
      setPasswordLoading(true);
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage('Senha atualizada com sucesso!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Não foi possível atualizar a senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Meu perfil</h1>
          <p className="page-description">
            Gerencie suas informações pessoais e altere sua senha de acesso ao sistema.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleProfileSubmit}>
        <h2>Dados pessoais</h2>
        <div className="form-field">
          <label htmlFor="profile-name">Nome</label>
          <input
            id="profile-name"
            name="name"
            type="text"
            value={profileForm.name}
            onChange={handleProfileChange}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="profile-email">E-mail</label>
          <input
            id="profile-email"
            name="email"
            type="email"
            value={profileForm.email}
            onChange={handleProfileChange}
            required
          />
        </div>
        {profileError && <div className="page-error" style={{ margin: 0 }}>{profileError}</div>}
        {profileMessage && <div className="tag success">{profileMessage}</div>}
        <div className="form-actions">
          <button className="button" type="submit" disabled={profileLoading}>
            {profileLoading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      <form className="card form-grid" onSubmit={handlePasswordSubmit}>
        <h2>Alterar senha</h2>
        <div className="form-field">
          <label htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            value={passwordForm.newPassword}
            onChange={handlePasswordChange}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="confirm-password">Confirmar nova senha</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordChange}
            required
          />
        </div>
        {passwordError && <div className="page-error" style={{ margin: 0 }}>{passwordError}</div>}
        {passwordMessage && <div className="tag success">{passwordMessage}</div>}
        <div className="form-actions">
          <button className="button" type="submit" disabled={passwordLoading}>
            {passwordLoading ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
