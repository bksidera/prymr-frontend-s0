import apiClient from './apiClient'
import type { User } from '../types/user.types'
import type { ApiResponse } from '../types/api.types'

export interface LoginResponse {
  token: string
  user: User
}

export interface RegisterRequest {
  email: string
  userName: string
  firstName: string
  lastName: string
  password: string
  profileIcon?: string
  initialProfileIcon?: string
}

type RawAuthPayload = User & {
  token: string
  profileImage?: string
}

function toLoginResponse(raw: RawAuthPayload): LoginResponse {
  const { token } = raw
  const user: User = {
    id: raw.id,
    email: raw.email ?? '',
    userName: raw.userName ?? '',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    role: raw.role ?? 'standardUser',
    profileIcon:
      (raw as unknown as Record<string, unknown>).profileImage as string | undefined,
    initialProfileIcon: raw.initialProfileIcon,
    isAdmin: raw.isAdmin ?? false,
    isCompletedPaymentProcess: !!raw.isCompletedPaymentProcess,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  }
  return { token, user }
}

const PLACEHOLDER_AVATAR = 'https://prymr-media.s3.amazonaws.com/defaults/avatar.png'

export const authService = {
  async login(identifier: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<ApiResponse<RawAuthPayload>>('/auth/loginUser', {
      username: identifier,
      password,
    })
    return toLoginResponse(res.data.data)
  },

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const res = await apiClient.post<ApiResponse<RawAuthPayload>>('/auth/createUser', {
      ...data,
      profileIcon: data.profileIcon ?? PLACEHOLDER_AVATAR,
      initialProfileIcon: data.initialProfileIcon ?? PLACEHOLDER_AVATAR,
    })
    return toLoginResponse(res.data.data)
  },
}
