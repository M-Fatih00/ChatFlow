import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { IMessage } from "../../models/IMessage";

// STATE
interface ChatState {
  messages: IMessage[];
  activeConversationId: string | null;
  isRoom: boolean;
  typingUsers: string[];
  onlineUsers: string[];
  unreadCounts: Record<string, number>; // { sohbet/grupId: okunmamışAdet }
}

// INITIAL STATE
const initialState: ChatState = {
  messages: [],
  activeConversationId: null,
  isRoom: false,
  typingUsers: [],
  onlineUsers: [],
  unreadCounts: {},
};

// SLICE
export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    messageReceived(state, action) {
      const msg = action.payload;

      const isActiveSet = state.activeConversationId !== null;

      let belongsToActive = false;
      if (isActiveSet) {
        if (state.isRoom) {
          // Aktif sohbet grup: mesaj da o gruba ait olmalı
          belongsToActive = msg.roomId === Number(state.activeConversationId);
        } else {
          // Aktif sohbet bireysel mesaj bireysel (roomId null) VE karşı tarafla olmalı
          belongsToActive =
            msg.roomId == null &&
            (msg.senderId === state.activeConversationId ||
              msg.recipientId === state.activeConversationId);
        }
      }

      if (!isActiveSet || belongsToActive) {
        const exists = state.messages.some((m) => m.id === msg.id);
        if (!exists) {
          state.messages.push(msg);
        }
      }

      // Okunmamış sayacı mesaj bana geldiyse ve o sohbet açık değilse artır
      const currentUserId = action.payload.currentUserId;
      const fromMe = currentUserId && msg.senderId === currentUserId;
      if (!belongsToActive && !fromMe) {
        const convId = msg.roomId != null ? String(msg.roomId) : msg.senderId;
        if (convId) {
          state.unreadCounts[convId] = (state.unreadCounts[convId] || 0) + 1;
        }
      }
    },
    userOnline(state, action) {
      if (!state.onlineUsers.includes(action.payload)) {
        state.onlineUsers.push(action.payload);
      }
    },
    userOffline(state, action) {
      state.onlineUsers = state.onlineUsers.filter(
        (id) => id !== action.payload,
      );
    },
    userTyping(state, action) {
      if (!state.typingUsers.includes(action.payload)) {
        state.typingUsers.push(action.payload);
      }
    },
    userStoppedTyping(state, action) {
      state.typingUsers = state.typingUsers.filter(
        (id) => id !== action.payload,
      );
    },
    messageRead(state, action) {
      const message = state.messages.find(
        (m) => m.id === Number(action.payload),
      );
      if (message) {
        message.isRead = true;
        message.isDelivered = true;
      }
    },
    messageDelivered(state, action) {
      const message = state.messages.find(
        (m) => m.id === Number(action.payload),
      );
      if (message && !message.isRead) {
        message.isDelivered = true;
      }
    },
    groupMessageStatusUpdated: (
      state,
      action: PayloadAction<{
        messageId: number;
        readCount?: number;
        deliveredCount?: number;
        totalRecipients?: number;
      }>,
    ) => {
      const msg = state.messages.find((m) => m.id === action.payload.messageId);
      if (msg) {
        if (action.payload.readCount !== undefined)
          msg.readCount = action.payload.readCount;
        if (action.payload.deliveredCount !== undefined)
          msg.deliveredCount = action.payload.deliveredCount;
        if (action.payload.totalRecipients !== undefined)
          msg.totalRecipients = action.payload.totalRecipients;
      }
    },
    messageDeleted(state, action) {
      const message = state.messages.find(
        (m) => m.id === Number(action.payload),
      );
      if (message) {
        message.isDeleted = true;
      }
    },
    reactionUpdated(
      state,
      action: {
        payload: {
          messageId: number;
          reactions: { userId: string; emoji: string }[];
        };
      },
    ) {
      const message = state.messages.find(
        (m) => m.id === Number(action.payload.messageId),
      );
      if (message) {
        message.reactions = action.payload.reactions;
      }
    },
    setActiveConversation(
      state,
      action: { payload: { id: string; isRoom: boolean } },
    ) {
      state.activeConversationId = action.payload.id;
      state.isRoom = action.payload.isRoom;
      state.messages = [];
      state.typingUsers = [];
      // Bu sohbeti açınca okunmamış sayacını sıfırla
      delete state.unreadCounts[action.payload.id];
    },
    clearActiveConversation(state) {
      state.activeConversationId = null;
      state.isRoom = false;
      state.messages = [];
      state.typingUsers = [];
    },
    setMessages(state, action) {
      state.messages = action.payload;
    },
    // Okunmamış sayacını elle artır/sıfırla
    addUnread(state, action: PayloadAction<string>) {
      state.unreadCounts[action.payload] =
        (state.unreadCounts[action.payload] || 0) + 1;
    },
    removeUnread(state, action: PayloadAction<string>) {
      delete state.unreadCounts[action.payload];
    },
  },
});

export const {
  messageReceived,
  userOnline,
  userOffline,
  userTyping,
  userStoppedTyping,
  messageRead,
  messageDelivered,
  messageDeleted,
  reactionUpdated,
  setActiveConversation,
  clearActiveConversation,
  setMessages,
  groupMessageStatusUpdated,
  addUnread,
  removeUnread,
} = chatSlice.actions;

export default chatSlice.reducer;