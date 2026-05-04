import { Link } from 'react-router-dom'
import RegisterForm from '../components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Where Is My Money</h1>
        <p className="text-gray-500 text-center mb-6">创建新账户</p>
        <RegisterForm />
        <p className="text-sm text-gray-500 text-center mt-4">
          已有账户？{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}
