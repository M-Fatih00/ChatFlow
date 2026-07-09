import * as signalR from "@microsoft/signalr";
import { store } from "../store/store";
import type { IMessage } from "../models/IMessage";
import {
  messageReceived,
  userOnline,
  userOffline,
  userTyping,
  userStoppedTyping,
  messageRead,
  messageDelivered,
  messageDeleted,
  reactionUpdated,
  groupMessageStatusUpdated,
} from "../features/chats/chatSlice";

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private offlineTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async connect(token: string) {
    if (this.connection) return; // zaten bağlantı varsa tekrar kurma

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5017/api";
    const hubUrl = apiBase.replace(/\/api\/?$/, "") + "/hubs/chat";

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection = connection;
    this.registerHandlers();

    await connection.start();

    await connection.invoke("GetOnlineUsers");
    await connection.invoke("MarkAllAsDelivered");
  }

  private registerHandlers() {
    if (!this.connection) return;

    this.connection.on("ReceiveMessage", (message: IMessage) => {
      const currentUserId = store.getState().auth.user?.id;
      store.dispatch(messageReceived({ ...message, currentUserId }));

      // Bana gelen mesajsa (ben göndermediysem) iletildi bilgisi gönder
      if (message.senderId !== currentUserId) {
        this.markAsDelivered(message.id, message.senderId);
      }

      // ChatsPanel yenilensin (yeni sohbet listeye eklenebilir)
      window.dispatchEvent(
        new CustomEvent("messageReceived", {
          detail: { isRoom: message.roomId != null },
        }),
      );
    });

    this.connection.on("UserOnline", (userId: string) => {
      const timer = this.offlineTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        this.offlineTimers.delete(userId);
      }
      store.dispatch(userOnline(userId));
    });

    this.connection.on("UserOffline", (userId: string) => {
      const timer = setTimeout(() => {
        store.dispatch(userOffline(userId));
        this.offlineTimers.delete(userId);
      }, 3500);
      this.offlineTimers.set(userId, timer);
    });

    this.connection.on(
      "UserTyping",
      (userId: string, roomId: number | null) => {
        const state = store.getState().chat;
        // Bu typing benim açık sohbetime mi ait?
        const belongsToActive = state.isRoom
          ? roomId === Number(state.activeConversationId)
          : roomId == null && userId === state.activeConversationId;

        if (belongsToActive) {
          store.dispatch(userTyping(userId));
        }
      },
    );

    this.connection.on(
      "UserStoppedTyping",
      (userId: string, roomId: number | null) => {
        const state = store.getState().chat;
        const belongsToActive = state.isRoom
          ? roomId === Number(state.activeConversationId)
          : roomId == null && userId === state.activeConversationId;

        if (belongsToActive) {
          store.dispatch(userStoppedTyping(userId));
        }
      },
    );

    this.connection.on("FriendRequestReceived", () => {
      window.dispatchEvent(new CustomEvent("friendRequestReceived"));
    });

    this.connection.on("FriendRequestAccepted", () => {
      window.dispatchEvent(new CustomEvent("friendRequestAccepted"));
    });

    this.connection.on("FriendRemoved", () => {
      window.dispatchEvent(new CustomEvent("friendRemoved"));
    });

    this.connection.on("MessageRead", (messageId: number) => {
      store.dispatch(messageRead(messageId));
    });

    this.connection.on("MessageDelivered", (messageId: number) => {
      store.dispatch(messageDelivered(messageId));
    });

    this.connection.on(
      "GroupMessageStatus",
      (data: {
        messageId: number;
        readCount?: number;
        deliveredCount?: number;
      }) => {
        store.dispatch(groupMessageStatusUpdated(data));
      },
    );

    this.connection.on("MessageDeleted", (messageId: number) => {
      store.dispatch(messageDeleted(messageId));
    });

    this.connection.on("RemovedFromRoom", (roomId: number) => {
      window.dispatchEvent(
        new CustomEvent("removedFromRoom", { detail: roomId }),
      );
    });

    this.connection.on("AddedToRoom", (roomId: number) => {
      window.dispatchEvent(new CustomEvent("addedToRoom", { detail: roomId }));
    });

    this.connection.on("OnlineUsersList", (userIds: string[]) => {
      userIds.forEach((id) => store.dispatch(userOnline(id)));
    });

    this.connection.on(
      "AvatarUpdated",
      (data: { userId: string; avatar: string }) => {
        window.dispatchEvent(
          new CustomEvent("avatarUpdated", { detail: data }),
        );
      },
    );

    this.connection.on(
      "RoomUpdated",
      (data: {
        id: number;
        name: string;
        description: string;
        avatar: string;
      }) => {
        window.dispatchEvent(new CustomEvent("roomUpdated", { detail: data }));
      },
    );

    this.connection.on(
      "ReactionUpdated",
      (messageId: number, reactions: { userId: string; emoji: string }[]) => {
        store.dispatch(reactionUpdated({ messageId, reactions }));
      },
    );

    this.connection.on("BlockStatusChanged", (fromUserId: string) => {
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", {
          detail: { userId: fromUserId },
        }),
      );
    });
  }

  async sendMessage(
    content: string,
    recipientId?: string,
    roomId?: number,
    attachmentUrl?: string,
    attachmentType?: string,
  ) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;

    await this.connection.invoke(
      "SendMessage",
      content,
      recipientId ?? null,
      roomId ?? null,
      attachmentUrl ?? null,
      attachmentType ?? null,
    );
  }

  async toggleReaction(messageId: number, emoji: string) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("ToggleReaction", messageId, emoji);
  }

  async joinRoom(roomId: number) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("JoinRoom", roomId);
  }

  async leaveRoom(roomId: number) {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("LeaveRoom", roomId);
  }

  async startTyping(recipientId?: string, roomId?: number) {
    await this.connection?.invoke(
      "StartTyping",
      recipientId ?? null,
      roomId ?? null,
    );
  }

  async stopTyping(recipientId?: string, roomId?: number) {
    await this.connection?.invoke(
      "StopTyping",
      recipientId ?? null,
      roomId ?? null,
    );
  }

  async markAsRead(messageId: number, senderId: string) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("MarkAsRead", messageId, senderId);
  }

  async markAsDelivered(messageId: number, senderId: string) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("MarkAsDelivered", messageId, senderId);
  }

  async deleteMessage(messageId: number) {
    let attempts = 0;
    while (
      this.connection?.state !== signalR.HubConnectionState.Connected &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke("DeleteMessage", messageId);
  }

  async disconnect() {
    await this.connection?.stop();
    this.connection = null;
  }
}

// Singleton — tek bir instance kullanacağız
export const signalRService = new SignalRService();
