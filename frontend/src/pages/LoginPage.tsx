import { Link } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Where Is My Money</h1>
        <p className="text-gray-500 text-center mb-6">登录你的账户</p>
        <LoginForm />
        <p className="text-sm text-gray-500 text-center mt-4">
          还没有账户？{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  )
}
