import { createBrowserRouter } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ProblemsPage from './pages/ProblemsPage';
import ProblemPage from './pages/ProblemPage';
import ContestsPage from './pages/ContestsPage';
import ContestPage from './pages/ContestPage';
import ContestProblemPage from './pages/ContestProblemPage';
import StandingsPage from './pages/StandingsPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';
import HomeRoute from './components/HomeRoute';
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
      // Unguarded on purpose: mid-exchange the auth flag flips to true, and a
      // GuestRoute would race the page's own redirect with its Navigate home.
      { path: '/oauth/callback', element: <OAuthCallbackPage /> },
      // Public on purpose: the privacy policy must be readable by anyone,
      // including a signed-out Google verification reviewer, so it sits outside
      // both PrivateRoute and GuestRoute.
      { path: '/privacy', element: <PrivacyPage /> },
      // The root belongs to both audiences: it answers with the dashboard to a
      // member and with the landing page to a guest, so it sits outside both
      // guards and picks for itself.
      { path: '/', element: <HomeRoute /> },
      {
        element: <PrivateRoute />,
        children: [
          { path: '/problems', element: <ProblemsPage /> },
          { path: '/problems/:id', element: <ProblemPage /> },
          { path: '/contests', element: <ContestsPage /> },
          { path: '/contests/:id', element: <ContestPage /> },
          {
            path: '/contests/:id/problems/:letter',
            element: <ContestProblemPage />,
          },
          { path: '/standings', element: <StandingsPage /> },
          { path: '/users/:username', element: <ProfilePage /> },
          // Catch-all: the whole product lives behind the login, so an unknown
          // URL shows the 404 shell to members and sends guests to /login like
          // any other private route.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
