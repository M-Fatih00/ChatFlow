import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from "react-redux"
import { authSlice } from '../features/auth/authSlice'
import { chatSlice } from '../features/chats/chatSlice'



// burada "Root Reducer Reset" Pattern(Global State Reset) yapıyoruz. Endüstri standardı olduğu için.

// Eskiden reducer'ları doğrudan configureStore'a veriyorduk.
// Şimdi önce combineReducers ile bir araya topluyoruz.
// Neden? Çünkü rootReducer'da tip güvenliği için lazım
// ve state = undefined yaparken tüm slice'ları kapsasın.
const appReducer = combineReducers({
  auth: authSlice.reducer,
  chat: chatSlice.reducer,
})


// appReducer'ı saran üst bir reducer yazıyoruz. Her action önce buraya düşer.
// logout fulfilled gelirse → state = undefined → 
// appReducer tüm slice'lara undefined state gönderir →
// her slice kendi initialState'ine döner. Temiz sayfa.
const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: any
) => {
  if (action.type === 'auth/logoutUser/fulfilled') {
    state = undefined
  }
  return appReducer(state, action)
}


// configureStore'a artık reducer objesi değil,
// rootReducer fonksiyonunu veriyoruz.
export const store = configureStore({
  reducer: rootReducer,
})


// RootState için store.getState DEĞİL appReducer kullanıyoruz.
// Neden? rootReducer'ın tipi "| undefined" içerir,
// bu useSelector'larda hata çıkarır.
// appReducer'ın tipi her zaman temiz ve kesin.
export type RootState = ReturnType<typeof appReducer>
export type AppDispatch = typeof store.dispatch


export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()