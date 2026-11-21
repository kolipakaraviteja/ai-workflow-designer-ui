import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await authApi.register(username, password, email || undefined);
      } else {
        await authApi.login(username, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.status === 401
        ? 'Invalid username or password'
        : err.response?.status === 409
          ? 'Username already exists'
          : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit} aria-busy={loading}>
        <div className="login-brand-mark" aria-hidden="true">W</div>
        <h1>AI Workflow Designer</h1>
        <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>

        {error && <div className="login-error" role="alert">{error}</div>}

        <label className="auth-field">
          <span>Username</span>
          <input
            type="text"
            autoComplete="username"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        {isRegister && (
          <label className="auth-field">
            <span>Email <small>Optional</small></span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Register' : 'Sign in'}
        </button>

        <button
          type="button"
          className="btn btn-link"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
