import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGate from './components/AuthGate'
import Home from './pages/Home'
import Search from './pages/Search'
import Match from './pages/Match'
import Campus from './pages/Campus'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import ReviewForm from './pages/ReviewForm'
import Me from './pages/Me'
import AdminModeration from './pages/AdminModeration'
import NotFound from './pages/NotFound'

// Routes from docs/proposal.md §7
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="match" element={<Match />} />
        <Route path="campus/:slug" element={<Campus />} />
        <Route path="login" element={<Login />} />
        <Route
          path="onboarding"
          element={
            <AuthGate>
              <Onboarding />
            </AuthGate>
          }
        />
        <Route
          path="campus/:slug/review"
          element={
            <AuthGate requireOnboarded>
              <ReviewForm />
            </AuthGate>
          }
        />
        <Route
          path="me"
          element={
            <AuthGate>
              <Me />
            </AuthGate>
          }
        />
        <Route
          path="admin/moderation"
          element={
            <AuthGate requireAdmin>
              <AdminModeration />
            </AuthGate>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
