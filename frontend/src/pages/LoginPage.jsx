import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Phone, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from '../components/shared/ThemeToggle';

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setAuthError('');
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      setAuthError(err.message || 'Invalid email or password. Try admin@example.com / admin123');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Theme toggle — top right */}
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <ThemeToggle />
      </div>

      {/* Decorative background glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '300px',
        background: 'radial-gradient(ellipse at center, var(--accent-glow) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '40px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo + Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-accent)',
          }}>
            <Phone size={24} color="#ffffff" />
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}>
            AI Calling Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Sign in to your admin panel
          </p>
        </div>

        {/* Error banner */}
        {authError && (
          <div style={{
            background: 'var(--status-error-bg)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--status-error)',
          }}>
            {authError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              letterSpacing: '0.01em',
            }}>
              Email address
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="admin@example.com"
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: `1px solid ${errors.email ? 'var(--status-error)' : 'var(--border-input)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                outline: 'none',
                transition: 'all var(--transition-fast)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--border-focus)';
                e.target.style.boxShadow = 'var(--shadow-input)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.email ? 'var(--status-error)' : 'var(--border-input)';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.email && (
              <p style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '5px' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              letterSpacing: '0.01em',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '10px 42px 10px 14px',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${errors.password ? 'var(--status-error)' : 'var(--border-input)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--border-focus)';
                  e.target.style.boxShadow = 'var(--shadow-input)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.password ? 'var(--status-error)' : 'var(--border-input)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '5px' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '11px',
              background: isSubmitting ? 'var(--accent-primary-active)' : 'var(--accent-primary)',
              color: 'var(--text-on-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background var(--transition-fast)',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-primary-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-primary)';
            }}
          >
            {isSubmitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo hint */}
        <div style={{
          marginTop: '20px',
          padding: '10px 14px',
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-glow)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          Demo: <span style={{ color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)' }}>admin@example.com</span>
          {' / '}
          <span style={{ color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)' }}>admin123</span>
        </div>
      </div>
    </div>
  );
}
