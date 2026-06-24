import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import { ToastProvider } from './components/Toast'

function isLoggedIn() {
  return !!localStorage.getItem('token')
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Chưa đăng nhập -> trang chào khách (Landing). Đã đăng nhập -> app (Dashboard). */}
        <Route path="/*" element={isLoggedIn() ? <Dashboard /> : <Landing />} />
      </Routes>
    </ToastProvider>
  )
}
