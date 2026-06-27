import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// Download a protected video through the API (sends the Bearer header, unlike a bare
// <a download>), as a blob → triggers the browser save dialog. `path` is relative to /api/v1.
export async function downloadVideoFile(path: string, filename: string) {
  const r = await api.get(path, { responseType: 'blob' })
  const href = URL.createObjectURL(r.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1500)
}

export const authApi = {
  register: (data: { email: string; username: string; password: string; ref?: string }) =>
    api.post('/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  saveGeminiKey: (api_key: string) => api.post('/auth/gemini-key', { api_key }).then(r => r.data),
}

type GenFields = { prompt: string; model_key?: string; aspect_ratio?: string; duration_seconds?: number }
function genFormData(fields: GenFields): FormData {
  const fd = new FormData()
  fd.append('prompt', fields.prompt)
  if (fields.model_key) fd.append('model_key', fields.model_key)
  if (fields.aspect_ratio) fd.append('aspect_ratio', fields.aspect_ratio)
  if (fields.duration_seconds) fd.append('duration_seconds', String(fields.duration_seconds))
  return fd
}

export const videosApi = {
  create: (data: any) => api.post('/videos/create', data).then(r => r.data),
  // Frames -> Video (I2V): 1 ảnh khung đầu + mô tả chuyển động
  createI2V: (image: File, fields: GenFields) => {
    const fd = genFormData(fields); fd.append('image', image)
    return api.post('/videos/create-i2v', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  // Ingredients -> Video (R2V): 1-3 ảnh tham chiếu (giữ mặt) + prompt
  createR2V: (images: File[], fields: GenFields) => {
    const fd = genFormData(fields); images.forEach(im => fd.append('images', im))
    return api.post('/videos/create-r2v', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  list: (limit = 20, offset = 0) => api.get(`/videos/?limit=${limit}&offset=${offset}`).then(r => r.data),
  get: (id: string) => api.get(`/videos/${id}`).then(r => r.data),
  retry: (id: string) => api.post(`/videos/${id}/retry`).then(r => r.data),
  delete: (id: string) => api.delete(`/videos/${id}`).then(r => r.data),
  downloadUrl: (jobId: string, fileIndex: number) => `/api/v1/videos/${jobId}/download/${fileIndex}`,
}

export const projectsApi = {
  create: (data: any) => api.post('/projects/', data).then(r => r.data),
  list: () => api.get('/projects/').then(r => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then(r => r.data),
  stop: (id: string) => api.post(`/projects/${id}/stop`).then(r => r.data),
  resume: (id: string) => api.post(`/projects/${id}/resume`).then(r => r.data),
  rename: (id: string, name: string) => api.patch(`/projects/${id}`, { name }).then(r => r.data),
  addScenes: (id: string, data: any) => api.post(`/projects/${id}/add-scenes`, data).then(r => r.data),
  updatePartScript: (id: string, part: number, idea: string) =>
    api.patch(`/projects/${id}/part-script`, { part, idea }).then(r => r.data),
  updateScene: (projectId: string, sceneId: string, data: any) =>
    api.put(`/projects/${projectId}/scenes/${sceneId}`, data).then(r => r.data),
  rerenderScene: (projectId: string, sceneId: string) =>
    api.post(`/projects/${projectId}/scenes/${sceneId}/rerender`).then(r => r.data),
  renderScene: (projectId: string, sceneId: string) =>
    api.post(`/projects/${projectId}/scenes/${sceneId}/render`).then(r => r.data),
  exportPrompts: (projectId: string) =>
    api.get(`/projects/${projectId}/export-prompts`).then(r => r.data),
  importVideo: (projectId: string, sceneId: string, file: File) => {
    const fd = new FormData(); fd.append('video', file)
    return api.post(`/projects/${projectId}/scenes/${sceneId}/import-video`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  setStartImage: (projectId: string, sceneId: string, file: File) => {
    const fd = new FormData(); fd.append('image', file)
    return api.post(`/projects/${projectId}/scenes/${sceneId}/set-start-image`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}


export const toolsApi = {
  autoprompt: (data: { idea: string; scene_count?: number; style?: string; language?: string; aspect_ratio?: string; cast?: any[] }) =>
    api.post('/tools/autoprompt', data).then(r => r.data),
  parseScript: (data: { script: string; scene_count?: number; language?: string; aspect_ratio?: string; cast?: any[] }) =>
    api.post('/tools/parse-script', data).then(r => r.data),
  tts: (data: { text: string; voice?: string }) =>
    api.post('/tools/tts', data).then(r => r.data),
  image: (data: { prompt: string; count?: number; aspect_ratio?: string; char_ids?: string[] }) =>
    api.post('/tools/image', data).then(r => r.data),
  copyIdea: (data: { url: string; style?: string; scene_count?: number }) =>
    api.post('/tools/copy-idea', data).then(r => r.data),
  styles: () => api.get('/tools/styles').then(r => r.data),  // [{id,name}]
}

export const charactersApi = {
  // projectId rỗng -> kho chung; có -> nhân vật riêng của project
  list: (projectId?: string) =>
    api.get('/characters/', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
  add: (name: string, image: File, projectId?: string) => {
    const fd = new FormData()
    fd.append('name', name)
    fd.append('image', image)
    if (projectId) fd.append('project_id', projectId)
    return api.post('/characters/', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  // Clone 1 nhân vật (vd kho chung) vào 1 project, không cần upload lại ảnh
  copyInto: (copyFrom: string, projectId: string, name: string) => {
    const fd = new FormData()
    fd.append('name', name)
    fd.append('copy_from', copyFrom)
    fd.append('project_id', projectId)
    return api.post('/characters/', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  delete: (id: string) => api.delete(`/characters/${id}`).then(r => r.data),
}

export const mediaApi = {
  merge: (project_id: string) => api.post('/media/merge', { project_id }).then(r => r.data),
  cut: (data: { filename: string; mode: string; segment?: number; fps?: number }) =>
    api.post('/media/cut', data).then(r => r.data),
  downloadUrl: (url: string, quality?: string) =>
    api.post('/media/download-url', { url, quality }).then(r => r.data),
  credits: () => api.get('/media/credits').then(r => r.data),
  thumbnail: (video_file: string) => api.post('/media/thumbnail', { video_file }).then(r => r.data),
  share: (video_file: string) => api.post('/profile/share-video', { video_file }).then(r => r.data),
  downloadProjectZip: (project_id: string) => `/api/v1/media/project/${project_id}/zip`,
}

export const adminApi = {
  stats: () => api.get('/admin/stats').then(r => r.data),
  users: (search = '') => api.get(`/admin/users?search=${search}`).then(r => r.data),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(r => r.data),
  payments: (status = '') => api.get(`/admin/payments?status=${status}`).then(r => r.data),
  activatePayment: (id: string) => api.post(`/admin/payments/${id}/activate`).then(r => r.data),
  assistantPool: () => api.get('/admin/assistants').then(r => r.data),
  affiliates: () => api.get('/admin/affiliates').then(r => r.data),
  commissions: (status = '') => api.get(`/admin/commissions?status=${status}`).then(r => r.data),
  payCommission: (id: string) => api.post(`/admin/commissions/${id}/pay`).then(r => r.data),
  voidCommission: (id: string) => api.delete(`/admin/commissions/${id}`).then(r => r.data),
  withdrawals: (status = 'pending') => api.get(`/admin/withdrawals?status=${status}`).then(r => r.data),
  approveWithdrawal: (id: string) => api.post(`/admin/withdrawals/${id}/approve`).then(r => r.data),
  rejectWithdrawal: (id: string) => api.post(`/admin/withdrawals/${id}/reject`).then(r => r.data),
}

export const affiliateApi = {
  me: () => api.get('/affiliate/me').then(r => r.data),
  withdraw: (amount_t: number, bank: string) =>
    api.post('/affiliate/withdraw', { amount_t, bank }).then(r => r.data),
  setAutoRenew: (enabled: boolean) =>
    api.post('/affiliate/auto-renew', { enabled }).then(r => r.data),
}

export const statusApi = {
  get: () => api.get('/status').then(r => r.data),
}

export const billingApi = {
  plans: () => api.get('/billing/plans').then(r => r.data),
  me: () => api.get('/billing/me').then(r => r.data),
  checkout: (plan: string, method: string) =>
    api.post('/billing/checkout', { plan, method }).then(r => r.data),
  topup: (amount: number, method: string) =>
    api.post('/billing/topup', { amount, method }).then(r => r.data),
  orderStatus: (orderId: string) =>
    api.get(`/billing/order/${orderId}/status`).then(r => r.data),
  cancelOrder: (orderId: string) =>
    api.post(`/billing/order/${orderId}/cancel`).then(r => r.data),
  myAssistants: () => api.get('/billing/assistants').then(r => r.data),
}

export const extensionApi = {
  status: () => api.get('/extension-status').then(r => r.data),
}
