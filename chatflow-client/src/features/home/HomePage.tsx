import ChatArea from "../../components/ChatArea/ChatArea";
import Sidebar from "../../components/Sidebar/Sidebar";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { clearActiveConversation, setActiveConversation } from "../chats/chatSlice";
import "./HomePage.css";

export default function HomePage() {
  const { conversationId, roomId } = useParams();
  const dispatch = useAppDispatch();
  const { activeConversationId, isRoom } = useAppSelector(
    (state) => state.chat,
  );

  useEffect(() => {
    if (roomId) {
      if (roomId !== activeConversationId || !isRoom) {
        dispatch(setActiveConversation({ id: roomId, isRoom: true }));
      }
    } else if (conversationId) {
      if (conversationId !== activeConversationId || isRoom) {
        dispatch(setActiveConversation({ id: conversationId, isRoom: false }));
      }
    } else {
      // URL'de sohbet yok (/) → açık sohbeti kapat (mobilde listeye dön)
      if (activeConversationId) {
        dispatch(clearActiveConversation());
      }
    }
  }, [conversationId, roomId, activeConversationId, isRoom, dispatch]);

  return (
    <div
      className={`home-wrapper ${activeConversationId ? "chat-active" : "no-chat"}`}
    >
      <div className="home-sidebar">
        <Sidebar />
      </div>
      <div className="home-chat">
        <ChatArea />
      </div>
    </div>
  );
}
