export interface IMessage {
  id: number;
  content: string;
  createdAt: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId?: string;
  roomId?: number;
  isRead?: boolean;
  isDelivered?: boolean;
  isDeleted?: boolean;
  attachmentUrl?: string;
  attachmentType?: string;
  reactions?: { userId: string; emoji: string }[];

  readCount?: number;
  deliveredCount?: number;
  totalRecipients?: number;
}
