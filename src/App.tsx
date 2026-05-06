import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { CreatorPage } from './pages/CreatorPage'
import { BoardViewPage } from './pages/BoardViewPage'
import { ProtectedRoute } from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/b/:boardId" element={<BoardViewPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <CreatorPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
