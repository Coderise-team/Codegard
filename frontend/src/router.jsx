import { createBrowserRouter } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ProblemsPage from './pages/ProblemsPage';
import ProblemPage from './pages/ProblemPage';
import ContestsPage from './pages/ContestsPage';
import StandingsPage from './pages/StandingsPage';
import ProfilePage from './pages/ProfilePage';
import ProfileRedirect from './pages/ProfileRedirect';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import GuestRoute from './components/GuestRoute';

export const router = createBrowserRouter([
  {
    // Pathless root: it renders nothing of its own (children go through its
    // Outlet), it exists so every route below has an errorElement to fall back
    // to when it crashes while rendering.
    errorElement: <ErrorBoundary />,
    children: [
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
          { path: '/standings', element: <StandingsPage /> },
          { path: '/users/:username', element: <ProfilePage /> },
          { path: '/profile', element: <ProfileRedirect /> },
          // Catch-all: the whole product lives behind the login, so an unknown
          // URL shows the 404 shell to members and sends guests to /login like
          // any other private route.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
