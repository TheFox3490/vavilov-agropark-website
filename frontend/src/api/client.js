/* Тонкая обёртка над fetch.
   Токен лежит в httpOnly-cookie, поэтому из JS он недоступен — а значит
   его не украсть через XSS. Взамен flask-jwt-extended требует передавать
   CSRF-токен заголовком; его он кладёт в обычную, читаемую cookie. */

const BASE = import.meta.env.VITE_API_BASE ?? "";

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie("csrf_access_token");
    if (csrf) headers["X-CSRF-TOKEN"] = csrf;
  }

  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || "Что-то пошло не так", response.status);
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(path, { method: "POST", body: form, isForm: true });
  },
};

export const auth = {
  me: () => api.get("/auth/me"),
  login: (payload) => api.post("/auth/login", payload),
  register: (payload) => api.post("/auth/register", payload),
  logout: () => api.post("/auth/logout"),
  confirm: (token) => api.post(`/auth/confirm/${token}`),
  forgot: (email) => api.post("/auth/forgot", { email }),
  reset: (token, payload) => api.post(`/auth/reset/${token}`, payload),
  changePassword: (payload) => api.post("/auth/change-password", payload),
};

export const news = {
  categories: () => api.get("/news/categories"),
  feed: ({ category = "", offset = 0, limit = 5 } = {}) => {
    const params = new URLSearchParams({ offset, limit });
    if (category && category !== "all") params.set("category", category);
    return api.get(`/news?${params}`);
  },
  detail: (id) => api.get(`/news/${id}`),
};

export const projects = {
  list: (placement = "startups") => api.get(`/projects?placement=${placement}`),
  detail: (slug) => api.get(`/projects/${encodeURIComponent(slug)}`),
};

export const services = {
  list: () => api.get("/services"),
  detail: (slug) => api.get(`/services/${encodeURIComponent(slug)}`),
};

export const settings = {
  list: () => api.get("/settings"),
};

export const staff = {
  list: () => api.get("/staff"),
};

export const contact = {
  send: (payload) => api.post("/contact", payload),
};

export const admin = {
  listNews: () => api.get("/admin/news"),
  createNews: (payload) => api.post("/admin/news", payload),
  updateNews: (id, payload) => api.patch(`/admin/news/${id}`, payload),
  deleteNews: (id) => api.delete(`/admin/news/${id}`),
  upload: (file) => api.upload("/admin/upload", file),
  listProjects: () => api.get("/admin/projects"),
  createProject: (payload) => api.post("/admin/projects", payload),
  updateProject: (id, payload) => api.patch(`/admin/projects/${id}`, payload),
  deleteProject: (id) => api.delete(`/admin/projects/${id}`),
  reorderProjects: (ids) => api.post("/admin/projects/reorder", { ids }),

  listServices: () => api.get("/admin/services"),
  createService: (payload) => api.post("/admin/services", payload),
  updateService: (id, payload) => api.patch(`/admin/services/${id}`, payload),
  deleteService: (id) => api.delete(`/admin/services/${id}`),
  reorderServices: (ids) => api.post("/admin/services/reorder", { ids }),

  listStaff: () => api.get("/admin/staff"),
  createStaff: (payload) => api.post("/admin/staff", payload),
  updateStaff: (id, payload) => api.patch(`/admin/staff/${id}`, payload),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  reorderStaff: (ids) => api.post("/admin/staff/reorder", { ids }),

  readSettings: () => api.get("/admin/settings"),
  saveSettings: (settings) => api.patch("/admin/settings", { settings }),

  listRequests: () => api.get("/admin/contact-requests"),
  updateRequest: (id, payload) => api.patch(`/admin/contact-requests/${id}`, payload),
  deleteRequest: (id) => api.delete(`/admin/contact-requests/${id}`),
};
