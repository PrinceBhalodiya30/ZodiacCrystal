export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterOtpResponse {
  message: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifyRegistrationRequest {
  email: string;
  otp: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
