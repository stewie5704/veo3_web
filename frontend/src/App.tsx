import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import { ToastProvider } from './components/Toast'

function isLoggedIn() {
  return !!localStorage.getItem('token')
}

// Bọc trong component để token được kiểm tra LẠI mỗi lần render route (sau khi login nav('/') -> ra Dashboard).
// Nếu để inline `isLoggedIn() ? ... : ...` thì nó chỉ tính 1 lần lúc App mount -> login xong vẫn kẹt ở Landing.
function Root() {
  return isLoggedIn() ? <Dashboard /> : <Landing />
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Chưa đăng nhập -> trang chào khách (Landing). Đã đăng nhập -> app (Dashboard). */}
        <Route path="/*" element={<Root />} />
      </Routes>
    </ToastProvider>
  )
}
