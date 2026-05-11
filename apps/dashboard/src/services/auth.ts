import { API_BASE_URL } from '../config/api';

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}


export async function signup(email: string, password: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Signup failed');
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function startGoogleAuth(mode: 'signin' | 'signup') {
  window.location.href = `${API_BASE_URL}/auth/google/start?mode=${mode}`;
}

export function handleGoogleAuthCallbackFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const user = params.get('user');
  const authError = params.get('authError');

  if (authError) {
    params.delete('authError');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
    throw new Error(authError);
  }

  if (!token || !user) {
    return false;
  }

  let parsedUser: { id: string; email: string; name: string };
  try {
    const normalizedUser = user.replace(/-/g, '+').replace(/_/g, '/');
    const paddedUser = normalizedUser.padEnd(normalizedUser.length + ((4 - normalizedUser.length % 4) % 4), '=');
    parsedUser = JSON.parse(atob(paddedUser));
  } catch {
    throw new Error('Invalid Google authentication payload');
  }

  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(parsedUser));

  params.delete('token');
  params.delete('user');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState({}, '', nextUrl);

  return true;
}
