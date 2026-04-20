import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, GraduationCap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function StudentLoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setError(null)
    const { error } = await signIn(data.email, data.password)
    if (error) setError(error)
    else navigate('/student/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] px-4">
      <div className="w-full max-w-[420px]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-xl bg-red-600 flex items-center justify-center mb-4">
              <GraduationCap size={28} className="text-white" />
            </div>
            <h1 className="font-heading text-xl font-bold text-gray-900 text-center">UnSkills Student Zone</h1>
            <p className="text-sm font-medium text-red-600 mt-1">Student Login</p>
          </div>
          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><span className="text-sm text-red-600">{error}</span></div>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" autoComplete="email" {...register('email')}
                  className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')}
                    className="w-full h-11 px-3.5 pr-10 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full h-12 mt-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
