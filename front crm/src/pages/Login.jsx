import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ChevronRight, Eye, EyeOff, X, Phone, Check, Key, Sun, Moon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import { useUser } from '../contexts/UserContext';
import { GoogleLogin } from '@react-oauth/google';
import { resolveUserDashboardPath } from '../utils/userDashboard';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const { showToast } = useToast();
  const { setUser } = useUser();
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const result = await response.json();

      if (response.ok && result.token) {
        localStorage.setItem('token', result.token);
        if (result.user?.id || result.user?._id) {
          localStorage.setItem('user_id', String(result.user.id || result.user._id));
        }
        localStorage.setItem('user', JSON.stringify(result.user));
        if (typeof setUser === 'function' && result.user) {
          setUser(result.user);
        }
        showToast('Google Sign-In successful!', 'success');

        const targetDashboard = resolveUserDashboardPath(result.user);
        setTimeout(() => {
          navigate(targetDashboard);
        }, 500);
      } else {
        showToast(result.detail || result.message || 'Google Sign-In failed.', 'error');
      }
    } catch (err) {
      console.error('Google Login Error:', err);
      showToast('Connection error during Google Sign-In.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('timeout') === 'true') {
      // Small timeout to allow toast provider to mount fully
      setTimeout(() => {
        showToast('Session expired due to inactivity. Please sign in again.', 'warning');
      }, 300);
      navigate('/login', { replace: true });
    }
  }, [showToast, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: name === 'email' ? value.trim() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      let result = {};
      try {
        result = await response.json();
      } catch (jsonErr) {
        if (!response.ok) {
          showToast(`Server Connection Error (${response.status}: ${response.statusText || 'Bad Gateway'}). Please ensure the backend server is running.`, 'error');
          return;
        }
      }

      if (response.ok && result.token) {
        // 1. Save the token
        localStorage.setItem('token', result.token);

        // 2. Extract and Save User ID
        let userId = result.user?.id;

        if (!userId) {
          try {
            const base64Url = result.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            userId = payload.id || payload.sub;
          } catch (decodeError) {
            console.error("Token decoding failed:", decodeError);
          }
        }

        // --- CRITICAL FIX: Save the specific 'user_id' key for Attendance ---
        if (userId) {
          localStorage.setItem('user_id', String(userId));
        }

        // 3. Save full user object for profile/other uses
        const userObj = result.user || { id: userId };
        localStorage.setItem('user', JSON.stringify(userObj));
        if (typeof setUser === 'function' && userObj) {
          setUser(userObj);
        }
        showToast('Login successful!', 'success');

        const targetDashboard = resolveUserDashboardPath(userObj);
        navigate(targetDashboard);
      } else {
        showToast(result.detail || "Authentication Failed", 'error');
      }
    } catch (error) {
      console.error("Login Error:", error);
      showToast("Something went wrong. Please check your server status.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#0b0c10] relative overflow-hidden transition-colors duration-500">
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-lime-400 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
          title="Toggle theme"
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>
      </div>
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime-500/10 dark:bg-lime-500/5 blur-[120px] rounded-full" />
      
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md z-10">

        <div className="text-center mb-10">
         <div className="flex justify-center items-center mb-10">
          <img 
            src="/logo2.png" 
            alt="KODBRAND Logo" 
            className="h-22 w-auto object-contain" 
          />
        </div>


        </div>

        {/* Card Form */}
        <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                Email
              </label>
              <div className="relative">
                {/* <Mail
                  className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 text-slate-500
                  ${loginData.email ? "opacity-0" : "opacity-100"}`}
                  size={18}
                /> */}
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={loginData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl py-4 pl-11 pr-4 text-slate-900 dark:text-slate-100 focus:border-indigo-500/50 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mr-2">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest hover:underline cursor-pointer transition-all"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                {/* <Lock
                  className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 text-slate-500
                  ${loginData.password ? "opacity-0" : "opacity-100"}`}
                  size={18}
                /> */}
                <input
                  required
                  name="password"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={handleChange}
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl py-4 pl-11 pr-12 text-slate-900 dark:text-slate-100 focus:border-indigo-500/50 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }} 
              disabled={isLoading} 
              type="submit" 
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? "Verifying..." : "Authorize Access"} 
              {!isLoading && <ChevronRight size={18} />}
            </motion.button>
          </form>

          {/* Google Sign In Button */}
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              {/* Divider */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative bg-white dark:bg-slate-900 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  or continue with
                </div>
              </div>

              <div className="flex justify-center w-full min-h-[44px]">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => showToast('Google Sign-In failed or closed.', 'error')}
                  theme={isDark ? 'filled_black' : 'outline'}
                  shape="pill"
                  size="large"
                  width="100%"
                />
              </div>
            </>
          )}

          {/* Registration Link */}
          <div className="mt-8 text-center">
            <Link to="/register" className="text-slate-500 dark:text-slate-400 text-sm hover:text-indigo-400">
              Register Staff
            </Link>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isForgotOpen && (
          <ForgotPasswordModal
            isOpen={isForgotOpen}
            onClose={() => setIsForgotOpen(false)}
            defaultEmail={loginData.email}
            showToast={showToast}
            onSuccess={(email, newPassword) => {
              setLoginData({ email, password: newPassword });
              setIsForgotOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- FORGOT PASSWORD MODAL ---
const ForgotPasswordModal = ({ isOpen, onClose, defaultEmail, showToast, onSuccess }) => {
  const [step, setStep] = useState(1); // 1 = Check email/phone, 2 = Set new password
  const [formData, setFormData] = useState({ email: defaultEmail || '', phone: '', newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  React.useEffect(() => {
    if (isOpen) {
      setFormData({ email: defaultEmail || '', phone: '', newPassword: '', confirmPassword: '' });
      setStep(1);
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const password = formData.newPassword;
  const isLongEnough = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[\W_]/.test(password);
  const matchesConfirm = password && password === formData.confirmPassword;

  const isPasswordValid = isLongEnough && hasUppercase && hasLowercase && hasNumber && hasSymbol && matchesConfirm;

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, phone: formData.phone }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast("Identity verified. Please set your new password.", "success");
        setStep(2);
      } else {
        showToast(result.detail || "Verification failed. Check your email and phone number.", "error");
      }
    } catch (error) {
      console.error("Verification Error:", error);
      showToast("Something went wrong. Please check your server status.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) return;
    setIsLoading(true);
    const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, phone: formData.phone, newPassword: formData.newPassword }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast("Password updated successfully! Autofilled credentials.", "success");
        if (onSuccess) {
          onSuccess(formData.email, formData.newPassword);
        } else {
          onClose();
        }
      } else {
        showToast(result.detail || "Reset failed. Please try again.", "error");
      }
    } catch (error) {
      console.error("Reset Error:", error);
      showToast("Something went wrong. Please check your server status.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const Rule = ({ met, label }) => (
    <div className="flex items-center gap-2 text-xs">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all ${
        met 
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
          : "bg-slate-500/5 border-slate-500/20 text-slate-400 dark:text-slate-500"
      }`}>
        <Check size={10} className={met ? "opacity-100" : "opacity-30"} />
      </div>
      <span className={met ? "text-emerald-500 font-semibold" : "text-slate-500 dark:text-slate-400"}>
        {label}
      </span>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex justify-center items-start overflow-y-auto pt-16 pb-16 p-4"
    >
      <motion.div 
        initial={{ y: -50, scale: 0.95 }} 
        animate={{ y: 0, scale: 1 }} 
        exit={{ y: -50, scale: 0.95 }}
        className="bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-slate-850 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative mt-12"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <header className="mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Forgot <span className="text-indigo-600 dark:text-indigo-400">Password</span>
          </h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {step === 1 ? "Step 1: Verify Identity" : "Step 2: Reset Credentials"}
          </p>
        </header>

        {step === 1 ? (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 transition-opacity ${formData.email ? 'opacity-0' : 'opacity-100'}`} size={16} />
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl py-4.5 pl-11 pr-4 text-slate-900 dark:text-slate-100 focus:border-indigo-500/50 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 transition-opacity ${formData.phone ? 'opacity-0' : 'opacity-100'}`} size={16} />
                <input
                  required
                  name="phone"
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit number"
                  value={formData.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData(prev => ({ ...prev, phone: digits }));
                  }}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl py-4.5 pl-11 pr-4 text-slate-900 dark:text-slate-100 outline-none transition-all text-sm ${
                    formData.phone && formData.phone.length !== 10
                      ? 'border-red-400 focus:border-red-400'
                      : 'border-slate-200 dark:border-slate-850 focus:border-indigo-500/50'
                  }`}
                />
              </div>
              {formData.phone && formData.phone.length !== 10 && (
                <p className="text-[10px] text-red-500 ml-2">Must be exactly 10 digits.</p>
              )}
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-4.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? "Checking..." : "Verify Identity"}
              {!isLoading && <ChevronRight size={16} />}
            </button>
          </form>
        ) : (          <form onSubmit={handleReset} className="space-y-5">
            {/* Hidden email input for browser credential manager to associate password change */}
            <input type="hidden" name="email" value={formData.email} autoComplete="username" />

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                New Password
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 transition-opacity ${formData.newPassword ? 'opacity-0' : 'opacity-100'}`} size={16} />
                <input
                  required
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl py-4.5 pl-11 pr-12 text-slate-900 dark:text-slate-100 focus:border-indigo-500/50 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-550 transition-opacity ${formData.confirmPassword ? 'opacity-0' : 'opacity-100'}`} size={16} />
                <input
                  required
                  name="confirmPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl py-4.5 pl-11 pr-12 text-slate-900 dark:text-slate-100 focus:border-indigo-500/50 outline-none transition-all text-sm"
                />
            </div>
          </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 p-4 rounded-2xl space-y-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Password Requirements
              </span>
              <Rule met={isLongEnough} label="At least 8 characters" />
              <Rule met={hasUppercase} label="Includes uppercase letter (A-Z)" />
              <Rule met={hasLowercase} label="Includes lowercase letter (a-z)" />
              <Rule met={hasNumber} label="Includes number (0-9)" />
              <Rule met={hasSymbol} label="Includes special symbol (e.g. !@#$%^&*)" />
              <Rule met={matchesConfirm} label="Passwords match" />
            </div>

            <button
              disabled={isLoading || !isPasswordValid}
              type="submit"
              className="w-full py-4.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              {isLoading ? "Saving..." : "Reset Password"}
              {!isLoading && <Key size={16} />}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Login;