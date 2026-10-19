export interface AuthUser {
  userId: number;
  name: string;
  email: string;
  role: 'User' | 'Admin';
  createdAt: string;
}

export interface AdminUser {
  userId: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}
