const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 204) return undefined as T

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  if (!res.ok) {
    throw new Error(data.detail || `API Hatası (${res.status})`)
  }

  return data
}

export const api = {
  auth: {
    login: (data: { username: string; password: string }) =>
      request<{ access_token: string; token_type: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    register: (data: { username: string; email: string; password: string; full_name?: string }) =>
      request<{ access_token: string; token_type: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<any>('/auth/me'),
  },
  books: {
    list: (params?: Record<string, any>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<{items: any[], total: number, skip: number, limit: number}>(`/books${q}`)
    },
    get: (id: number) => request<any>(`/books/${id}`),
    create: (data: any) =>
      request<any>('/books', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/books/${id}`, { method: 'DELETE' }),
    lookupIsbn: (isbn: string) => request<any>(`/books/lookup/isbn?isbn=${isbn}`),
    searchRemote: (q: string, limit: number = 8) =>
      request<any[]>(`/books/search/remote?q=${encodeURIComponent(q)}&limit=${limit}`),
    searchExternal: (q: string, type: 'isbn' | 'title' = 'title') =>
      request<any[]>(`/external-search?q=${encodeURIComponent(q)}&type=${type}`),
    searchWeb: (q: string) =>
      request<any[]>(`/books/search/web?q=${encodeURIComponent(q)}`),
  },
  loans: {
    list: (params?: Record<string, any>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/loans${q}`)
    },
    create: (data: { book_id: number; user_id: number; due_at: string }) =>
      request<any>('/loans', { method: 'POST', body: JSON.stringify(data) }),
    return: (id: number, data?: { notes?: string }) =>
      request<any>(`/loans/${id}/return`, { method: 'POST', body: JSON.stringify(data || {}) }),
  },
  forum: {
    topics: (params?: Record<string, any>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/forum/topics${q}`)
    },
    getTopic: (id: number) => request<any>(`/forum/topics/${id}`),
    createTopic: (data: { title: string; content?: string }) =>
      request<any>('/forum/topics', { method: 'POST', body: JSON.stringify(data) }),
    deleteTopic: (id: number) =>
      request<void>(`/forum/topics/${id}`, { method: 'DELETE' }),
    replies: (topicId: number) => request<any[]>(`/forum/topics/${topicId}/replies`),
    createReply: (topicId: number, data: { content: string }) =>
      request<any>(`/forum/topics/${topicId}/replies`, { method: 'POST', body: JSON.stringify(data) }),
    deleteReply: (id: number) =>
      request<void>(`/forum/replies/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request<any[]>('/users'),
    get: (id: number) => request<any>(`/users/${id}`),
    create: (data: any) =>
      request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  stats: {
    get: () => request<any>('/stats'),
  },
  debate: {
    start: (bookId: number, side: string) =>
      request<any>('/debate/start', { method: 'POST', body: JSON.stringify({ book_id: bookId, side }) }),
    startCustom: (title: string, author: string, side: string) =>
      request<any>('/debate/start-custom', { method: 'POST', body: JSON.stringify({ book_title: title, author, side }) }),
    startSession: (sessionId: number, side: string) =>
      request<any>('/debate/start-session', { method: 'POST', body: JSON.stringify({ session_id: sessionId, side }) }),
    sendMessage: (sessionId: string, content: string) =>
      request<any>('/debate/message', { method: 'POST', body: JSON.stringify({ session_id: sessionId, content }) }),
  },
  covers: {
    upload: (bookId: number, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<any>(`/covers/upload?book_id=${bookId}`, { method: 'POST', body: formData })
    },
    download: (bookId: number, url: string) =>
      request<any>('/covers/download', { method: 'POST', body: JSON.stringify({ book_id: bookId, url }) }),
    migrate: () =>
      request<any>('/covers/migrate', { method: 'POST' }),
  },
  wishlist: {
    list: () => request<any[]>('/wishlist'),
    add: (data: any) =>
      request<any>('/wishlist', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/wishlist/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<void>(`/wishlist/${id}`, { method: 'DELETE' }),
  },
  shelves: {
    list: () => request<any[]>('/shelves'),
    create: (data: { name: string; color?: string }) =>
      request<any>('/shelves', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/shelves/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/shelves/${id}`, { method: 'DELETE' }),
  },
  copies: {
    list: (bookId: number) => request<any[]>(`/copies/book/${bookId}`),
    addUrl: (bookId: number, url: string, description?: string) => 
      request<any>(`/copies/book/${bookId}/url`, { method: 'POST', body: JSON.stringify({ url, description }) }),
    addYoutube: (bookId: number, url: string, description?: string) => 
      request<any>(`/copies/book/${bookId}/youtube`, { method: 'POST', body: JSON.stringify({ url, description }) }),
    upload: (bookId: number, file: File, isPublic = false, description = '') => {
      const formData = new FormData()
      formData.append('file', file)
      if (isPublic) formData.append('is_public', 'true')
      if (description) formData.append('description', description)
      return request<any>(`/copies/book/${bookId}/upload`, { method: 'POST', body: formData })
    },
    uploadWithProgress: (bookId: number, file: File, onProgress: (pct: number) => void, isPublic = false, description = ''): Promise<any> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', file)
        if (isPublic) formData.append('is_public', 'true')
        if (description) formData.append('description', description)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)) }
            catch { resolve(xhr.responseText as any) }
          } else {
            try {
              const err = JSON.parse(xhr.responseText)
              reject(new Error(err.detail || `API Hatası (${xhr.status})`))
            } catch { reject(new Error(`API Hatası (${xhr.status})`)) }
          }
        }
        xhr.onerror = () => reject(new Error('Sunucuya bağlanılamadı'))
        xhr.open('POST', `${API_BASE}/copies/book/${bookId}/upload`)
        const token = localStorage.getItem('token')
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(formData)
      })
    },
    update: (copyId: number, data: any) =>
      request<any>(`/copies/${copyId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (copyId: number) =>
      request<void>(`/copies/${copyId}`, { method: 'DELETE' }),
    download: (copyId: number) => {
      const token = localStorage.getItem('token')
      return `/api/copies/${copyId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
    },
    setPrimary: (copyId: number) =>
      request<any>(`/copies/${copyId}/set-primary`, { method: 'POST' }),
    setDefault: (copyId: number) =>
      request<any>(`/copies/${copyId}/set-default`, { method: 'POST' }),
    ocr: (copyId: number) =>
      request<{ success: boolean; message: string; chunk_count: number }>(`/copies/${copyId}/ocr`, { method: 'POST' }),
    ocrStatus: (copyId: number) =>
      request<{ status: string; phase: string; progress: string; message: string; chunk_count: number }>(`/copies/${copyId}/ocr/status`),
    read: (bookId: number) =>
      request<any>(`/copies/book/${bookId}/read`),
    public: (params?: Record<string, any>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/copies/public${q}`)
    },
    summary: (bookId: number, force: boolean = false) =>
      request<{ summary: string; source_count: number }>(`/copies/book/${bookId}/summary?force=${force}`, { method: 'POST' }),
    webSearch: (bookId: number) =>
      request<{ sources: any[] }>(`/copies/book/${bookId}/summary/web-search`, { method: 'POST' }),
  },
  chat: {
    getSession: (bookId: number) => request<any>(`/books/${bookId}/chat`),
    sendMessage: (bookId: number, content: string) =>
      request<any>(`/books/${bookId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },
  ai: {
    status: () =>
      request<{ llm_loaded: boolean; llm_loading: boolean; embed_loaded: boolean; provider: string }>('/ai/status'),
  },
  settings: {
    getAI: () =>
      request<{ provider: string; model: string; has_key: boolean; key_masked: string; default_model: string }>('/settings/ai'),
    updateAI: (data: { provider?: string; model?: string; api_key?: string }) =>
      request<{ provider: string; model: string; has_key: boolean; key_masked: string; default_model: string }>('/settings/ai', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    testAI: (data?: { api_key?: string; model?: string }) =>
      request<{ ok: boolean; model: string; reply: string }>('/settings/ai/test', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
  },
  translate: {
    text: (text: string, target_lang: string = 'Türkçe', source_lang?: string) =>
      request<{ translation: string; target_lang: string; source_lang?: string }>('/translate', {
        method: 'POST',
        body: JSON.stringify({ text, target_lang, source_lang }),
      }),
  },
  knowledge: {
    getSessions: () => request<any[]>('/knowledge/sessions'),
    createSession: (name: string, isPublic: boolean = false) => request<any>('/knowledge/sessions', { method: 'POST', body: JSON.stringify({ name, is_public: isPublic }) }),
    getMessages: (sessionId: number) => request<any[]>(`/knowledge/sessions/${sessionId}/messages`),
    getReports: (sessionId: number) => request<any[]>(`/knowledge/sessions/${sessionId}/reports`),
    generateReport: (sessionId: number, topic: string) => request<any>(`/knowledge/sessions/${sessionId}/report`, { method: 'POST', body: JSON.stringify({ topic }) }),
    inviteUser: (sessionId: number, userId: number, role: string = 'viewer') => request<any>(`/knowledge/sessions/${sessionId}/invite`, { method: 'POST', body: JSON.stringify({ user_id: userId, role }) }),
    deleteSession: (id: number) => request<void>(`/knowledge/sessions/${id}`, { method: 'DELETE' }),
    getSources: (sessionId: number) => request<any[]>(`/knowledge/sessions/${sessionId}/sources`),
    addBookSource: (sessionId: number, bookId: number) => request<any>(`/knowledge/sessions/${sessionId}/sources/book`, { method: 'POST', body: JSON.stringify({ book_id: bookId }) }),
    addDocumentSources: (sessionId: number, copyIds: number[]) => request<any[]>(`/knowledge/sessions/${sessionId}/sources/documents`, { method: 'POST', body: JSON.stringify({ copy_ids: copyIds }) }),
    addFileSource: (sessionId: number, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<any>(`/knowledge/sessions/${sessionId}/sources/file`, { method: 'POST', body: formData })
    },
    addImageSource: (sessionId: number, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<any>(`/knowledge/sessions/${sessionId}/sources/image`, { method: 'POST', body: formData })
    },
    addYoutubeSource: (sessionId: number, url: string) => request<any>(`/knowledge/sessions/${sessionId}/sources/youtube`, { method: 'POST', body: JSON.stringify({ url }) }),
    addUrlSource: (sessionId: number, url: string) => request<any>(`/knowledge/sessions/${sessionId}/sources/url`, { method: 'POST', body: JSON.stringify({ url }) }),
    askSession: (sessionId: number, question: string) => request<any>(`/knowledge/sessions/${sessionId}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  },
  system: {
    getBackupUrl: () => {
      const token = localStorage.getItem('token')
      return `/api/system/backup${token ? `?token=${encodeURIComponent(token)}` : ''}`
    },
    downloadBackup: async () => {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/system/backup`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        throw new Error(`Yedekleme başarısız (${res.status})`)
      }
      return res.blob()
    }
  }
}
