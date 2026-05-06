import apiClient from './apiClient'
import type { ApiResponse } from '../types/api.types'

export const uploadsService = {
  async upload(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await apiClient.post<ApiResponse<{ url: string }>>(
      '/file-upload/uploadsmallcontent',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data.url
  },
}
