import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setError(null)
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError(error)
    } else {
      navigate('/admin/dashboard', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] px-4">
      {/* px-4 = 16px side padding so card never touches screen edges on mobile */}

      <div className="w-full max-w-[420px]">
        {/* Card — p-8 = 32px padding on ALL sides */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

          {/* Logo + Title — centered, mb-8 = 32px gap before form */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/logo.png"
              alt="UnSkills"
              className="h-14 mb-4"
            />
            {/* mb-4 = 16px between logo and title */}
            <h1 className="font-heading text-xl font-bold text-gray-900 text-center">
              UnSkills Computer Education
            </h1>
            <p className="text-sm font-medium text-red-600 mt-1">
              Admin Panel Login
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* Form fields — space-y-5 = 20px between each field group */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                {/* mb-1.5 = 6px gap between label and input */}
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="admin@unskills.edu"
                  className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                  {...register('email')}
                />
                {/* h-11 = 44px height, px-3.5 = 14px horizontal padding */}
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full h-11 px-3.5 pr-10 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Remember me + Forgot — mt-4 = 16px gap from fields */}
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In — mt-6 = 24px gap from remember-me row */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-lg text-sm shadow-button-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer — mt-4 = 16px below card */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by PureFlow Studios
        </p>
      </div>
    </div>
  )
}
