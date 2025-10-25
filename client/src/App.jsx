import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminQuizForm from './pages/AdminQuizForm.jsx';
import AdminQuizList from './pages/AdminQuizList.jsx';
import AdminQuestionManager from './pages/AdminQuestionManager.jsx';
import AdminUserManagement from './pages/AdminUserManagement.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import PlayerQuizList from './pages/PlayerQuizList.jsx';
import PlayerQuizPlay from './pages/PlayerQuizPlay.jsx';
import PlayerRanking from './pages/PlayerRanking.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="/play" element={<PlayerQuizList />} />
        <Route path="/play/quiz/:quizId" element={<PlayerQuizPlay />} />
        <Route path="/play/quiz/:quizId/ranking" element={<PlayerRanking />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/quizzes" element={<AdminQuizList />} />
          <Route path="/admin/quizzes/new" element={<AdminQuizForm />} />
          <Route path="/admin/quizzes/:quizId/questions" element={<AdminQuestionManager />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/account/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/play" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
