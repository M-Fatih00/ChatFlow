export interface IUser {
  id: string;
  fullName: string;
  userName: string;
  email?: string;
  avatar?: string;
  bio?: string;
  lastSeen?: string;
  isOnline?: boolean;
  createdAt?: string;
}
