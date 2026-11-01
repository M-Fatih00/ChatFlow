import axios, { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import { toast } from "react-toastify";
import { router } from "../router/Routes";

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;
axios.defaults.withCredentials = true;

const SILENT_401_URLS = ["auth/me", "auth/login"];

axios.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!error.response) {
      toast.error("Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.");
      return Promise.reject(error);
    }

    const { data, status } = error.response as AxiosResponse;

    switch (status) {
      case 400:
        if (data?.errors) {
          const modelStateErrors: string[] = [];
          for (const key in data.errors) {
            if (data.errors[key]) {
              modelStateErrors.push(...data.errors[key]);
            }
          }
          throw modelStateErrors.flat();
        }
        break;

      case 401: {
        const url = error.config?.url ?? "";
        if (SILENT_401_URLS.some((silentUrl) => url.includes(silentUrl))) break;

        toast.error("Oturumunuz sona erdi.");
        router.navigate("/login");
        break;
      }

      case 403:
        toast.error("Bu işlem için yetkiniz yok.");
        break;

      case 404:
        router.navigate("/not-found");
        break;

      case 429:
        toast.error("Çok fazla istek gönderildi. Lütfen biraz bekleyin.");
        break;

      case 500:
        router.navigate("/server-error", { state: { error: data } });
        break;

      default:
        toast.error("Beklenmeyen bir hata oluştu.");
        break;
    }

    return Promise.reject(error);
  },
);

const requests = {
  get: (url: string) => axios.get(url).then((res: AxiosResponse) => res.data),

  post: (url: string, body: unknown) =>
    axios.post(url, body).then((res: AxiosResponse) => res.data),

  put: (url: string, body: unknown) =>
    axios.put(url, body).then((res: AxiosResponse) => res.data),

  delete: (url: string) =>
    axios.delete(url).then((res: AxiosResponse) => res.data),
};

const Auth = {
  login: (values: object) => requests.post("auth/login", values),
  register: (values: object) => requests.post("auth/register", values),
  logout: () => requests.post("auth/logout", {}),
  logoutAll: () => requests.post("auth/logout-all", {}),
  getMe: () => requests.get("auth/me"),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    requests.post("auth/change-password", data),
};

const Message = {
  getMessages: (recipientId?: string, roomId?: number, skip = 0) =>
    requests.get(
      `message?recipientId=${recipientId ?? ""}&roomId=${roomId ?? ""}&skip=${skip}`,
    ),
  deleteMessage: (id: number) => requests.delete(`message/${id}`),
  search: (q: string, recipientId?: string, roomId?: number) =>
    requests.get(
      `message/search?q=${encodeURIComponent(q)}&recipientId=${recipientId ?? ""}&roomId=${roomId ?? ""}`,
    ),
  uploadAttachment: (data: FormData) => requests.post("message/upload", data),
  getMessageStatuses: (id: number) => requests.get(`message/${id}/statuses`),
  getConversations: () => requests.get("message/conversations"),
  deleteConversation: (otherUserId: string) =>
    requests.delete(`message/conversation/${otherUserId}`),
};

const Room = {
  getRooms: () => requests.get("room"),
  getRoom: (id: number) => requests.get(`room/${id}`),
  createRoom: (data: { name: string; memberIds: string[] }) =>
    requests.post("room", data),
  deleteRoom: (id: number) => requests.delete(`room/${id}`),
  getMembers: (id: number) => requests.get(`room/${id}/members`),
  addMember: (id: number, memberId: string) =>
    requests.post(`room/${id}/members`, { memberId }),
  removeMember: (id: number, memberId: string) =>
    requests.delete(`room/${id}/members/${memberId}`),
  makeAdmin: (id: number, memberId: string) =>
    requests.put(`room/${id}/members/${memberId}/admin`, {}),
  updateRoom: (id: number, data: { name: string; description?: string }) =>
    requests.put(`room/${id}`, data),
  updateRoomAvatar: (id: number, data: FormData) =>
    requests.put(`room/${id}/avatar`, data),
};

const User = {
  search: (q: string) => requests.get(`user?q=${encodeURIComponent(q)}`),
  getById: (id: string) =>
    requests.get(`user/by-id/${encodeURIComponent(id)}`),
  getUser: (username: string) =>
    requests.get(`user/${encodeURIComponent(username)}`),
  updateProfile: (data: {
    fullName: string;
    userName: string;
    email?: string;
    bio?: string;
    currentPassword?: string;
  }) => requests.put("user/profile", data),
  updateAvatar: (data: FormData) => requests.put("user/avatar", data),
};

const Block = {
  block: (userId: string) => requests.post(`block/${userId}`, {}),
  unblock: (userId: string) => requests.delete(`block/${userId}`),
  getBlocked: () => requests.get("block"),
  getStatus: (userId: string) => requests.get(`block/status/${userId}`),
  getBlockedUsers: () => requests.get("block/list"),
};

const Friendship = {
  sendRequest: (userId: string) =>
    requests.post(`friendship/request/${userId}`, {}),
  accept: (userId: string) => requests.post(`friendship/accept/${userId}`, {}),
  reject: (userId: string) => requests.delete(`friendship/reject/${userId}`),
  remove: (userId: string) => requests.delete(`friendship/remove/${userId}`),
  getFriends: () => requests.get("friendship/friends"),
  getRequests: () => requests.get("friendship/requests"),
  getStatus: (userId: string) => requests.get(`friendship/status/${userId}`),
  cancel: (userId: string) => requests.delete(`friendship/cancel/${userId}`),
  getSent: () => requests.get("friendship/sent"),
};

export default {
  Auth,
  Message,
  Room,
  User,
  Block,
  Friendship,
};
