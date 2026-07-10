import { createBrowserRouter } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ProblemsPage from './pages/ProblemsPage';
import ProblemPage from './pages/ProblemPage';
import ContestsPage from './pages/ContestsPage';
import ContestPage from './pages/ContestPage';
import ProfilePage from './pages/ProfilePage';
import PrivateRoute from './components/PrivateRoute';
import GuestRoute from './components/GuestRoute';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <AuthPage key="login" mode="login" /> },
      {
        path: '/register',
        element: <AuthPage key="register" mode="register" />,
      },
    ],
  },
  {
    element: <PrivateRoute />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/problems', element: <ProblemsPage /> },
      { path: '/problems/:id', element: <ProblemPage /> },
      { path: '/contests', element: <ContestsPage /> },
      { path: '/contests/:id', element: <ContestPage /> },
      { path: '/users/:username', element: <ProfilePage /> },
    ],
  },
]);
