export type UserRole = 'standardUser' | 'publicCreator' | 'privateCreator'

export interface User {
  id: string
  email: string
  userName: string
  firstName: string
  lastName: string
  role: UserRole
  profileIcon?: string
  initialProfileIcon?: string
  isAdmin: boolean
  isCompletedPaymentProcess: boolean
  createdAt: string
}
