import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

const AuthForm: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage('');



        if (isSignUp) {
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                setLoading(false);
                return;
            }

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                    }
                }
            });
            if (signUpError) setError(signUpError.message);
            else setMessage("Check your email for the confirmation link!");
        } else {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) setError(signInError.message);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
            <div className="w-full max-w-sm">
                <h1 className="text-5xl font-bold text-center mb-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">MeroGuessr</h1>
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                    <h2 className="text-2xl font-bold text-center mb-6">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
                    <form onSubmit={handleAuthAction}>
                        {isSignUp && (
                            <div className="mb-4">
                                <label htmlFor="username" className="block text-gray-400 mb-2">Username</label>
                                <input
                                    id="username"
                                    className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                    type="text"
                                    value={username}
                                    required
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Your unique username"
                                />
                            </div>
                        )}
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-gray-400 mb-2">Email Address</label>
                            <input
                                id="email"
                                className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                type="email"
                                value={email}
                                required
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-gray-400 mb-2">Password</label>
                            <input
                                id="password"
                                className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                type="password"
                                value={password}
                                required
                                minLength={6}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                        {isSignUp && (
                            <div className="mb-6">
                                <label htmlFor="confirm-password" className="block text-gray-400 mb-2">Confirm Password</label>
                                <input
                                    id="confirm-password"
                                    className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                    type="password"
                                    value={confirmPassword}
                                    required
                                    minLength={6}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        )}
                        {!isSignUp && <div className="mb-6"></div>}
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg cursor-pointer transition-all duration-300 shadow-xl hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                        </button>
                        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                        {message && <p className="text-green-400 text-sm mt-4 text-center">{message}</p>}
                    </form>
                    <p className="text-center text-gray-400 mt-6 text-sm">
                        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                        <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-blue-400 hover:underline font-medium">
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthForm;